@echo off
REM ============================================================
REM  TrishLibrary - Cai dat cong cu ngoai (Phase 38.2.0)
REM  Tu dong cai Tesseract OCR / qpdf / LibreOffice qua winget
REM ============================================================

title TrishLibrary - Cai dat cong cu OCR/PDF
color 0A

:menu
cls
echo.
echo  ============================================================
echo   TrishLibrary - Wizard cai dat cong cu ngoai
echo  ============================================================
echo.
echo   Cong cu can thiet cho cac tinh nang nang cao:
echo.
echo   [1] Tesseract OCR        (~70 MB)  - OCR PDF tieng Viet
echo   [2] qpdf                 (~5 MB)   - Dat/go mat khau PDF
echo   [3] LibreOffice          (~350 MB) - Convert PDF ^<-^> Word
echo.
echo   [A] Cai TAT CA (~430 MB)
echo   [C] Kiem tra cong cu da cai
echo   [Q] Thoat
echo.

set /p choice="  Chon (1/2/3/A/C/Q): "

if /i "%choice%"=="1" goto install_tesseract
if /i "%choice%"=="2" goto install_qpdf
if /i "%choice%"=="3" goto install_libreoffice
if /i "%choice%"=="a" goto install_all
if /i "%choice%"=="c" goto check_tools
if /i "%choice%"=="q" goto end
echo  Lua chon khong hop le.
timeout /t 2 >nul
goto menu


:install_tesseract
cls
echo.
echo  ============================================================
echo   [1/1] Cai Tesseract OCR (UB-Mannheim build)...
echo  ============================================================
echo.
echo   Vui long doi - winget se download va cai dat (~70 MB).
echo   Co the hien popup UAC, bam YES de cho phep.
echo.
winget install --id UB-Mannheim.TesseractOCR --accept-package-agreements --accept-source-agreements
echo.
echo  ============================================================
echo   Hoan tat. Bam phim bat ky de quay lai menu...
echo  ============================================================
pause >nul
goto menu


:install_qpdf
cls
echo.
echo  ============================================================
echo   [1/1] Cai qpdf...
echo  ============================================================
echo.
echo   Vui long doi - winget se download va cai dat (~5 MB).
echo.
winget install --id qpdf.qpdf --accept-package-agreements --accept-source-agreements
echo.
echo  ============================================================
echo   Hoan tat. Bam phim bat ky de quay lai menu...
echo  ============================================================
pause >nul
goto menu


:install_libreoffice
cls
echo.
echo  ============================================================
echo   [1/1] Cai LibreOffice (~350 MB, mat ~5-10 phut)...
echo  ============================================================
echo.
echo   Vui long doi - winget se download va cai dat.
echo   KHONG dong cua so nay cho den khi xong.
echo.
winget install --id TheDocumentFoundation.LibreOffice --accept-package-agreements --accept-source-agreements
echo.
echo  ============================================================
echo   Hoan tat. Bam phim bat ky de quay lai menu...
echo  ============================================================
pause >nul
goto menu


:install_all
cls
echo.
echo  ============================================================
echo   Dang cai TAT CA cong cu (~430 MB, mat ~10-15 phut)
echo  ============================================================
echo.

echo  [1/3] Tesseract OCR...
echo.
winget install --id UB-Mannheim.TesseractOCR --accept-package-agreements --accept-source-agreements
echo.
echo  ------------------------------------------------------------
echo  [2/3] qpdf...
echo.
winget install --id qpdf.qpdf --accept-package-agreements --accept-source-agreements
echo.
echo  ------------------------------------------------------------
echo  [3/3] LibreOffice (lau nhat ~5-10 phut)...
echo.
winget install --id TheDocumentFoundation.LibreOffice --accept-package-agreements --accept-source-agreements
echo.
echo  ============================================================
echo   HOAN TAT 3/3. Bam phim bat ky de kiem tra ket qua...
echo  ============================================================
pause >nul
goto check_tools


:check_tools
cls
echo.
echo  ============================================================
echo   Kiem tra cong cu da cai
echo  ============================================================
echo.

echo  [Tesseract]
if exist "C:\Program Files\Tesseract-OCR\tesseract.exe" (
    echo    [OK] C:\Program Files\Tesseract-OCR\tesseract.exe
) else if exist "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe" (
    echo    [OK] C:\Program Files ^(x86^)\Tesseract-OCR\tesseract.exe
) else (
    echo    [CHUA CAI]
)
echo.

echo  [qpdf]
set "QPDF_FOUND="
REM Scan "C:\Program Files\qpdf*\bin\qpdf.exe" (folder co the co version trong ten)
for /d %%d in ("C:\Program Files\qpdf*") do (
    if exist "%%d\bin\qpdf.exe" (
        echo    [OK] %%d\bin\qpdf.exe
        set "QPDF_FOUND=1"
    )
)
for /d %%d in ("C:\Program Files (x86)\qpdf*") do (
    if exist "%%d\bin\qpdf.exe" (
        echo    [OK] %%d\bin\qpdf.exe
        set "QPDF_FOUND=1"
    )
)
if not defined QPDF_FOUND (
    where qpdf >nul 2>&1
    if not errorlevel 1 (
        for /f "delims=" %%i in ('where qpdf') do echo    [OK] %%i
        set "QPDF_FOUND=1"
    )
)
if not defined QPDF_FOUND (
    REM Scan winget package path
    for /d %%d in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\qpdf.qpdf*") do (
        for /d %%s in ("%%d\*") do (
            if exist "%%s\bin\qpdf.exe" (
                echo    [OK] %%s\bin\qpdf.exe
                set "QPDF_FOUND=1"
            )
        )
    )
)
if not defined QPDF_FOUND echo    [CHUA CAI]
echo.

echo  [LibreOffice]
if exist "C:\Program Files\LibreOffice\program\soffice.exe" (
    echo    [OK] C:\Program Files\LibreOffice\program\soffice.exe
) else if exist "C:\Program Files (x86)\LibreOffice\program\soffice.exe" (
    echo    [OK] C:\Program Files ^(x86^)\LibreOffice\program\soffice.exe
) else (
    echo    [CHUA CAI]
)
echo.

echo  [Tessdata vie + eng]
set "TD=%APPDATA%\TrishLibrary\tessdata_best"
if exist "%TD%\vie.traineddata" (
    echo    [OK] vie.traineddata
) else (
    echo    [CHUA CO] vie.traineddata - se tu copy khi mo TrishLibrary
)
if exist "%TD%\eng.traineddata" (
    echo    [OK] eng.traineddata
) else (
    echo    [CHUA CO] eng.traineddata - se tu copy khi mo TrishLibrary
)
echo.

echo  ============================================================
echo   Bam phim bat ky de quay lai menu...
echo  ============================================================
pause >nul
goto menu


:end
exit /b 0
