# ============================================================
# BUILD-RELEASE-v1.0.ps1
# Phase 41.3 — Build + Release 5 app v1.0.0
#
# Build:    TrishDrive, TrishFinance, TrishOffice, TrishLauncher, TrishAdmin
# Release:  4 app public (skip TrishAdmin — internal tool, không lên GitHub Release)
#
# Yêu cầu:
#   - GitHub CLI (gh) đã login: gh auth login
#   - pnpm + Rust + Tauri 2 đã setup (chạy SETUP.bat 1 lần)
#
# Usage:
#   1. Mở PowerShell as Admin
#   2. cd C:\Users\ADMIN\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
#   3. .\scripts\BUILD-RELEASE-v1.0.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT = "C:\Users\ADMIN\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo"
Set-Location $ROOT

# Apps để build (theo thứ tự dep: core libraries trước, app sau)
$APPS = @(
    @{ Name = "trishlauncher"; Tag = "trishlauncher-v1.0.0"; Public = $true; Title = "TrishLauncher 1.0" },
    @{ Name = "trishadmin";    Tag = "trishadmin-v1.0.0";    Public = $false; Title = "TrishAdmin 1.0 (internal)" },
    @{ Name = "trishoffice";   Tag = "trishoffice-v1.0.0";   Public = $true; Title = "TrishOffice 1.0" },
    @{ Name = "trishdrive";    Tag = "trishdrive-v1.0.0";    Public = $true; Title = "TrishDrive 1.0" },
    @{ Name = "trishfinance";  Tag = "trishfinance-v1.0.0";  Public = $true; Title = "TrishFinance 1.0" }
)

$BUILD_RESULTS = @()
$START_TIME = Get-Date

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  Phase 41.3 — Build + Release v1.0.0" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Pre-flight check
Write-Host "[Pre-flight] Check tools..." -ForegroundColor Yellow
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { Write-Host "❌ pnpm not found" -ForegroundColor Red; exit 1 }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { Write-Host "❌ cargo (Rust) not found" -ForegroundColor Red; exit 1 }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Write-Host "⚠ GitHub CLI (gh) not found — sẽ skip release, chỉ build" -ForegroundColor Yellow; $SKIP_RELEASE = $true }
else { $SKIP_RELEASE = $false }

# Install deps 1 lần
Write-Host "[Pre-flight] pnpm install..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) { Write-Host "❌ pnpm install failed" -ForegroundColor Red; exit 1 }

# Build packages/* trước (TS compile)
Write-Host "[Pre-flight] Build shared packages..." -ForegroundColor Yellow
pnpm -r --filter "./packages/*" build
if ($LASTEXITCODE -ne 0) { Write-Host "⚠ Some packages build failed — tiếp tục..." -ForegroundColor Yellow }

# Build từng app
foreach ($app in $APPS) {
    $name = $app.Name
    $title = $app.Title
    Write-Host ""
    Write-Host "═══ Build $title ═══" -ForegroundColor Green

    Set-Location "$ROOT\apps-desktop\$name"
    pnpm tauri build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build $name FAILED" -ForegroundColor Red
        $BUILD_RESULTS += @{ Name = $name; Status = "FAIL"; Path = $null; SHA256 = $null }
        Set-Location $ROOT
        continue
    }

    # Tìm .exe NSIS vừa build
    $exePattern = "$ROOT\apps-desktop\$name\src-tauri\target\release\bundle\nsis\*-setup.exe"
    $exe = Get-ChildItem $exePattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $exe) {
        Write-Host "❌ Không tìm thấy .exe ở $exePattern" -ForegroundColor Red
        $BUILD_RESULTS += @{ Name = $name; Status = "NO_EXE"; Path = $null; SHA256 = $null }
        Set-Location $ROOT
        continue
    }

    $sha = (Get-FileHash $exe.FullName -Algorithm SHA256).Hash.ToLower()
    Write-Host "✓ $name build OK" -ForegroundColor Green
    Write-Host "  Path:   $($exe.FullName)" -ForegroundColor Gray
    Write-Host "  Size:   $([math]::Round($exe.Length / 1MB, 2)) MB" -ForegroundColor Gray
    Write-Host "  SHA256: $sha" -ForegroundColor Gray

    $BUILD_RESULTS += @{
        Name = $name; Status = "OK"; Path = $exe.FullName; SHA256 = $sha;
        Tag = $app.Tag; Public = $app.Public; Title = $app.Title; Size = $exe.Length
    }
    Set-Location $ROOT
}

# Release public apps
if (-not $SKIP_RELEASE) {
    Write-Host ""
    Write-Host "═══ GitHub Release ═══" -ForegroundColor Cyan
    foreach ($r in $BUILD_RESULTS) {
        if ($r.Status -ne "OK") { continue }
        if (-not $r.Public) {
            Write-Host "⊘ Skip $($r.Name) (internal — không release public)" -ForegroundColor DarkGray
            continue
        }
        $tag = $r.Tag
        $title = $r.Title
        $exe = $r.Path

        Write-Host ""
        Write-Host "→ Release $tag" -ForegroundColor Yellow

        # Check tag tồn tại chưa → nếu có thì delete + upload mới
        $exists = gh release view $tag 2>&1 | Out-String
        if ($exists -notmatch "not found") {
            Write-Host "  Tag $tag đã tồn tại → delete + recreate" -ForegroundColor Yellow
            gh release delete $tag --yes --cleanup-tag 2>&1 | Out-Null
        }

        $notes = "Release $title — $(Get-Date -Format 'yyyy-MM-dd')`n`nSHA256: $($r.SHA256)`nSize: $([math]::Round($r.Size / 1MB, 2)) MB"
        gh release create $tag $exe --title $title --notes $notes
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Released $tag" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Release fail" -ForegroundColor Red
        }
    }
}

# Print apps-registry.json update commands
Write-Host ""
Write-Host "═══ Cập nhật apps-registry.json ═══" -ForegroundColor Cyan
Write-Host "Edit C:\Users\ADMIN\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\apps\website\public\apps-registry.json với SHA256 mới:" -ForegroundColor Yellow
foreach ($r in $BUILD_RESULTS) {
    if ($r.Status -eq "OK" -and $r.Public) {
        Write-Host ""
        Write-Host "  [$($r.Name)]" -ForegroundColor Magenta
        Write-Host "    url:    https://github.com/hosytri07/trishnexus-monorepo/releases/download/$($r.Tag)/$(Split-Path $r.Path -Leaf)" -ForegroundColor Gray
        Write-Host "    sha256: $($r.SHA256)" -ForegroundColor Gray
        Write-Host "    size:   $($r.Size)" -ForegroundColor Gray
    }
}

# Summary
$DURATION = (Get-Date) - $START_TIME
Write-Host ""
Write-Host "═══ Tổng kết ═══" -ForegroundColor Cyan
Write-Host "Thời gian:  $([math]::Round($DURATION.TotalMinutes, 1)) phút" -ForegroundColor Gray
$ok = ($BUILD_RESULTS | Where-Object { $_.Status -eq "OK" }).Count
$fail = ($BUILD_RESULTS | Where-Object { $_.Status -ne "OK" }).Count
Write-Host "Build OK:   $ok / $($APPS.Count)" -ForegroundColor Green
if ($fail -gt 0) {
    Write-Host "Build FAIL: $fail" -ForegroundColor Red
    $BUILD_RESULTS | Where-Object { $_.Status -ne "OK" } | ForEach-Object {
        Write-Host "  - $($_.Name): $($_.Status)" -ForegroundColor Red
    }
}
Write-Host ""
Write-Host "Bước tiếp:" -ForegroundColor Yellow
Write-Host "  1. Sửa apps\website\public\apps-registry.json với SHA256 trên" -ForegroundColor White
Write-Host "  2. cd apps\website && git add -A && git commit -m 'feat: release v1.0.0 5 app' && git push" -ForegroundColor White
Write-Host "  3. Vercel auto-deploy ~2 phút → registry mới live" -ForegroundColor White
Write-Host "  4. TrishLauncher auto-detect update khi user mở app" -ForegroundColor White
Write-Host ""
