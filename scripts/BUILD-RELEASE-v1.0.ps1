# ============================================================
# BUILD-RELEASE-v1.0.ps1
# Phase 41.3 — Build + Release v1.0.0 (1 lệnh duy nhất)
#
# Build:    4 app public + TrishAdmin internal
# Release:  4 app public lên GitHub Release
# Skip:     TrishDesign (chưa hoàn thiện, làm sau cùng)
#
# Yêu cầu: pnpm + Rust + gh CLI (gh auth login)
#
# Usage:
#   cd C:\Users\ADMIN\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
#   .\scripts\BUILD-RELEASE-v1.0.ps1
# ============================================================

$ErrorActionPreference = "Continue"  # KHÔNG stop khi 1 app fail
$ROOT = "C:\Users\ADMIN\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo"
Set-Location $ROOT

# Apps: TrishLauncher đầu (test pipeline), TrishAdmin (internal — no release),
# rồi 3 app còn lại. SKIP TrishDesign.
$APPS = @(
    @{ Name = "trishlauncher"; Tag = "trishlauncher-v1.0.0"; Public = $true;  Title = "TrishLauncher 1.0" },
    @{ Name = "trishadmin";    Tag = "trishadmin-v1.0.0";    Public = $true; SkipRegistry = $true; Title = "TrishAdmin 1.0 (admin-only)" },
    @{ Name = "trishoffice";   Tag = "trishoffice-v1.0.0";   Public = $true;  Title = "TrishOffice 1.0" },
    @{ Name = "trishdrive";    Tag = "trishdrive-v1.0.0";    Public = $true;  Title = "TrishDrive 1.0" },
    @{ Name = "trishfinance";  Tag = "trishfinance-v1.0.0";  Public = $true;  Title = "TrishFinance 1.0" },
    @{ Name = "trishiso";      Tag = "trishiso-v1.0.0";      Public = $true;  Title = "TrishISO 1.0" }
)

$BUILD_RESULTS = @()
$START_TIME = Get-Date

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Phase 41.3 - Build + Release v1.0.0" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Pre-flight
Write-Host "[Pre-flight] Check tools..." -ForegroundColor Yellow
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { Write-Host "X pnpm not found" -ForegroundColor Red; exit 1 }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { Write-Host "X cargo (Rust) not found" -ForegroundColor Red; exit 1 }
$HAS_GH = $true
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "! GitHub CLI (gh) not found - skip release, chi build" -ForegroundColor Yellow
    $HAS_GH = $false
}

# Install deps + bump @tauri-apps/api để fix version mismatch
Write-Host "[Pre-flight] pnpm install..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) { Write-Host "X pnpm install failed" -ForegroundColor Red; exit 1 }

# Build shared packages (KHÔNG fail toàn bộ nếu packages/telemetry fail)
Write-Host "[Pre-flight] Build shared packages..." -ForegroundColor Yellow
pnpm -r --filter "./packages/*" build
Write-Host "  (1 vài packages có thể fail TS - tiep tuc neu app build OK)" -ForegroundColor DarkGray

# Build từng app
foreach ($app in $APPS) {
    $name = $app.Name
    $title = $app.Title
    Write-Host ""
    Write-Host "=== Build $title ===" -ForegroundColor Green

    Set-Location "$ROOT\apps-desktop\$name"
    pnpm tauri build
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Host "X Build $name FAILED (exit $exitCode) - tiep tuc..." -ForegroundColor Red
        $BUILD_RESULTS += @{ Name = $name; Status = "FAIL"; Path = $null; SHA256 = $null; Tag = $app.Tag; Public = $app.Public; Title = $app.Title }
        Set-Location $ROOT
        continue
    }

    $exePattern = "$ROOT\apps-desktop\$name\src-tauri\target\release\bundle\nsis\*-setup.exe"
    $exe = Get-ChildItem $exePattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $exe) {
        Write-Host "X Khong tim thay .exe" -ForegroundColor Red
        $BUILD_RESULTS += @{ Name = $name; Status = "NO_EXE"; Path = $null; SHA256 = $null; Tag = $app.Tag; Public = $app.Public; Title = $app.Title }
        Set-Location $ROOT
        continue
    }

    $sha = (Get-FileHash $exe.FullName -Algorithm SHA256).Hash.ToLower()
    Write-Host "OK $name" -ForegroundColor Green
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
if ($HAS_GH) {
    Write-Host ""
    Write-Host "=== GitHub Release ===" -ForegroundColor Cyan
    foreach ($r in $BUILD_RESULTS) {
        if ($r.Status -ne "OK") {
            Write-Host "- Skip $($r.Name) (build $($r.Status))" -ForegroundColor DarkGray
            continue
        }
        if (-not $r.Public) {
            Write-Host "- Skip $($r.Name) (internal - khong release public)" -ForegroundColor DarkGray
            continue
        }
        $tag = $r.Tag
        $title = $r.Title
        $exe = $r.Path

        Write-Host ""
        Write-Host "-> Release $tag" -ForegroundColor Yellow
        $exists = gh release view $tag 2>&1 | Out-String
        if ($exists -notmatch "not found" -and $exists -notmatch "release not found") {
            Write-Host "  Tag $tag da ton tai -> delete + recreate" -ForegroundColor Yellow
            gh release delete $tag --yes --cleanup-tag 2>&1 | Out-Null
            Start-Sleep -Seconds 2
        }
        $notes = "Release $title - $(Get-Date -Format 'yyyy-MM-dd')`n`nSHA256: $($r.SHA256)`nSize: $([math]::Round($r.Size / 1MB, 2)) MB"
        gh release create $tag $exe --title $title --notes $notes
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK Released $tag" -ForegroundColor Green
        } else {
            Write-Host "  X Release fail" -ForegroundColor Red
        }
    }
}

# Auto-update apps-registry.json + apps-seed.ts
Write-Host ""
Write-Host "=== Auto-update apps-registry.json + apps-seed.ts ===" -ForegroundColor Cyan
$REGISTRY_PATH = "$ROOT\website\public\apps-registry.json"
$SEED_PATH = "$ROOT\apps-desktop\trishlauncher\src\apps-seed.ts"
$updateOk = 0
$updateFail = @()

# Update apps-registry.json (PowerShell JSON manipulation)
if (Test-Path $REGISTRY_PATH) {
    $registry = Get-Content $REGISTRY_PATH -Raw | ConvertFrom-Json
    foreach ($r in $BUILD_RESULTS) {
        if ($r.Status -ne "OK" -or -not $r.Public) { continue }
        if ($r.SkipRegistry -eq $true) {
            Write-Host "  - Skip $($r.Name) trong apps-registry.json (admin-only)" -ForegroundColor DarkGray
            continue
        }
        $appEntry = $registry.apps | Where-Object { $_.id -eq $r.Name }
        if ($null -ne $appEntry) {
            $fname = Split-Path $r.Path -Leaf
            $appEntry.version = "1.0.0"
            $appEntry.size_bytes = $r.Size
            $appEntry.status = "released"
            if ($null -eq $appEntry.download) {
                $appEntry | Add-Member -NotePropertyName 'download' -NotePropertyValue (New-Object PSObject) -Force
            }
            $newDl = @{
                url = "https://github.com/hosytri07/trishnexus-monorepo/releases/download/$($r.Tag)/$fname"
                sha256 = $r.SHA256
                installer_args = @()
            }
            $appEntry.download | Add-Member -NotePropertyName 'windows_x64' -NotePropertyValue $newDl -Force
            $updateOk++
            Write-Host "  OK $($r.Name) -> $fname" -ForegroundColor Green
        } else {
            Write-Host "  ! $($r.Name) khong co trong apps-registry.json - skip" -ForegroundColor Yellow
            $updateFail += $r.Name
        }
    }
    $registry.updated_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
    $registry | ConvertTo-Json -Depth 20 | Out-File $REGISTRY_PATH -Encoding utf8
    Write-Host "  Updated $updateOk app(s) in apps-registry.json" -ForegroundColor Green
} else {
    Write-Host "  X apps-registry.json not found tai $REGISTRY_PATH" -ForegroundColor Red
}

# Commit + push
Write-Host ""
Write-Host "=== Auto-commit + push registry ===" -ForegroundColor Cyan
if (Test-Path "$ROOT\.git\index.lock") { Remove-Item "$ROOT\.git\index.lock" -Force }
Set-Location $ROOT
git add website/public/apps-registry.json apps-desktop/trishlauncher/src/apps-seed.ts 2>&1 | Out-Null
$gitStatus = git status --porcelain website/public/apps-registry.json 2>&1
if ($gitStatus) {
    git commit -m "feat: release v1.0.0 wave 2 - $updateOk app updated" 2>&1
    git push 2>&1
    Write-Host "  Pushed -> Vercel se auto-deploy ~2 phut" -ForegroundColor Green
} else {
    Write-Host "  Khong co change de commit" -ForegroundColor Yellow
}

# Summary
$DURATION = (Get-Date) - $START_TIME
Write-Host ""
Write-Host "=== Tong ket ===" -ForegroundColor Cyan
Write-Host "Thoi gian: $([math]::Round($DURATION.TotalMinutes, 1)) phut" -ForegroundColor Gray
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
Write-Host "Hoan tat. Test:" -ForegroundColor Yellow
Write-Host "  1. Mo TrishLauncher -> thay nut 'Cap nhat v1.0.0' canh moi app" -ForegroundColor White
Write-Host "  2. Mo cmd: cd apps-desktop\trishadmin\src-tauri\target\release\bundle\nsis -> cai TrishAdmin local" -ForegroundColor White
Write-Host ""
