# scripts/fetch-tessdata.ps1
# Phase 38.2.0 - Tai tessdata_best (vie + eng) cho TrishLibrary OCR.
#
# Chay TU DONG truoc 'tauri build' qua package.json script tauri:build.
# Co the chay thu cong: pwsh scripts\fetch-tessdata.ps1
#
# File traineddata duoc bundle vao NSIS installer qua tauri.conf.json bundle.resources.
# Khi user chay app lan dau, Rust command 'ensure_tessdata_first_run' copy tu
# resource_dir() sang %APPDATA%\TrishLibrary\tessdata_best\

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$resourcesDir = Join-Path $repoRoot "apps-desktop\trishlibrary\src-tauri\resources\tessdata_best"

# URL tessdata_best chinh thuc tu Google
$baseUrl = "https://github.com/tesseract-ocr/tessdata_best/raw/main"
$langs = @("vie", "eng")

# Min size sanity check (file that ~30-40MB; neu < 1MB la tai fail)
$minBytes = 1MB

Write-Host "=== Fetch tessdata_best (Phase 38.2.0) ===" -ForegroundColor Cyan
Write-Host "Target: $resourcesDir"
Write-Host ""

if (-not (Test-Path $resourcesDir)) {
    New-Item -ItemType Directory -Force -Path $resourcesDir | Out-Null
}

foreach ($lang in $langs) {
    $outFile = Join-Path $resourcesDir "$lang.traineddata"
    $url = "$baseUrl/$lang.traineddata"

    if ((Test-Path $outFile) -and ((Get-Item $outFile).Length -gt $minBytes)) {
        $sz = [math]::Round((Get-Item $outFile).Length / 1MB, 1)
        Write-Host "[SKIP] $lang.traineddata ($sz MB) - da co" -ForegroundColor DarkGray
        continue
    }

    Write-Host "[GET ] $lang.traineddata ..." -ForegroundColor Yellow -NoNewline

    try {
        # Dung curl.exe (Windows 10+ co san) - nhanh hon Invoke-WebRequest
        & curl.exe -L -s -o $outFile $url
        if ($LASTEXITCODE -ne 0) { throw "curl exit code $LASTEXITCODE" }

        if ((Get-Item $outFile).Length -lt $minBytes) {
            throw "file < 1MB (tai fail?)"
        }
        $sz = [math]::Round((Get-Item $outFile).Length / 1MB, 1)
        Write-Host " OK ($sz MB)" -ForegroundColor Green
    } catch {
        Write-Host " FAIL: $_" -ForegroundColor Red
        if (Test-Path $outFile) { Remove-Item $outFile -Force }
        exit 1
    }
}

Write-Host ""
Write-Host "Done. Tessdata bundle ready trong $resourcesDir" -ForegroundColor Cyan
