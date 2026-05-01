/**
 * GET /api/updates/{appid}/{target}/{current_version} — Phase 26.5.F.batch
 *
 * Tauri updater plugin query endpoint. Mỗi app TrishTEAM gọi URL này khi check
 * update. Server fetch GitHub Releases latest tag cho app, compare version,
 * return JSON manifest theo format Tauri updater:
 *
 *   {
 *     "version": "1.0.1",
 *     "notes": "Release notes...",
 *     "pub_date": "2026-...",
 *     "platforms": {
 *       "windows-x86_64": {
 *         "signature": "<base64 ed25519 signature>",
 *         "url": "https://github.com/.../trishlauncher_1.0.1_x64-setup.exe"
 *       }
 *     }
 *   }
 *
 * 204 No Content nếu app đã ở phiên bản mới nhất.
 *
 * Convention asset name: `{appid}_{version}_x64-setup.exe` (NSIS) +
 * `{appid}_{version}_x64-setup.exe.sig` (signature từ tauri signer sign).
 *
 * Setup: tag git format `{appid}-v{version}` → GitHub Actions build NSIS + sign +
 * upload assets vào Release. Workflow `.github/workflows/release-app.yml`.
 */

import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';

const REPO = 'hosytri07/trishnexus-monorepo'; // Github user/repo

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubAsset[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appid: string; target: string; currentVersion: string }> }
) {
  try {
    const { appid, target, currentVersion } = await params;

    // Validate appid
    const ALLOWED_APPS = [
      'trishlauncher', 'trishlibrary', 'trishfont', 'trishcheck',
      'trishclean', 'trishiso', 'trishdrive', 'trishdesign',
    ];
    if (!ALLOWED_APPS.includes(appid)) {
      return NextResponse.json({ error: `App "${appid}" không có trong allowlist` }, { status: 404 });
    }

    // Fetch latest release from GitHub
    const tagPrefix = `${appid}-v`;
    const url = `https://api.github.com/repos/${REPO}/releases?per_page=20`;
    const ghRes = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'TrishTEAM-Updater/1.0',
        ...(process.env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 300 }, // 5 minutes cache
    });
    if (!ghRes.ok) {
      return NextResponse.json({ error: `GitHub API ${ghRes.status}` }, { status: 502 });
    }
    const releases = (await ghRes.json()) as GitHubRelease[];

    // Find latest non-draft non-prerelease release for this app
    const latest = releases.find(r =>
      r.tag_name.startsWith(tagPrefix) && !r.draft && !r.prerelease
    );
    if (!latest) {
      // No release yet → 204 (no update)
      return new Response(null, { status: 204 });
    }

    const latestVersion = latest.tag_name.slice(tagPrefix.length);
    if (compareVersion(latestVersion, currentVersion) <= 0) {
      // Already on latest or newer
      return new Response(null, { status: 204 });
    }

    // Find platform-matching asset (windows-x86_64 → x64-setup.exe + .sig)
    // Tauri target format: "windows-x86_64", "darwin-aarch64", "linux-x86_64"
    const isWindows = target.startsWith('windows');
    const isMac = target.startsWith('darwin');
    const isLinux = target.startsWith('linux');

    let installerAsset: GitHubAsset | undefined;
    let sigAsset: GitHubAsset | undefined;

    if (isWindows) {
      installerAsset = latest.assets.find(a => a.name.endsWith('-setup.exe'));
      sigAsset = latest.assets.find(a => a.name.endsWith('-setup.exe.sig'));
    } else if (isMac) {
      installerAsset = latest.assets.find(a => a.name.endsWith('.app.tar.gz') || a.name.endsWith('.dmg'));
      sigAsset = latest.assets.find(a => a.name === installerAsset?.name + '.sig');
    } else if (isLinux) {
      installerAsset = latest.assets.find(a => a.name.endsWith('.AppImage'));
      sigAsset = latest.assets.find(a => a.name === installerAsset?.name + '.sig');
    }

    if (!installerAsset || !sigAsset) {
      return NextResponse.json({
        error: `Release ${latest.tag_name} thiếu installer hoặc signature cho target ${target}`,
      }, { status: 502 });
    }

    // Fetch signature content
    const sigRes = await fetch(sigAsset.browser_download_url);
    const signature = sigRes.ok ? (await sigRes.text()).trim() : '';

    return NextResponse.json({
      version: latestVersion,
      notes: latest.body || latest.name,
      pub_date: latest.published_at,
      platforms: {
        [target]: {
          signature,
          url: installerAsset.browser_download_url,
        },
      },
    });
  } catch (e) {
    console.error('[updates]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Semver-ish compare: returns 1 if a > b, -1 if a < b, 0 if equal. */
function compareVersion(a: string, b: string): number {
  const pa = a.split(/[.\-+]/).map(s => parseInt(s, 10) || 0);
  const pb = b.split(/[.\-+]/).map(s => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
