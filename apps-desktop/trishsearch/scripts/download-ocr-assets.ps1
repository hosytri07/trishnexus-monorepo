# Phase 17.3 Layer 3 - Download Tesseract.js + PDF.js assets cho frontend OCR.
#
# Output: public/tess/
#   - worker.min.js                      (~5KB)   - Tesseract.js worker
#   - tesseract-core-simd.wasm.js        (~70KB)  - WASM loader
#   - tesseract-core-simd.wasm           (~3MB)   - WASM binary
#   - tessdata/vie.traineddata.gz        (~12MB)  - Vietnamese model (gzipped)
#   - tessdata/eng.traineddata.gz        (~5MB)   - English model (gzipped)
#
# Total: ~20MB bundled vào installer.
# License: Apache 2.0 (Tesseract.js, tessdata_best, PDF.js)

$appRoot = Resolve-Path "$PSScriptRoot\.."
$tessDir = Join-Path $appRoot "public\tess"
$tessdataDir = Join-Path $tessDir "tessdata"

Write-Host ""
Write-Host "==> TrishSearch - Download OCR assets (Tesseract.js + tessdata)" -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Path $tessDir -Force | Out-Null
New-Item -ItemType Directory -Path $tessdataDir -Force | Out-Null

$TESSJS_VERSION = "5.1.1"
$TESSCORE_VERSION = "5.0.0"

# ============================================================
# 1) Tesseract.js worker.min.js
# ============================================================
$workerTarget = Join-Path $tessDir "worker.min.js"
if (Test-Path $workerTarget) {
    Write-Host "[1/4] worker.min.js exists, skip." -ForegroundColor Yellow
} else {
    Write-Host "[1/4] Downloading worker.min.js..." -NoNewline
    try {
        $url = "https://cdn.jsdelivr.net/npm/tesseract.js@$TESSJS_VERSION/dist/worker.min.js"
        Invoke-WebRequest -Uri $url -OutFile $workerTarget -UseBasicParsing
        $sizeKB = [math]::Round((Get-Item $workerTarget).Length / 1KB, 1)
        Write-Host " OK ($sizeKB KB)" -ForegroundColor Green
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================
# 2) Tesseract WASM loader (.wasm.js)
# ============================================================
$wasmJsTarget = Join-Path $tessDir "tesseract-core-simd.wasm.js"
if (Test-Path $wasmJsTarget) {
    Write-Host "[2/4] tesseract-core-simd.wasm.js exists, skip." -ForegroundColor Yellow
} else {
    Write-Host "[2/4] Downloading tesseract-core-simd.wasm.js..." -NoNewline
    try {
        $url = "https://cdn.jsdelivr.net/npm/tesseract.js-core@$TESSCORE_VERSION/tesseract-core-simd.wasm.js"
        Invoke-WebRequest -Uri $url -OutFile $wasmJsTarget -UseBasicParsing
        $sizeKB = [math]::Round((Get-Item $wasmJsTarget).Length / 1KB, 1)
        Write-Host " OK ($sizeKB KB)" -ForegroundColor Green
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================
# 3) Tesseract WASM binary
# ============================================================
$wasmTarget = Join-Path $tessDir "tesseract-core-simd.wasm"
if (Test-Path $wasmTarget) {
    Write-Host "[3/4] tesseract-core-simd.wasm exists, skip." -ForegroundColor Yellow
} else {
    Write-Host "[3/4] Downloading tesseract-core-simd.wasm..." -NoNewline
    try {
        $url = "https://cdn.jsdelivr.net/npm/tesseract.js-core@$TESSCORE_VERSION/tesseract-core-simd.wasm"
        Invoke-WebRequest -Uri $url -OutFile $wasmTarget -UseBasicParsing
        $sizeMB = [math]::Round((Get-Item $wasmTarget).Length / 1MB, 1)
        Write-Host " OK ($sizeMB MB)" -ForegroundColor Green
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================
# 4) Tessdata - Vietnamese + English (gzipped)
# ============================================================
$vieTarget = Join-Path $tessdataDir "vie.traineddata.gz"
$engTarget = Join-Path $tessdataDir "eng.traineddata.gz"

function Download-TraineddataGz($lang, $target) {
    if (Test-Path $target) {
        Write-Host "[$lang.traineddata.gz exists, skip.]" -ForegroundColor Yellow
        return
    }
    Write-Host "Downloading $lang.traineddata.gz..." -NoNewline
    try {
        # Tesseract.js host gzipped tessdata at:
        $url = "https://tessdata.projectnaptha.com/4.0.0_best/$lang.traineddata.gz"
        Invoke-WebRequest -Uri $url -OutFile $target -UseBasicParsing
        $sizeMB = [math]::Round((Get-Item $target).Length / 1MB, 1)
        Write-Host " OK ($sizeMB MB)" -ForegroundColor Green
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "[4/4] Downloading tessdata models..."
Download-TraineddataGz "vie" $vieTarget
Download-TraineddataGz "eng" $engTarget

# ============================================================
# Summary
# ============================================================
Write-Host ""
Write-Host "[Summary]" -ForegroundColor Cyan

$haveWorker = Test-Path $workerTarget
$haveWasmJs = Test-Path $wasmJsTarget
$haveWasm = Test-Path $wasmTarget
$haveVie = Test-Path $vieTarget
$haveEng = Test-Path $engTarget

$workerIcon = if ($haveWorker) { "[OK]" } else { "[MISSING]" }
$wasmJsIcon = if ($haveWasmJs) { "[OK]" } else { "[MISSING]" }
$wasmIcon = if ($haveWasm) { "[OK]" } else { "[MISSING]" }
$vieIcon = if ($haveVie) { "[OK]" } else { "[MISSING]" }
$engIcon = if ($haveEng) { "[OK]" } else { "[MISSING]" }

Write-Host "  worker.min.js ............. $workerIcon"
Write-Host "  tesseract-core.wasm.js .... $wasmJsIcon"
Write-Host "  tesseract-core.wasm ....... $wasmIcon"
Write-Host "  vie.traineddata.gz ........ $vieIcon"
Write-Host "  eng.traineddata.gz ........ $engIcon"

if ($haveWorker -and $haveWasmJs -and $haveWasm -and $haveVie -and $haveEng) {
    $totalSize = 0
    Get-ChildItem $tessDir -Recurse -File | ForEach-Object { $totalSize += $_.Length }
    $totalMB = [math]::Round($totalSize / 1MB, 1)
    Write-Host ""
    Write-Host "[OK] OCR assets ready ($totalMB MB total)." -ForegroundColor Green
    Write-Host "Run: pnpm install && pnpm tauri dev" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "[!] Some assets missing. Re-run script." -ForegroundColor Yellow
}
Write-Host ""
