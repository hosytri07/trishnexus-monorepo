# Wrapper (13-09) — de app "S-RETC Builder & Release" phat hanh trishfinance voi ho so:
#   repo_root = thu muc app nay, script_path = scripts\PHAT-HANH.ps1, release_repo = hosytri07/trishfinance-releases
# Toan bo logic o ..\..\..\scripts\PHAT-HANH-APP.ps1 (dung chung 4 app).
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$Notes,
    [switch]$SkipBuild
)
# 13-09: loi PHAN TICH (parse) trong script chung phai tra exit 1 — truoc day loi bi nuot, Builder tuong xong.
$ErrorActionPreference = 'Stop'
$Shared = Join-Path $PSScriptRoot '..\..\..\scripts\PHAT-HANH-APP.ps1'
try {
& $Shared -App 'trishfinance' -Version $Version -Notes $Notes -SkipBuild:$SkipBuild
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
} catch { Write-Host "X $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
exit 0
