#!/usr/bin/env node
/**
 * scripts/qa/build-all.mjs — Phase 14.5.4
 *
 * Batch compile matrix cho 10 desktop app — chạy `cargo check` + `vite build`
 * tuần tự cho mọi app, collect pass/fail + timing, in báo cáo dạng bảng.
 *
 * Mục đích: bắt compile-time bug (Rust trait bound, TS type error, Vite import
 * path, dep mismatch) **trước khi** Trí ngồi máy `tauri dev` click-test UI.
 * Tầng defense sâu hơn `doctor.mjs` + `rust-audit.mjs` (hai script đó chỉ
 * parse file, không thực compile).
 *
 * Quan trọng: set `CARGO_TARGET_DIR=<root>/target-desktop` để 10 app share
 * compiled deps. Lần compile đầu ~8-12 phút (full build của tauri 2, serde,
 * walkdir, sysinfo, …), mỗi app sau ~30 s – 2 min vì chỉ build code
 * app-specific. Tổng: **~20-25 phút** thay vì ~50+ phút nếu chạy từng app
 * với `target/` riêng.
 *
 * Usage:
 *   node scripts/qa/build-all.mjs                     # all 10 apps, cả cargo + vite
 *   node scripts/qa/build-all.mjs --only=trishnote    # 1 app
 *   node scripts/qa/build-all.mjs --only=trishnote,trishdesign
 *   node scripts/qa/build-all.mjs --skip-vite         # chỉ cargo check
 *   node scripts/qa/build-all.mjs --skip-cargo        # chỉ vite build (nhanh, 3-5 min)
 *   node scripts/qa/build-all.mjs --json              # machine-readable cho CI
 *   node scripts/qa/build-all.mjs --quiet             # tắt live stdout, chỉ in summary
 *
 * Exit code:
 *   0 = tất cả pass
 *   1 = có ít nhất 1 step fail
 *   2 = fatal prerequisite missing (cargo/vite không tìm được)
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath() xử lý đúng cả Windows (C:\) và POSIX — không dùng
// `new URL().pathname` vì trên Windows trả về '/C:/...' với slash
// đầu, gây path.resolve ra kết quả 'C:\C:\...' bị nhân đôi drive.
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const SHARED_TARGET = path.join(ROOT, 'target-desktop');

const ALL_APPS = [
  'trishlauncher', 'trishcheck', 'trishclean', 'trishfont', 'trishtype',
  'trishimage', 'trishnote', 'trishlibrary', 'trishsearch', 'trishdesign',
];

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const JSON_MODE = process.argv.includes('--json');
const QUIET = process.argv.includes('--quiet') || JSON_MODE;
const SKIP_CARGO = process.argv.includes('--skip-cargo');
const SKIP_VITE = process.argv.includes('--skip-vite');
const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith('--only='));
  if (!arg) return null;
  return arg
    .slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
})();

const APPS = ONLY ? ALL_APPS.filter((a) => ONLY.includes(a)) : ALL_APPS;
if (APPS.length === 0) {
  process.stderr.write('[fatal] Không có app nào match --only\n');
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-flight check: cargo + vite binary tồn tại
// ─────────────────────────────────────────────────────────────────────────────

function checkCmd(cmd) {
  try {
    const r = spawnSync(cmd, ['--version'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    return r.status === 0;
  } catch {
    return false;
  }
}

if (!SKIP_CARGO && !checkCmd('cargo')) {
  process.stderr.write(
    '[fatal] `cargo` không tìm được trong PATH.\n' +
      '        Cài Rust toolchain qua https://rustup.rs/ rồi chạy lại.\n',
  );
  process.exit(2);
}

const VITE_BIN = process.platform === 'win32'
  ? path.join(ROOT, 'node_modules', '.bin', 'vite.cmd')
  : path.join(ROOT, 'node_modules', '.bin', 'vite');

if (!SKIP_VITE && !fs.existsSync(VITE_BIN)) {
  process.stderr.write(
    `[fatal] Vite binary missing tại ${VITE_BIN}\n` +
      `        Chạy \`pnpm install\` (hoặc \`npm install\` / \`yarn install\`) trước.\n`,
  );
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function log(line = '') {
  if (!QUIET) process.stdout.write(line + '\n');
}

function hr() {
  log('─'.repeat(72));
}

function formatSec(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Run command. Nếu !QUIET thì stream stdout + stderr live ra console;
 * nếu QUIET thì capture im lặng. Luôn capture stderr tail (≤4 KiB) để
 * hiển thị khi fail.
 */
function run(cmd, args, cwd, extraEnv = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    let stderrTail = '';

    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      shell: process.platform === 'win32',
      stdio: QUIET
        ? ['ignore', 'pipe', 'pipe']
        : ['ignore', 'inherit', 'pipe'],
    });

    if (proc.stderr) {
      proc.stderr.on('data', (d) => {
        const s = d.toString();
        stderrTail += s;
        if (stderrTail.length > 4096) {
          stderrTail = stderrTail.slice(-4096);
        }
        if (!QUIET) process.stderr.write(s);
      });
    }

    proc.on('error', (err) => {
      resolve({
        exit: -1,
        elapsedMs: Date.now() - start,
        stderrTail: err.message,
      });
    });
    proc.on('close', (exit) => {
      resolve({ exit, elapsedMs: Date.now() - start, stderrTail });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const report = {
  apps: {},
  meta: {
    startedAt: new Date().toISOString(),
    cargoTargetDir: SHARED_TARGET,
    platform: process.platform,
    arch: process.arch,
    node: process.version,
  },
};

log('');
hr();
log(` TrishTEAM build-all matrix — Phase 14.5.4`);
log(` Apps:  ${APPS.length} (${APPS.join(', ')})`);
log(` Steps: ${SKIP_CARGO ? '(cargo: skip)' : 'cargo check'} · ${SKIP_VITE ? '(vite: skip)' : 'vite build'}`);
log(` CARGO_TARGET_DIR = ${SHARED_TARGET}`);
log(` Ước tính: ~${estimate(APPS.length, SKIP_CARGO, SKIP_VITE)} phút lần đầu, ~5-8 phút các lần sau`);
hr();

function estimate(nApps, skipCargo, skipVite) {
  let min = 0;
  if (!skipCargo) min += 10 + Math.max(0, nApps - 1) * 1; // full build 10 min + ~1 min per subsequent
  if (!skipVite) min += nApps * 0.5; // vite ~30s per app
  return Math.ceil(min);
}

for (const app of APPS) {
  report.apps[app] = {};
  const appDir = path.join(ROOT, 'apps-desktop', app);
  const tauriManifest = path.join(appDir, 'src-tauri', 'Cargo.toml');

  if (!fs.existsSync(appDir)) {
    report.apps[app].error = `appDir missing: ${appDir}`;
    log(`\n❌ ${app} — app directory không tồn tại`);
    continue;
  }

  log('');
  log(`📦 ${app}`);

  // 1. cargo check
  if (!SKIP_CARGO) {
    if (!fs.existsSync(tauriManifest)) {
      report.apps[app].cargo_check = { exit: -1, elapsedMs: 0, stderrTail: 'src-tauri/Cargo.toml missing' };
      log(`  ❌ cargo check — Cargo.toml không có`);
    } else {
      log(`  → cargo check (manifest: src-tauri/Cargo.toml, target: share)`);
      const r = await run(
        'cargo',
        [
          'check',
          '--manifest-path',
          tauriManifest,
          '--message-format',
          'short',
        ],
        appDir,
        { CARGO_TARGET_DIR: SHARED_TARGET },
      );
      report.apps[app].cargo_check = {
        exit: r.exit,
        elapsedMs: r.elapsedMs,
        stderrTail: r.stderrTail.slice(-1024),
      };
      log(
        `  ${r.exit === 0 ? '✅' : '❌'} cargo check · ${formatSec(r.elapsedMs)} · exit=${r.exit}`,
      );
    }
  }

  // 2. vite build
  if (!SKIP_VITE) {
    if (!fs.existsSync(path.join(appDir, 'vite.config.ts'))) {
      report.apps[app].vite_build = { exit: -1, elapsedMs: 0, stderrTail: 'vite.config.ts missing' };
      log(`  ❌ vite build — vite.config.ts không có`);
    } else {
      log(`  → vite build --mode production`);
      const r = await run(
        VITE_BIN,
        ['build', '--mode', 'production'],
        appDir,
        {},
      );
      report.apps[app].vite_build = {
        exit: r.exit,
        elapsedMs: r.elapsedMs,
        stderrTail: r.stderrTail.slice(-1024),
      };
      log(
        `  ${r.exit === 0 ? '✅' : '❌'} vite build  · ${formatSec(r.elapsedMs)} · exit=${r.exit}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary matrix
// ─────────────────────────────────────────────────────────────────────────────

log('');
hr();
log(' Summary matrix');
hr();

const W_APP = 16;
const W_CARGO = 16;
const W_VITE = 14;

log(
  'APP'.padEnd(W_APP) +
    ' │ ' +
    'cargo check'.padEnd(W_CARGO) +
    ' │ ' +
    'vite build'.padEnd(W_VITE),
);
log(
  '─'.repeat(W_APP) +
    '─┼─' +
    '─'.repeat(W_CARGO) +
    '─┼─' +
    '─'.repeat(W_VITE),
);

let totalPass = 0;
let totalFail = 0;
let totalMs = 0;

for (const app of APPS) {
  const r = report.apps[app];

  let cargoStr = '-';
  if (!SKIP_CARGO && r.cargo_check) {
    totalMs += r.cargo_check.elapsedMs;
    if (r.cargo_check.exit === 0) {
      cargoStr = `✅ ${formatSec(r.cargo_check.elapsedMs)}`;
      totalPass++;
    } else {
      cargoStr = `❌ exit=${r.cargo_check.exit}`;
      totalFail++;
    }
  } else if (SKIP_CARGO) {
    cargoStr = 'skip';
  }

  let viteStr = '-';
  if (!SKIP_VITE && r.vite_build) {
    totalMs += r.vite_build.elapsedMs;
    if (r.vite_build.exit === 0) {
      viteStr = `✅ ${formatSec(r.vite_build.elapsedMs)}`;
      totalPass++;
    } else {
      viteStr = `❌ exit=${r.vite_build.exit}`;
      totalFail++;
    }
  } else if (SKIP_VITE) {
    viteStr = 'skip';
  }

  log(
    app.padEnd(W_APP) +
      ' │ ' +
      cargoStr.padEnd(W_CARGO) +
      ' │ ' +
      viteStr.padEnd(W_VITE),
  );
}

hr();
log(
  ` Total: ${totalPass} pass, ${totalFail} fail · wall time ~${formatSec(totalMs)}`,
);
hr();

// ─────────────────────────────────────────────────────────────────────────────
// Fail detail
// ─────────────────────────────────────────────────────────────────────────────

if (totalFail > 0) {
  log('');
  log('─── Fail details (stderr tail, last 1 KiB mỗi step) ────────────────────');
  for (const app of APPS) {
    const r = report.apps[app];
    if (r.cargo_check && r.cargo_check.exit !== 0) {
      log(`\n▸ ${app} · cargo check · exit=${r.cargo_check.exit}`);
      log(r.cargo_check.stderrTail.trim() || '(empty stderr)');
    }
    if (r.vite_build && r.vite_build.exit !== 0) {
      log(`\n▸ ${app} · vite build · exit=${r.vite_build.exit}`);
      log(r.vite_build.stderrTail.trim() || '(empty stderr)');
    }
  }
}

report.meta.finishedAt = new Date().toISOString();
report.meta.totalPass = totalPass;
report.meta.totalFail = totalFail;
report.meta.totalWallMs = totalMs;

if (JSON_MODE) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

process.exit(totalFail === 0 ? 0 : 1);
