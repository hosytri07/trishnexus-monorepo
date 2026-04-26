# Phase 17.2 - Setup logo + OS icons for TrishNote.

$repoRoot = Resolve-Path "$PSScriptRoot\..\..\.."
$srcLogo  = Join-Path $repoRoot "apps-desktop\trishlauncher\src\icons\trishnote.png"
$appRoot  = Join-Path $repoRoot "apps-desktop\trishnote"
$assetsDir = Join-Path $appRoot "src\assets"
$assetsLogo = Join-Path $assetsDir "logo.png"

Write-Host ""
Write-Host "==> TrishNote - Setup icons" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $srcLogo)) {
    Write-Host "[X] Source logo not found: $srcLogo" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] Copy logo for in-app topbar..." -NoNewline
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

Write-Host "[2/3] Generate OS icons via Tauri CLI..." -ForegroundColor Cyan
Push-Location $appRoot
try {
    & pnpm tauri icon "src\assets\logo.png"
    $iconExit = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($iconExit -ne 0) {
    Write-Host "[X] tauri icon failed (exit $iconExit)" -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] Invalidate Cargo cache (force re-embed icon)..." -NoNewline
$targetDir = Join-Path $appRoot "src-tauri\target"
if (Test-Path $targetDir) {
    foreach ($mode in @("debug", "release")) {
        $modeDir = Join-Path $targetDir $mode
        if (-not (Test-Path $modeDir)) { continue }
        $exePath = Join-Path $modeDir "trishnote.exe"
        if (Test-Path $exePath) { Remove-Item $exePath -Force -ErrorAction SilentlyContinue }
        $buildOutDir = Join-Path $modeDir "build"
        if (Test-Path $buildOutDir) {
            Get-ChildItem $buildOutDir -Directory -Filter "trishnote-*" |
                ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
        }
        $depsDir = Join-Path $modeDir "deps"
        if (Test-Path $depsDir) {
            Get-ChildItem $depsDir -Filter "trishnote*" |
                ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
        }
    }
}
Write-Host " OK" -ForegroundColor Green

Write-Host ""
Write-Host "[OK] Setup icons done. Run 'pnpm tauri build' to release v2.0.0-1." -ForegroundColor Green
Write-Host ""
