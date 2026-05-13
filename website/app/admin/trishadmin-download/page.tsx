/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * /admin/trishadmin-download — Phase 41 final.
 *
 * Trang download TrishAdmin .exe — CHỈ admin thấy được (route guard trong layout).
 * TrishAdmin không nằm trong /apps-registry.json public — đường link
 * chỉ admin biết qua trang này.
 */

import { useState, useEffect } from 'react';
import { Download, Shield, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';

const TRISHADMIN_VERSION = '1.0.0';
const TRISHADMIN_RELEASE_URL = `https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishadmin-v${TRISHADMIN_VERSION}`;
const TRISHADMIN_DOWNLOAD_URL = `https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishadmin-v${TRISHADMIN_VERSION}/TrishAdmin_${TRISHADMIN_VERSION}_x64-setup.exe`;

export default function TrishAdminDownloadPage() {
  const [copied, setCopied] = useState(false);

  function copyLink(): void {
    navigator.clipboard.writeText(TRISHADMIN_DOWNLOAD_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">TrishAdmin Desktop</h1>
          <p className="text-sm text-zinc-400 mt-1">
            App quản trị nội bộ TrishTEAM — chỉ dành cho admin hệ sinh thái.
            Không xuất hiện trong TrishLauncher hoặc /downloads công khai.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-amber-200/90 space-y-1">
          <strong>Lưu ý bảo mật:</strong>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>TrishAdmin có quyền đầy đủ với Firestore + Firebase Storage</li>
            <li>Đăng nhập bằng tài khoản admin TrishTEAM (vd: trishteam.official@gmail.com)</li>
            <li>KHÔNG chia sẻ link tải hoặc .exe cho user không phải admin</li>
            <li>Audit log mọi hoạt động ghi vào Firestore /audit</li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">TrishAdmin v{TRISHADMIN_VERSION}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">RELEASED</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">Windows x64 · NSIS installer · ~6-8 MB</div>
          </div>
          <a
            href={TRISHADMIN_DOWNLOAD_URL}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white font-semibold text-sm hover:brightness-110 transition"
          >
            <Download className="w-4 h-4" /> Tải về (.exe)
          </a>
        </div>

        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Direct link</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-zinc-950 border border-zinc-800 rounded px-3 py-2 font-mono overflow-x-auto">
              {TRISHADMIN_DOWNLOAD_URL}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold whitespace-nowrap"
            >
              {copied ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Copied</span> : 'Copy'}
            </button>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4 grid grid-cols-2 gap-3">
          <a
            href={TRISHADMIN_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 text-sm hover:bg-zinc-800"
          >
            <ExternalLink className="w-4 h-4" /> Xem GitHub Release
          </a>
          <a
            href="https://github.com/hosytri07/trishnexus-monorepo/blob/main/apps-desktop/trishadmin/README.md"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 text-sm hover:bg-zinc-800"
          >
            📖 Hướng dẫn cài đặt
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 text-sm space-y-3">
        <h3 className="font-bold flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Tính năng v{TRISHADMIN_VERSION}</h3>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-300">
          <li><strong>📦 App Catalog (Firestore)</strong> — quản lý app catalog source-of-truth, add app ngoài hệ sinh thái</li>
          <li><strong>🏢 Office Multi-tenant</strong> — browse data cross-company cho debug</li>
          <li><strong>📋 ISO Projects</strong> — xem hồ sơ ISO 9001 mọi user</li>
          <li><strong>💵 Finance Telemetry</strong> — số user activate key Finance</li>
          <li><strong>👥 Users / Keys / Promo Codes / Sessions / Alerts</strong> — quản trị toàn hệ</li>
          <li><strong>☁ Drive Cloud Telegram</strong> — shares + requests</li>
          <li><strong>📊 Vitals / Errors / Audit</strong> — observability</li>
          <li><strong>📥 Bulk Import / Storage / Backup / API Keys / LISP Library</strong></li>
        </ul>
      </div>
    </div>
  );
}
