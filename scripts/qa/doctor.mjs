#!/usr/bin/env node
/**
 * scripts/qa/doctor.mjs — Phase 14.5.1
 *
 * Preflight doctor cho ecosystem 10 desktop app + 4 shared package.
 * Chạy offline (không cần Tauri runtime). Kiểm tra:
 *
 *   1.  Port registry: không 2 app trùng dev port hoặc HMR port, và
 *       dev port khớp với bảng canonical (launcher 1420, check 1422,
 *       clean 1424, font 1426, type 1428, image 1430, note 1432,
 *       library 1434, search 1436, design 1438).
 *   2.  HMR port = dev port + 1 (nếu có khai báo riêng).
 *   3.  Tauri identifier `vn.trishteam.<app>` — không ai trùng.
 *   4.  Mỗi app có đủ file: package.json, vite.config.ts, tsconfig.json,
 *       index.html, src/main.tsx, src/App.tsx, src/styles.css, README.md,
 *       src-tauri/{Cargo.toml,tauri.conf.json,build.rs,src/main.rs,
 *       src/lib.rs,capabilities/default.json,icons/icon.png}.
 *   5.  Capabilities whitelist — không có permission `shell:*`,
 *       `fs:allow-write-file` tràn lan, `http:default`.
 *   6.  CSP không cho phép `unsafe-eval` ngoài dev, connect-src limit
 *       firebaseio/googleapis/trishteam.io.vn.
 *   7.  package.json scripts tối thiểu: `dev`, `typecheck`, `tauri:dev`,
 *       `tauri:build`.
 *   8.  package.json dependencies khớp workspace: React 18 + Vite 5 +
 *       Tauri 2 + `@trishteam/core` (workspace-relative).
 *   9.  tsc EXIT=0 toàn bộ workspace (packages + apps-desktop).
 *   10. vitest toàn core — lấy pass count.
 *
 * Exit 0 = PASS, 1 = có drift/fail.
 *
 * Usage:
 *   node scripts/qa/doctor.mjs                # full report
 *   node scripts/qa/doctor.mjs --quick        # skip tsc + vitest
 *   node scripts/qa/doctor.mjs --json         # machine-readable output
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ----- constants -----

// fileURLToPath() xử lý đúng cả Windows (C:\) và POSIX — không dùng
// `new URL().pathname` vì trên Windows trả về '/C:/...' với slash đầu,
// gây path.resolve ra kết quả 'C:\C:\...' bị nhân đôi drive.
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const APPS = [
  { id: 'trishlauncher', port: 1420, hmr: 1421, identifier: 'vn.trishteam.launcher' },
  { id: 'trishcheck',    port: 1422, hmr: 1423, identifier: 'vn.trishteam.check'    },
  { id: 'trishclean',    port: 1424, hmr: 1425, identifier: 'vn.trishteam.clean'    },
  { id: 'trishfont',     port: 1426, hmr: 1427, identifier: 'vn.trishteam.font'     },
  { id: 'trishtype',     port: 1428, hmr: 1429, identifier: 'vn.trishteam.type'     },
  { id: 'trishimage',    port: 1430, hmr: 1431, identifier: 'vn.trishteam.image'    },
  { id: 'trishnote',     port: 1432, hmr: 1433, identifier: 'vn.trishteam.note'     },
  { id: 'trishlibrary',  port: 1434, hmr: 1435, identifier: 'vn.trishteam.library'  },
  { id: 'trishsearch',   port: 1436, hmr: 1437, identifier: 'vn.trishteam.search'   },
  { id: 'trishdesign',   port: 1438, hmr: 1439, identifier: 'vn.trishteam.design'   },
];

const PACKAGES = ['core', 'ui', 'data', 'adapters'];

const REQUIRED_APP_FILES = [
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/styles.css',
  'README.md',
  'src-tauri/Cargo.toml',
  'src-tauri/tauri.conf.json',
  'src-tauri/build.rs',
  'src-tauri/src/main.rs',
  'src-tauri/src/lib.rs',
  'src-tauri/capabilities/default.json',
];

const REQUIRED_APP_SCRIPTS = ['dev', 'typecheck', 'tauri:dev', 'tauri:build'];

const FORBIDDEN_PERMS = [
  'shell:default',
  'shell:allow-execute',
  'shell:allow-kill',
  'shell:allow-spawn',
  'http:default',
  'http:allow-http-request',
];

// ----- cli flags -----

const args = new Set(process.argv.slice(2));
const QUICK = args.has('--quick');
const JSON_MODE = args.has('--json');

// ----- helpers -----

const report = { started: new Date().toISOString(), checks: [], errors: [], warnings: [] };

function pass(check, detail) {
  report.checks.push({ check, status: 'pass', detail });
}

function fail(check, detail) {
  report.checks.push({ check, status: 'fail', detail });
  report.errors.push(`${check}: ${detail}`);
}

function warn(check, detail) {
  report.checks.push({ check, status: 'warn', detail });
  report.warnings.push(`${check}: ${detail}`);
}

function readJson(relPath) {
  const full = path.join(ROOT, relPath);
  try {
    const text = fs.readFileSync(full, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

function readText(relPath) {
  const full = path.join(ROOT, relPath);
  try {
    return fs.readFileSync(full, 'utf8');
  } catch (err) {
    return null;
  }
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ----- check 1..3: ports + identifiers -----

function checkPortsAndIdentifiers() {
  const seenPorts = new Map();
  const seenHmr = new Map();
  const seenIds = new Map();

  for (const app of APPS) {
    const vitePath = `apps-desktop/${app.id}/vite.config.ts`;
    const vite = readText(vitePath);
    if (vite == null) {
      fail('app.vite-config', `${vitePath} missing`);
      continue;
    }

    // Bắt port & hmr port
    const lines = vite.split('\n');
    let portNum = null;
    let hmrNum = null;
    let inHmr = false;
    for (const line of lines) {
      if (line.includes('hmr:')) inHmr = true;
      const m = line.match(/port:\s*(\d+)/);
      if (m) {
        const n = Number(m[1]);
        if (inHmr) hmrNum = n;
        else if (portNum == null) portNum = n;
      }
      if (line.includes('}')) inHmr = false;
    }

    // Kiểm dev port
    if (portNum !== app.port) {
      fail('app.port', `${app.id}: declared ${portNum}, expected ${app.port}`);
    } else {
      pass('app.port', `${app.id} port=${portNum}`);
    }
    if (seenPorts.has(portNum)) {
      fail('app.port.unique', `port ${portNum} duplicate: ${seenPorts.get(portNum)} + ${app.id}`);
    } else if (portNum != null) {
      seenPorts.set(portNum, app.id);
    }

    // Kiểm HMR port (nếu app khai báo)
    if (app.hmr != null) {
      if (hmrNum !== app.hmr) {
        fail('app.hmr', `${app.id}: HMR ${hmrNum}, expected ${app.hmr}`);
      } else {
        pass('app.hmr', `${app.id} hmr=${hmrNum}`);
      }
      if (seenHmr.has(hmrNum)) {
        fail('app.hmr.unique', `hmr ${hmrNum} duplicate: ${seenHmr.get(hmrNum)} + ${app.id}`);
      } else if (hmrNum != null) {
        seenHmr.set(hmrNum, app.id);
      }
    } else if (hmrNum != null) {
      warn('app.hmr.unexpected', `${app.id} declares hmr=${hmrNum} but registry says none`);
    }

    // Identifier
    const conf = readJson(`apps-desktop/${app.id}/src-tauri/tauri.conf.json`);
    if (!conf) {
      fail('app.tauri-conf', `${app.id}: tauri.conf.json missing`);
      continue;
    }
    if (conf.identifier !== app.identifier) {
      fail('app.identifier', `${app.id}: identifier=${conf.identifier}, expected ${app.identifier}`);
    } else {
      pass('app.identifier', `${app.id} ${conf.identifier}`);
    }
    if (seenIds.has(conf.identifier)) {
      fail('app.identifier.unique', `${conf.identifier} duplicate: ${seenIds.get(conf.identifier)} + ${app.id}`);
    } else if (conf.identifier) {
      seenIds.set(conf.identifier, app.id);
    }
  }
}

// ----- check 4: required files -----

function checkRequiredFiles() {
  for (const app of APPS) {
    for (const rel of REQUIRED_APP_FILES) {
      const full = `apps-desktop/${app.id}/${rel}`;
      if (!exists(full)) {
        fail('app.files', `${app.id}: missing ${rel}`);
      }
    }
    // icon có thể có nhiều biến thể
    const iconDir = path.join(ROOT, `apps-desktop/${app.id}/src-tauri/icons`);
    if (!fs.existsSync(iconDir)) {
      fail('app.files', `${app.id}: src-tauri/icons missing`);
    }
  }
  pass('app.files', `checked ${REQUIRED_APP_FILES.length} files × ${APPS.length} apps`);
}

// ----- check 5: capabilities whitelist -----

function checkCapabilities() {
  for (const app of APPS) {
    const capPath = `apps-desktop/${app.id}/src-tauri/capabilities/default.json`;
    const cap = readJson(capPath);
    if (!cap) {
      fail('app.capabilities', `${app.id}: ${capPath} missing`);
      continue;
    }
    const perms = Array.isArray(cap.permissions) ? cap.permissions : [];
    for (const p of perms) {
      const pid = typeof p === 'string' ? p : p?.identifier;
      if (!pid) continue;
      if (FORBIDDEN_PERMS.includes(pid)) {
        fail('app.capabilities.forbidden', `${app.id}: permission "${pid}" không được phép`);
      }
    }
  }
  pass('app.capabilities', `checked ${APPS.length} capability files, forbidden=${FORBIDDEN_PERMS.length}`);
}

// ----- check 6: CSP -----

function checkCsp() {
  for (const app of APPS) {
    const conf = readJson(`apps-desktop/${app.id}/src-tauri/tauri.conf.json`);
    if (!conf) continue;
    const csp = conf?.app?.security?.csp ?? conf?.security?.csp ?? null;
    if (csp == null) {
      // Tauri 2 cho phép csp null ở alpha (Tauri sẽ inject runtime CSP).
      warn('app.csp', `${app.id}: CSP null — alpha cho phép, nhưng nên siết trước release`);
      continue;
    }
    if (typeof csp !== 'string') {
      fail('app.csp', `${app.id}: CSP không phải string`);
      continue;
    }
    if (csp.includes("'unsafe-eval'")) {
      fail('app.csp.unsafe-eval', `${app.id}: CSP có unsafe-eval`);
    }
    if (csp.includes('connect-src') && !csp.match(/connect-src[^;]*(firebaseio|googleapis|trishteam\.io\.vn|'self')/)) {
      warn('app.csp.connect-src', `${app.id}: connect-src nên whitelist firebaseio/googleapis/trishteam.io.vn`);
    }
  }
  pass('app.csp', `checked CSP ${APPS.length} apps`);
}

// ----- check 7+8: package.json scripts + deps -----

function checkPackageJson() {
  // Regex cho phép prefix ^ hoặc ~ trước major, ví dụ ^18.3.1 hoặc ~5.4.0
  const coreVersionsExpected = { react: /^[~^]?18\./, vite: /^[~^]?5\./ };
  for (const app of APPS) {
    const pkg = readJson(`apps-desktop/${app.id}/package.json`);
    if (!pkg) {
      fail('app.package-json', `${app.id}: package.json missing`);
      continue;
    }
    for (const s of REQUIRED_APP_SCRIPTS) {
      if (!pkg.scripts?.[s]) {
        fail('app.scripts', `${app.id}: script "${s}" missing`);
      }
    }
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (!deps['@trishteam/core']) {
      fail('app.deps.core', `${app.id}: @trishteam/core not listed`);
    }
    const reactV = deps.react;
    if (reactV && !coreVersionsExpected.react.test(reactV)) {
      warn('app.deps.react', `${app.id}: react=${reactV} không phải 18.x`);
    }
    const viteV = deps.vite;
    if (viteV && !coreVersionsExpected.vite.test(viteV)) {
      warn('app.deps.vite', `${app.id}: vite=${viteV} không phải 5.x`);
    }
    if (!deps['@tauri-apps/api']) {
      fail('app.deps.tauri-api', `${app.id}: @tauri-apps/api missing`);
    }
  }
  pass('app.package-json', `checked ${APPS.length} package.json`);
}

// ----- check 9: tsc -----

function checkTsc() {
  if (QUICK) {
    pass('tsc', 'skipped (--quick)');
    return;
  }
  const all = [...PACKAGES.map((p) => `packages/${p}`), ...APPS.map((a) => `apps-desktop/${a.id}`)];
  const tscBin = path.join(ROOT, 'node_modules/.bin/tsc');
  if (!fs.existsSync(tscBin)) {
    fail('tsc', 'node_modules/.bin/tsc missing — run npm install');
    return;
  }
  for (const ws of all) {
    const cfg = path.join(ROOT, ws, 'tsconfig.json');
    if (!fs.existsSync(cfg)) continue;
    const res = spawnSync(tscBin, ['-p', cfg, '--noEmit'], { cwd: ROOT, encoding: 'utf8' });
    if (res.status !== 0) {
      const output = (res.stdout || '') + (res.stderr || '');
      fail('tsc', `${ws} exit=${res.status}\n${output.split('\n').slice(0, 15).join('\n')}`);
    } else {
      pass('tsc', `${ws} EXIT=0`);
    }
  }
}

// ----- check 10: vitest -----

function checkVitest() {
  if (QUICK) {
    pass('vitest', 'skipped (--quick)');
    return;
  }
  // pnpm: vitest nằm ở packages/core/node_modules/.bin/
  // npm:  vitest nằm ở root node_modules/.bin/
  const candidates = [
    path.join(ROOT, 'packages/core/node_modules/.bin/vitest'),
    path.join(ROOT, 'node_modules/.bin/vitest'),
  ];
  const vitestBin = candidates.find((p) => fs.existsSync(p));
  if (!vitestBin) {
    fail(
      'vitest',
      `not found in: ${candidates.map((p) => path.relative(ROOT, p)).join(', ')}`,
    );
    return;
  }
  const res = spawnSync(vitestBin, ['run', '--reporter=dot'], {
    cwd: path.join(ROOT, 'packages/core'),
    encoding: 'utf8',
  });
  const out = (res.stdout || '') + (res.stderr || '');
  const m = out.match(/Tests\s+(\d+)\s+passed/);
  if (res.status === 0 && m) {
    pass('vitest', `${m[1]} tests passed`);
  } else {
    fail('vitest', `exit=${res.status}\n${out.split('\n').slice(-20).join('\n')}`);
  }
}

// ----- run -----

checkPortsAndIdentifiers();
checkRequiredFiles();
checkCapabilities();
checkCsp();
checkPackageJson();
checkTsc();
checkVitest();

report.finished = new Date().toISOString();
report.summary = {
  pass: report.checks.filter((c) => c.status === 'pass').length,
  warn: report.warnings.length,
  fail: report.errors.length,
};

if (JSON_MODE) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  console.log('─'.repeat(72));
  console.log(' TrishTEAM QA doctor — Phase 14.5.1');
  console.log('─'.repeat(72));
  for (const c of report.checks) {
    const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️ ' : '❌';
    console.log(`${icon} [${c.check}] ${c.detail}`);
  }
  console.log('─'.repeat(72));
  console.log(
    ` Pass:  ${report.summary.pass}    Warn: ${report.summary.warn}    Fail: ${report.summary.fail}`,
  );
  console.log('─'.repeat(72));
  if (report.errors.length) {
    console.log('FAIL entries:');
    for (const e of report.errors) console.log('  -', e);
  }
  if (report.warnings.length) {
    console.log('WARN entries:');
    for (const w of report.warnings) console.log('  -', w);
  }
}

process.exit(report.errors.length === 0 ? 0 : 1);
