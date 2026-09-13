# PHAT-HANH-APP.ps1 — phat hanh MOT app Tauri trong trishnexus-monorepo bang MOT lenh (13-09),
# CUNG GIAO DIEN voi PHAT-HANH.ps1 cua S-RETC/TrishQR de app "S-RETC Builder & Release" goi duoc.
#
#   .\scripts\PHAT-HANH-APP.ps1 -App trishwork -Version 1.0.1 -Notes "Sua loi..." [-SkipBuild]
#
# Builder KHONG truyen -App: moi app co wrapper apps-desktop/<app>/scripts/PHAT-HANH.ps1 goi file nay.
# Ho so Builder cho tung app:
#   repo_root    = ...\trishnexus-monorepo\apps-desktop\<app>
#   script_path  = scripts\PHAT-HANH.ps1
#   release_repo = hosytri07/<app>-releases        (gh repo create hosytri07/<app>-releases --public)
#   key_path     = $HOME\.tauri\sretc.key neu app da bat updater (co pubkey trong tauri.conf.json), khong thi TRONG
#
# Lam TAT CA: ghi version vao tauri.conf.json + package.json -> pnpm tauri build (ky neu co khoa)
# -> latest.json (dinh dang Tauri updater + sha256) -> ban ten co dinh <Product>-Setup.exe
# -> GitHub Release (tu tao commit dau neu repo rong).
# Tag la v<version> (KHAC quy uoc cu <app>-v1.0.0 trong repo trishnexus-monorepo) vi moi app mot repo release.

param(
    [Parameter(Mandatory = $true)][string]$App,
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$Notes,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
if ($PSStyle) { $PSStyle.OutputRendering = 'PlainText' }   # log trong Builder khong bi ma mau ANSI
$RepoRoot = Split-Path -Parent $PSScriptRoot      # trishnexus-monorepo
Set-Location $RepoRoot

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "X Version phai dang x.y.z (vd 1.0.1), nhan duoc: $Version" -ForegroundColor Red; exit 1
}
$AppDir = Join-Path $RepoRoot "apps-desktop\$App"
if (-not (Test-Path $AppDir)) { Write-Host "X Khong thay app: $AppDir" -ForegroundColor Red; exit 1 }
$ConfPath = Join-Path $AppDir 'src-tauri\tauri.conf.json'
$PkgPath  = Join-Path $AppDir 'package.json'
$conf = Get-Content $ConfPath -Raw -Encoding UTF8 | ConvertFrom-Json
$pkg  = Get-Content $PkgPath  -Raw -Encoding UTF8 | ConvertFrom-Json
$Product = $conf.productName                     # vd TrishWork
$Filter  = $pkg.name                             # vd @trishteam/trishwork
$ReleaseRepo = "hosytri07/$App-releases"
$Signed = ($conf.plugins -and $conf.plugins.updater -and $conf.plugins.updater.pubkey)

# ── 0. Kiem cong cu ─────────────────────────────────────────────────────────
foreach ($t in 'pnpm', 'gh') {
    if (-not (Get-Command $t -ErrorAction SilentlyContinue)) { Write-Host "X Thieu $t." -ForegroundColor Red; exit 1 }
}
if ($Signed) {
    $KeyPath = if ($env:TAURI_SIGNING_PRIVATE_KEY_PATH) { $env:TAURI_SIGNING_PRIVATE_KEY_PATH } else { Join-Path $HOME '.tauri\sretc.key' }
    if (-not (Test-Path $KeyPath)) { Write-Host "X App co pubkey updater nhung khong thay khoa ky: $KeyPath" -ForegroundColor Red; exit 1 }
    $env:TAURI_SIGNING_PRIVATE_KEY = $KeyPath
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Read-Host 'Mat khau khoa ky' }
    Write-Host "> ${Product}: co updater -> build se KY (.sig)" -ForegroundColor Cyan
} else {
    # Khong co pubkey -> Tauri khong ky; xoa bien de build khong doi khoa.
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
    Write-Host "> ${Product}: CHUA bat updater trong tauri.conf.json -> phat hanh khong ky, user cai tay ban moi" -ForegroundColor Yellow
}

# ── 1. Ghi version: tauri.conf.json + package.json (Cargo.toml khong bat buoc) ──
function Set-VersionInJson([string]$Path, [string]$Old, [string]$New) {
    if ($Old -eq $New) { return }
    $raw = Get-Content $Path -Raw -Encoding UTF8
    $rx = [regex]('"version":\s*"' + [regex]::Escape($Old) + '"')
    $raw = $rx.Replace($raw, ('"version": "' + $New + '"'), 1)
    [System.IO.File]::WriteAllText($Path, $raw, (New-Object System.Text.UTF8Encoding $false))
}
Set-VersionInJson $ConfPath $conf.version $Version
Set-VersionInJson $PkgPath  $pkg.version  $Version
Write-Host "> $Product version: $($conf.version) -> $Version" -ForegroundColor Cyan

# ── 2. Build ────────────────────────────────────────────────────────────────
$Bundle = Join-Path $AppDir 'src-tauri\target\release\bundle\nsis'
$Exe = Join-Path $Bundle "${Product}_${Version}_x64-setup.exe"
if (-not $SkipBuild) {
    Write-Host "`n=== BUILD $Product v$Version (10-20 phut) ===" -ForegroundColor Cyan
    pnpm --filter $Filter tauri build
    if ($LASTEXITCODE -ne 0) { Write-Host 'X Build loi — dung.' -ForegroundColor Red; exit 1 }
}
if (-not (Test-Path $Exe)) { Write-Host "X Thieu tep: $Exe" -ForegroundColor Red; exit 1 }
$Sig = "$Exe.sig"
if ($Signed -and -not (Test-Path $Sig)) { Write-Host "X Thieu chu ky: $Sig (bundle.createUpdaterArtifacts phai = true)" -ForegroundColor Red; exit 1 }

# ── 3. SHA256 + latest.json + ban ten co dinh ───────────────────────────────
$Sha = (Get-FileHash $Exe -Algorithm SHA256).Hash.ToLower()
$SizeBytes = (Get-Item $Exe).Length
$Url = "https://github.com/$ReleaseRepo/releases/download/v$Version/$([System.IO.Path]::GetFileName($Exe))"
$Win = [ordered]@{ url = $Url; sha256 = $Sha; size = $SizeBytes }
if ($Signed) { $Win.signature = (Get-Content $Sig -Raw).Trim() }   # Tauri updater doc truong nay
# CHU Y: ten bien KHONG phan biet hoa/thuong trong PowerShell -> dung LatestData/LatestPath.
$LatestData = [ordered]@{
    version   = $Version
    notes     = $Notes
    pub_date  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    platforms = [ordered]@{ 'windows-x86_64' = $Win }
}
$LatestPath = Join-Path $Bundle 'latest.json'
[System.IO.File]::WriteAllText($LatestPath, ($LatestData | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false))
$check = Get-Content $LatestPath -Raw | ConvertFrom-Json
if (-not $check.version) { Write-Host 'X latest.json sinh ra khong hop le.' -ForegroundColor Red; exit 1 }
$Stable = Join-Path $Bundle "$Product-Setup.exe"
Copy-Item $Exe $Stable -Force
Write-Host ("> SHA256: $Sha`n> Size: {0:N1} MB" -f ($SizeBytes / 1MB)) -ForegroundColor Cyan

# ── 4. GitHub Release ──────────────────────────────────────────────────────
gh repo view $ReleaseRepo 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "> Chua co repo $ReleaseRepo - tao moi (public, de app/user tai duoc)..." -ForegroundColor Yellow
    gh repo create $ReleaseRepo --public --description "$Product releases (TrishTEAM)" | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host 'X Khong tao duoc repo phat hanh.' -ForegroundColor Red; exit 1 }
}
gh api "repos/$ReleaseRepo/commits?per_page=1" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host '> Repo phat hanh con rong - tao commit dau (README.md)...' -ForegroundColor Yellow
    $readme = "# $Product releases`n`nBan phat hanh $Product (TrishTEAM). App tu cap nhat doc latest.json o releases/latest.`n"
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($readme))
    gh api -X PUT "repos/$ReleaseRepo/contents/README.md" -f message='init: README' -f content="$b64" | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host 'X Khong tao duoc commit dau cho repo phat hanh.' -ForegroundColor Red; exit 1 }
}
$Files = @("$Exe", "$LatestPath", "$Stable")
if ($Signed) { $Files += "$Sig" }
Write-Host "`n=== TAO RELEASE v$Version tren $ReleaseRepo ===" -ForegroundColor Cyan
gh release create "v$Version" --repo $ReleaseRepo --title "$Product v$Version" --notes "$Notes`n`nSHA256: $Sha" @Files
if ($LASTEXITCODE -ne 0) {
    Write-Host 'X Tao release loi. Neu tag da ton tai: xoa release cu roi chay lai voi -SkipBuild.' -ForegroundColor Red
    exit 1
}
Write-Host "`n=== XONG — $Product v$Version da phat hanh ===" -ForegroundColor Green
if (-not $Signed) { Write-Host 'Luu y: app nay chua bat updater -> user khong tu nhan ban moi, phai tai tay tu web.' -ForegroundColor Yellow }
Write-Host "Viec con lai (tuy chon): git add -A ; git commit -m `"$Product v$Version`" ; git push"
