# Phase 17.3 Layer 3 - Download Tesseract + PDFium binaries for OCR.
#
# Output structure:
#   src-tauri/binaries/tesseract-x86_64-pc-windows-msvc.exe   (Tauri sidecar)
#   src-tauri/resources/tessdata/vie.traineddata
#   src-tauri/resources/tessdata/eng.traineddata
#   src-tauri/resources/pdfium/pdfium.dll
#
# Sources (all open-source, no auth):
#   - Tesseract: UB-Mannheim portable build (Apache 2.0)
#   - Tessdata: github.com/tesseract-ocr/tessdata_best (Apache 2.0)
#   - PDFium: bblanchon/pdfium-binaries (Apache 2.0)

$appRoot = Resolve-Path "$PSScriptRoot\.."
$binariesDir = Join-Path $appRoot "src-tauri\binaries"
$tessdataDir = Join-Path $appRoot "src-tauri\resources\tessdata"
$pdfiumDir   = Join-Path $appRoot "src-tauri\resources\pdfium"

Write-Host ""
Write-Host "==> TrishSearch - Download OCR bundles" -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Path $binariesDir -Force | Out-Null
New-Item -ItemType Directory -Path $tessdataDir -Force | Out-Null
New-Item -ItemType Directory -Path $pdfiumDir -Force | Out-Null

# ============================================================
# 1) Tesseract portable .exe (manual)
# ============================================================
$tesseractTarget = Join-Path $binariesDir "tesseract-x86_64-pc-windows-msvc.exe"
if (Test-Path $tesseractTarget) {
    Write-Host "[1/4] Tesseract.exe already exists, skip." -ForegroundColor Yellow
} else {
    Write-Host "[1/4] Tesseract.exe MISSING - manual setup needed:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Step 1: Download installer from:" -ForegroundColor White
    Write-Host "          https://github.com/UB-Mannheim/tesseract/wiki" -ForegroundColor Cyan
    Write-Host "  Step 2: Install to default C:\Program Files\Tesseract-OCR\" -ForegroundColor White
    Write-Host "  Step 3: Copy ALL .exe + .dll files (NOT tessdata folder) from" -ForegroundColor White
    Write-Host "          C:\Program Files\Tesseract-OCR\* into:" -ForegroundColor White
    Write-Host "          $binariesDir" -ForegroundColor Cyan
    Write-Host "  Step 4: RENAME tesseract.exe -> tesseract-x86_64-pc-windows-msvc.exe" -ForegroundColor White
    Write-Host "  Step 5: Re-run this script to verify." -ForegroundColor White
    Write-Host ""
}

# ============================================================
# 2) Vietnamese tessdata (~30MB)
# ============================================================
$vieTarget = Join-Path $tessdataDir "vie.traineddata"
if (Test-Path $vieTarget) {
    Write-Host "[2/4] vie.traineddata already exists, skip." -ForegroundColor Yellow
} else {
    Write-Host "[2/4] Downloading vie.traineddata (Vietnamese model, ~30MB)..." -NoNewline
    try {
        $url = "https://github.com/tesseract-ocr/tessdata_best/raw/main/vie.traineddata"
        Invoke-WebRequest -Uri $url -OutFile $vieTarget -UseBasicParsing
        $sizeMB = [math]::Round((Get-Item $vieTarget).Length / 1MB, 1)
        Write-Host " OK ($sizeMB MB)" -ForegroundColor Green
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================
# 3) English tessdata (~5MB)
# ============================================================
$engTarget = Join-Path $tessdataDir "eng.traineddata"
if (Test-Path $engTarget) {
    Write-Host "[3/4] eng.traineddata already exists, skip." -ForegroundColor Yellow
} else {
    Write-Host "[3/4] Downloading eng.traineddata (English model, ~5MB)..." -NoNewline
    try {
        $url = "https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata"
        Invoke-WebRequest -Uri $url -OutFile $engTarget -UseBasicParsing
        $sizeMB = [math]::Round((Get-Item $engTarget).Length / 1MB, 1)
        Write-Host " OK ($sizeMB MB)" -ForegroundColor Green
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================
# 4) PDFium DLL (Bblanchon prebuilt, ~7MB)
# ============================================================
$pdfiumTarget = Join-Path $pdfiumDir "pdfium.dll"
if (Test-Path $pdfiumTarget) {
    Write-Host "[4/4] pdfium.dll already exists, skip." -ForegroundColor Yellow
} else {
    Write-Host "[4/4] Downloading PDFium DLL (Bblanchon prebuilt, ~7MB)..." -NoNewline
    try {
        $apiUrl = "https://api.github.com/repos/bblanchon/pdfium-binaries/releases/latest"
        $release = Invoke-RestMethod -Uri $apiUrl -Headers @{'User-Agent'='trishsearch'}
        $asset = $release.assets | Where-Object { $_.name -eq 'pdfium-windows-x64.tgz' } | Select-Object -First 1
        if (-not $asset) {
            throw "Asset pdfium-windows-x64.tgz not found in latest release"
        }
        $tmpTgz = Join-Path $env:TEMP "pdfium-windows-x64.tgz"
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmpTgz -UseBasicParsing

        $tmpExtract = Join-Path $env:TEMP "pdfium-extract-$(Get-Random)"
        New-Item -ItemType Directory -Path $tmpExtract -Force | Out-Null
        & tar -xzf $tmpTgz -C $tmpExtract
        $extractedDll = Join-Path $tmpExtract "bin\pdfium.dll"
        if (-not (Test-Path $extractedDll)) {
            $extractedDll = Get-ChildItem -Path $tmpExtract -Recurse -Filter "pdfium.dll" |
                Select-Object -First 1 -ExpandProperty FullName
        }
        if (-not (Test-Path $extractedDll)) {
            throw "pdfium.dll not found after extraction"
        }
        Copy-Item $extractedDll $pdfiumTarget -Force
        Remove-Item $tmpTgz -Force -ErrorAction SilentlyContinue
        Remove-Item $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue

        $sizeMB = [math]::Round((Get-Item $pdfiumTarget).Length / 1MB, 1)
        Write-Host " OK ($sizeMB MB, $($release.tag_name))" -ForegroundColor Green
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[Summary]" -ForegroundColor Cyan
$haveTesseract = Test-Path $tesseractTarget
$haveVie = Test-Path $vieTarget
$haveEng = Test-Path $engTarget
$havePdfium = Test-Path $pdfiumTarget

$tessIcon = if ($haveTesseract) { "[OK]" } else { "[MISSING - copy manually]" }
$vieIcon = if ($haveVie) { "[OK]" } else { "[MISSING]" }
$engIcon = if ($haveEng) { "[OK]" } else { "[MISSING]" }
$pdfIcon = if ($havePdfium) { "[OK]" } else { "[MISSING]" }

Write-Host "  Tesseract.exe ........ $tessIcon"
Write-Host "  vie.traineddata ...... $vieIcon"
Write-Host "  eng.traineddata ...... $engIcon"
Write-Host "  pdfium.dll ........... $pdfIcon"

Write-Host ""
if ($haveTesseract -and $haveVie -and $haveEng -and $havePdfium) {
    Write-Host "[OK] All OCR bundles ready." -ForegroundColor Green
    Write-Host ""
    Write-Host "NEXT STEP: Edit src-tauri/tauri.conf.json:" -ForegroundColor Yellow
    Write-Host "  Rename _resources_disabled -> resources" -ForegroundColor White
    Write-Host "  Rename _externalBin_disabled -> externalBin" -ForegroundColor White
    Write-Host "  Then run pnpm tauri dev" -ForegroundColor White
} else {
    Write-Host "[!] Some bundles missing. Complete manual steps above and re-run." -ForegroundColor Yellow
}
Write-Host ""
