#!/usr/bin/env node
/**
 * gen-tokens.js — sinh tokens.css (web) + tokens.qss.py (desktop) từ tokens.json.
 *
 * Cách dùng:
 *   node scripts/gen-tokens.js
 *
 * Output:
 *   website/assets/tokens.css
 *   shared/trishteam_core/src/trishteam_core/ui/tokens.py
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, "design/tokens.json"), "utf8"));

// ---------- 1) CSS output ----------
const cssLines = [
  "/* AUTO-GENERATED from design/tokens.json — DO NOT EDIT BY HAND */",
  ":root {",
];

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("_")) continue;
    const name = prefix ? `${prefix}-${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, name, out);
    } else {
      out.push(`  --${name}: ${v};`);
    }
  }
}

for (const group of ["color", "font", "space", "radius", "shadow", "motion", "zIndex"]) {
  if (!tokens[group]) continue;
  cssLines.push(`  /* ${group} */`);
  flatten(tokens[group], group, cssLines);
}
cssLines.push("}", "");

const cssPath = path.join(ROOT, "website/assets/tokens.css");
fs.mkdirSync(path.dirname(cssPath), { recursive: true });
fs.writeFileSync(cssPath, cssLines.join("\n"));
console.log(`✓ wrote ${path.relative(ROOT, cssPath)}`);

// ---------- 2) Python tokens module (for QSS generation) ----------
const pyLines = [
  '"""AUTO-GENERATED from design/tokens.json — DO NOT EDIT BY HAND.',
  "",
  "Dùng module này trong PyQt6 để dựng QSS:",
  "    from trishteam_core.ui.tokens import COLOR, FONT, SPACE",
  '"""',
  "",
  "from types import SimpleNamespace",
  "",
];

function emitPy(name, obj) {
  const safe = (v) => (typeof v === "string" ? JSON.stringify(v) : v);
  const entries = Object.entries(obj)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => {
      const key = /^\d/.test(k) ? `n${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const nested = Object.entries(v)
          .filter(([kk]) => !kk.startsWith("_"))
          .map(([kk, vv]) => {
            const kkey = /^\d/.test(kk) ? `n${kk}` : kk;
            return `        ${kkey}=${safe(vv)}`;
          })
          .join(",\n");
        return `    ${key}=SimpleNamespace(\n${nested}\n    )`;
      }
      return `    ${key}=${safe(v)}`;
    })
    .join(",\n");
  return `${name.toUpperCase()} = SimpleNamespace(\n${entries}\n)\n`;
}

pyLines.push(emitPy("color",  tokens.color));
pyLines.push(emitPy("font",   tokens.font));
pyLines.push(emitPy("space",  tokens.space));
pyLines.push(emitPy("radius", tokens.radius));
pyLines.push(emitPy("shadow", tokens.shadow));
pyLines.push(emitPy("motion", tokens.motion));

const pyPath = path.join(ROOT, "shared/trishteam_core/src/trishteam_core/ui/tokens.py");
fs.mkdirSync(path.dirname(pyPath), { recursive: true });
fs.writeFileSync(pyPath, pyLines.join("\n"));
console.log(`✓ wrote ${path.relative(ROOT, pyPath)}`);

console.log("\nDone. Import in web: <link rel=\"stylesheet\" href=\"/assets/tokens.css\">");
console.log("Import in Python: from trishteam_core.ui.tokens import COLOR");
