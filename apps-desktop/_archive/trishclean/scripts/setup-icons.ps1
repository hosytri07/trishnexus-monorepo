# Phase 17.1 - Setup logo + OS icons for TrishClean.
# Copies trishclean.png from launcher icons + generates OS icon set.
#
# Usage:
#   cd apps-desktop\trishclean
#   .\scripts\setup-icons.ps1

$repoRoot = Resolve-Path "$PSScriptRoot\..\..\.."
$srcLogo  = Join-Path $repoRoot "apps-desktop\trishlauncher\src\icons\trishclean.png"
$appRoot  = Join-Path $repoRoot "apps-desktop\trishclean"
$assetsDir = Join-Path $appRoot "src\assets"
$assetsLogo = Join-Path $assetsDir "logo.png"

Write-Host ""
Write-Host "==> TrishClean - Setup icons" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $srcLogo)) {
    Write-Host "[X] Source logo not found: $srcLogo" -ForegroundColor Red
    Write-Host "    Place trishclean.png at apps-desktop\trishlauncher\src\icons\ first." -ForegroundColor Yellow
    exit 1
}

# Step 1: copy logo for in-app topbar (App.tsx imports './assets/logo.png')
Write-Host "[1/2] Copy logo for in-app topbar..." -NoNewline
try {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
    Copy-Item $srcLogo $assetsLogo -Force
    Write-Host " OK" -ForegroundColor Green
    Write-Host "      -> $assetsLogo"
} catch {
    Write-Host " FAIL" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Step 2: generate OS icons via Tauri CLI.
# IMPORTANT: pnpm/tauri-cli writes progress info to stderr.
# Don't use $ErrorActionPreference=Stop or 2>&1 redirect here, otherwise
# PowerShell wraps stderr in NativeCommandError exception even on success.
Write-Host "[2/2] Generate OS icons (32/128/.ico/.icns) via Tauri CLI..." -ForegroundColor Cyan
Push-Location $appRoot
try {
    & pnpm tauri icon "src\assets\logo.png"
    $iconExit = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($iconExit -ne 0) {
    Write-Host ""
    Write-Host "[X] tauri icon failed with exit code $iconExit" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "      -> src-tauri\icons\{32x32,128x128,128x128@2x,icon}.png + icon.ico + icon.icns" -ForegroundColor Gray

# Step 3: invalidate Cargo build cache so next build embeds new icon.ico into exe.
# Cargo doesn't auto-detect resource file changes — must delete build artifacts
# of trishclean crate so build.rs re-runs and embeds new icon.
Write-Host ""
Write-Host "[3/3] Invalidate Cargo cache (force re-embed icon into exe)..." -NoNewline
$targetDir = Join-Path $appRoot "src-tauri\target"
if (Test-Path $targetDir) {
    # Delete only our crate's build outputs, not whole target (preserves deps cache)
    foreach ($mode in @("debug", "release")) {
        $modeDir = Join-Path $targetDir $mode
        if (-not (Test-Path $modeDir)) { continue }
        # Remove final exe so cargo re-links
        $exePath = Join-Path $modeDir "trishclean.exe"
        if (Test-Path $exePath) { Remove-Item $exePath -Force -ErrorAction SilentlyContinue }
        # Remove build script output (where icon embedding happens)
        $buildOutDir = Join-Path $modeDir "build"
        if (Test-Path $buildOutDir) {
            Get-ChildItem $buildOutDir -Directory -Filter "trishclean-*" |
                ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
        }
        # Remove the .d files for trishclean which track resource deps
        $depsDir = Join-Path $modeDir "deps"
        if (Test-Path $depsDir) {
            Get-ChildItem $depsDir -Filter "trishclean*" |
                ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
        }
    }
}
Write-Host " OK" -ForegroundColor Green

Write-Host ""
Write-Host "[OK] Setup icons done. Restart 'pnpm tauri dev' to see new logo." -ForegroundColor Green
Write-Host "     (Next build will be ~30-60s slower since trishclean crate must re-link)" -ForegroundColor Gray
Write-Host ""
