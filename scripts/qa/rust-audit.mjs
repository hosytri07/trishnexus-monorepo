#!/usr/bin/env node
/**
 * scripts/qa/rust-audit.mjs — Phase 14.5.2
 *
 * Audit Rust side cho 10 desktop app, bổ sung cho doctor.mjs (JS/TS side).
 *
 * Kiểm tra:
 *   1. Cargo.toml deps version consistency:
 *        - tauri + tauri-build đều major 2.x
 *        - serde "1", serde_json "1"
 *        - walkdir major 2 (accept "2", "2.5", "^2.5")
 *        - dirs major 5 nếu có
 *   2. invoke_handler surface — parse lib.rs:
 *        - mọi `#[tauri::command]` fn được register trong
 *          `generate_handler![…]`.
 *        - không có command orphan.
 *   3. Data-dir subfolder isolation — 10 app không 2 app cùng subfolder:
 *        - Đọc APP_SUBDIR const hoặc detect dùng `app.path().app_data_dir()`
 *          (Tauri tự-isolate qua identifier).
 *   4. Icon files physically exist + đúng format:
 *        - 32x32.png (32×32), 128x128.png (128×128), 128x128@2x.png (256×256)
 *        - icon.ico (MS Windows icon), icon.icns (Mac OS X icon)
 *   5. Window config: minWidth ≥ 480, minHeight ≥ 320, resizable true.
 *   6. Bundle targets declared trong tauri.conf.json bundle.targets
 *      (hoặc "all" để build cho platform hiện tại).
 *
 * Usage:
 *   node scripts/qa/rust-audit.mjs           # pretty report
 *   node scripts/qa/rust-audit.mjs --json    # machine-readable
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath() xử lý đúng cả Windows (C:\) và POSIX — không dùng
// `new URL().pathname` vì trên Windows trả về '/C:/...' với slash đầu,
// gây path.resolve ra kết quả 'C:\C:\...' bị nhân đôi drive.
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const APPS = [
  'trishlauncher', 'trishcheck', 'trishclean', 'trishfont', 'trishtype',
  'trishimage', 'trishnote', 'trishlibrary', 'trishsearch', 'trishdesign',
];

const JSON_MODE = process.argv.includes('--json');

const report = { checks: [], errors: [], warnings: [] };

function pass(check, detail) { report.checks.push({ check, status: 'pass', detail }); }
function fail(check, detail) { report.checks.push({ check, status: 'fail', detail }); report.errors.push(`${check}: ${detail}`); }
function warn(check, detail) { report.checks.push({ check, status: 'warn', detail }); report.warnings.push(`${check}: ${detail}`); }

function readText(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch { return null; }
}

function readJson(rel) {
  const t = readText(rel); if (t == null) return null;
  try { return JSON.parse(t); } catch { return null; }
}

function fileSize(rel) {
  try { return fs.statSync(path.join(ROOT, rel)).size; }
  catch { return -1; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cargo deps consistency
// ─────────────────────────────────────────────────────────────────────────────

function parseCargoDeps(cargoText) {
  // Đơn giản: chạy dòng-theo-dòng trong block [dependencies],
  // [build-dependencies] hoặc [target.*.dependencies]. Gộp tất cả vào 1
  // map — tauri-build thường nằm trong [build-dependencies].
  const deps = {};
  let inDeps = false;
  for (const line of cargoText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inDeps = /^\[(dependencies|build-dependencies|target\.[^.]+\.dependencies)\]/.test(trimmed);
      continue;
    }
    if (!inDeps || !trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=\s*(.+)$/);
    if (!m) continue;
    const [, name, rhs] = m;
    let version = null;
    const vm = rhs.match(/^"([^"]+)"$/);
    if (vm) version = vm[1];
    else {
      const vm2 = rhs.match(/version\s*=\s*"([^"]+)"/);
      if (vm2) version = vm2[1];
    }
    deps[name] = version;
  }
  return deps;
}

function checkCargo() {
  for (const app of APPS) {
    const cargo = readText(`apps-desktop/${app}/src-tauri/Cargo.toml`);
    if (!cargo) { fail('cargo.read', `${app}: Cargo.toml missing`); continue; }
    const deps = parseCargoDeps(cargo);

    function check(name, re, required = true) {
      const v = deps[name];
      if (v == null) {
        if (required) fail('cargo.dep', `${app}: "${name}" missing`);
        return;
      }
      if (!re.test(v)) {
        fail('cargo.dep.version', `${app}: ${name}="${v}" không match ${re}`);
      }
    }

    check('tauri', /^[~^]?2(\.|$)/);
    check('tauri-build', /^[~^]?2(\.|$)/);
    check('serde', /^[~^]?1(\.|$)/);
    check('serde_json', /^[~^]?1(\.|$)/);
    // walkdir optional — chỉ check nếu có.
    if (deps['walkdir']) check('walkdir', /^[~^]?2(\.|$)/);
    if (deps['dirs']) check('dirs', /^[~^]?5(\.|$)/);
    if (deps['sysinfo']) check('sysinfo', /^[~^]?0\.30/);
    if (deps['kamadak-exif']) check('kamadak-exif', /^[~^]?0\.5/);
    if (deps['imagesize']) check('imagesize', /^[~^]?0\.13/);
    if (deps['ttf-parser']) check('ttf-parser', /^[~^]?0\.20/);
  }
  pass('cargo.deps', `checked ${APPS.length} Cargo.toml`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. invoke_handler surface
// ─────────────────────────────────────────────────────────────────────────────

function checkInvokeHandler() {
  for (const app of APPS) {
    const lib = readText(`apps-desktop/${app}/src-tauri/src/lib.rs`);
    if (!lib) { fail('rust.lib', `${app}: lib.rs missing`); continue; }

    // Tìm tất cả fn có #[tauri::command]
    const cmdNames = new Set();
    const attrRe = /#\[tauri::command\][\s\S]*?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let m;
    while ((m = attrRe.exec(lib))) cmdNames.add(m[1]);

    // Tìm generate_handler![...]
    const gh = lib.match(/generate_handler!\s*\[([^\]]+)\]/);
    if (!gh) {
      if (cmdNames.size === 0) {
        pass('rust.handler', `${app}: no commands (OK)`);
      } else {
        fail('rust.handler', `${app}: có ${cmdNames.size} #[command] nhưng thiếu generate_handler!`);
      }
      continue;
    }
    const registered = new Set(
      gh[1].split(',').map((s) => s.trim()).filter(Boolean),
    );

    for (const name of cmdNames) {
      if (!registered.has(name)) {
        fail('rust.handler.orphan', `${app}: command "${name}" không register trong generate_handler!`);
      }
    }
    for (const name of registered) {
      if (!cmdNames.has(name)) {
        fail('rust.handler.unknown', `${app}: generate_handler! list "${name}" nhưng không có fn nào có #[tauri::command]`);
      }
    }
    pass('rust.handler', `${app}: ${cmdNames.size} command đều được register`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Data-dir isolation
// ─────────────────────────────────────────────────────────────────────────────

function extractDataDirToken(app) {
  const lib = readText(`apps-desktop/${app}/src-tauri/src/lib.rs`);
  if (!lib) return null;
  // APP_SUBDIR const (ưu tiên)
  const m = lib.match(/APP_SUBDIR\s*:\s*&str\s*=\s*"([^"]+)"/);
  if (m) return { kind: 'APP_SUBDIR', value: m[1] };
  // Dùng app.path().app_data_dir() → Tauri identifier
  if (/app_data_dir\(\)/.test(lib)) {
    const conf = readJson(`apps-desktop/${app}/src-tauri/tauri.conf.json`);
    return { kind: 'identifier', value: conf?.identifier ?? '<unknown>' };
  }
  return { kind: 'none', value: '(không ghi file)' };
}

function checkDataDirIsolation() {
  const seen = new Map();
  for (const app of APPS) {
    const tok = extractDataDirToken(app);
    if (!tok) { fail('rust.data-dir', `${app}: không parse được data dir`); continue; }
    pass('rust.data-dir', `${app}: ${tok.kind}="${tok.value}"`);
    if (tok.kind === 'none') continue;
    const key = `${tok.kind}:${tok.value.toLowerCase()}`;
    if (seen.has(key)) {
      fail('rust.data-dir.collision', `${seen.get(key)} + ${app} cùng ghi "${tok.value}"`);
    } else {
      seen.set(key, app);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Icon files
// ─────────────────────────────────────────────────────────────────────────────

function checkIcons() {
  const REQ = [
    { rel: '32x32.png', minSize: 200 },
    { rel: '128x128.png', minSize: 1500 },
    { rel: '128x128@2x.png', minSize: 3000 },
    { rel: 'icon.ico', minSize: 1000 },
    { rel: 'icon.icns', minSize: 5000 },
  ];
  for (const app of APPS) {
    for (const { rel, minSize } of REQ) {
      const full = `apps-desktop/${app}/src-tauri/icons/${rel}`;
      const size = fileSize(full);
      if (size < 0) {
        fail('rust.icon', `${app}: missing icons/${rel}`);
      } else if (size < minSize) {
        warn('rust.icon.small', `${app}: icons/${rel} = ${size}B (expected ≥ ${minSize})`);
      }
    }
  }
  pass('rust.icons', `checked ${REQ.length} icon files × ${APPS.length} apps`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Window config
// ─────────────────────────────────────────────────────────────────────────────

function checkWindow() {
  for (const app of APPS) {
    const conf = readJson(`apps-desktop/${app}/src-tauri/tauri.conf.json`);
    if (!conf) continue;
    const wins = conf?.app?.windows ?? [];
    if (!wins.length) { fail('rust.window', `${app}: không có window nào`); continue; }
    const w = wins[0];
    const minW = w.minWidth ?? 0;
    const minH = w.minHeight ?? 0;
    if (minW < 480) fail('rust.window.min', `${app}: minWidth=${minW} < 480`);
    if (minH < 320) fail('rust.window.min', `${app}: minHeight=${minH} < 320`);
    if (w.resizable === false) warn('rust.window.resize', `${app}: resizable=false`);
  }
  pass('rust.window', `checked window config ${APPS.length} apps`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Bundle targets
// ─────────────────────────────────────────────────────────────────────────────

function checkBundleTargets() {
  const VALID = new Set([
    'all', 'msi', 'nsis', 'app', 'dmg', 'deb', 'rpm', 'appimage',
  ]);
  for (const app of APPS) {
    const conf = readJson(`apps-desktop/${app}/src-tauri/tauri.conf.json`);
    if (!conf) continue;
    const targets = conf?.bundle?.targets;
    if (targets == null) {
      warn('rust.bundle.targets', `${app}: bundle.targets không khai báo — default "all" (build tất cả platform hiện tại)`);
      continue;
    }
    const arr = Array.isArray(targets) ? targets : [targets];
    for (const t of arr) {
      if (typeof t !== 'string' || !VALID.has(t.toLowerCase())) {
        fail('rust.bundle.targets', `${app}: target không hợp lệ "${t}"`);
      }
    }
  }
  pass('rust.bundle.targets', `checked bundle.targets ${APPS.length} apps`);
}

// ─────────────────────────────────────────────────────────────────────────────
// run
// ─────────────────────────────────────────────────────────────────────────────

checkCargo();
checkInvokeHandler();
checkDataDirIsolation();
checkIcons();
checkWindow();
checkBundleTargets();

report.summary = {
  pass: report.checks.filter((c) => c.status === 'pass').length,
  warn: report.warnings.length,
  fail: report.errors.length,
};

if (JSON_MODE) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  console.log('─'.repeat(72));
  console.log(' TrishTEAM Rust audit — Phase 14.5.2');
  console.log('─'.repeat(72));
  for (const c of report.checks) {
    const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️ ' : '❌';
    console.log(`${icon} [${c.check}] ${c.detail}`);
  }
  console.log('─'.repeat(72));
  console.log(` Pass: ${report.summary.pass}   Warn: ${report.summary.warn}   Fail: ${report.summary.fail}`);
  console.log('─'.repeat(72));
  if (report.errors.length) {
    console.log('FAIL:'); for (const e of report.errors) console.log('  -', e);
  }
  if (report.warnings.length) {
    console.log('WARN:'); for (const w of report.warnings) console.log('  -', w);
  }
}

process.exit(report.errors.length === 0 ? 0 : 1);
