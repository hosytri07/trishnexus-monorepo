# Wrapper (13-09) — de app "S-RETC Builder & Release" phat hanh trishwork voi ho so:
#   repo_root = thu muc app nay, script_path = scripts\PHAT-HANH.ps1, release_repo = hosytri07/trishwork-releases
# Toan bo logic o ..\..\..\scripts\PHAT-HANH-APP.ps1 (dung chung 4 app).
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$Notes,
    [switch]$SkipBuild
)
$Shared = Join-Path $PSScriptRoot '..\..\..\scripts\PHAT-HANH-APP.ps1'
& $Shared -App 'trishwork' -Version $Version -Notes $Notes -SkipBuild:$SkipBuild
exit $LASTEXITCODE
