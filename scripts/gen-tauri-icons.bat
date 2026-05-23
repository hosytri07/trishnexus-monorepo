@echo off
REM Phase 44.10 - Generate Tauri icons (icon.ico + multi-size PNG)
REM Pause sau moi app + log ra file de Tri thay loi.

setlocal
set "REPO=%~dp0.."
set "SRC=%REPO%\packages\design-system\src\assets"
set "LOG=%REPO%\scripts\gen-tauri-icons.log"

echo === Phase 44 Generate Tauri icons === > "%LOG%"
echo Time: %DATE% %TIME% >> "%LOG%"
echo Source dir: %SRC% >> "%LOG%"
echo. >> "%LOG%"

echo === Phase 44 Generate Tauri icons ===
echo Log file: %LOG%
echo.

REM Check source PNG files
echo === Check source PNG files ===
for %%F in (logo-work.png logo-utilities.png logo-finance.png logo-admin.png) do (
  if exist "%SRC%\%%F" (
    echo [OK] %SRC%\%%F
    echo [OK] %SRC%\%%F >> "%LOG%"
  ) else (
    echo [ERR] Khong tim thay %SRC%\%%F
    echo [ERR] Khong tim thay %SRC%\%%F >> "%LOG%"
    pause
    exit /b 1
  )
)

echo.
echo Bat dau chay tauri icon cho 4 app. SE PAUSE sau moi app.
echo.
pause

REM ========= TrishWork =========
echo.
echo ========================================
echo === TrishWork (xanh la) ===
echo ========================================
echo === TrishWork === >> "%LOG%"
cd /d "%REPO%\apps-desktop\trishwork"
echo Current dir: %CD%
echo Current dir: %CD% >> "%LOG%"
call pnpm tauri icon "%SRC%\logo-work.png" 2>&1
echo Exit code: %ERRORLEVEL%
echo Exit code: %ERRORLEVEL% >> "%LOG%"
echo.
pause

REM ========= TrishUtilities =========
echo.
echo ========================================
echo === TrishUtilities (vang) ===
echo ========================================
echo === TrishUtilities === >> "%LOG%"
cd /d "%REPO%\apps-desktop\trishutilities"
echo Current dir: %CD%
call pnpm tauri icon "%SRC%\logo-utilities.png" 2>&1
echo Exit code: %ERRORLEVEL%
echo.
pause

REM ========= TrishFinance =========
echo.
echo ========================================
echo === TrishFinance (xanh duong) ===
echo ========================================
echo === TrishFinance === >> "%LOG%"
cd /d "%REPO%\apps-desktop\trishfinance"
echo Current dir: %CD%
call pnpm tauri icon "%SRC%\logo-finance.png" 2>&1
echo Exit code: %ERRORLEVEL%
echo.
pause

REM ========= TrishAdmin =========
echo.
echo ========================================
echo === TrishAdmin (do) ===
echo ========================================
echo === TrishAdmin === >> "%LOG%"
cd /d "%REPO%\apps-desktop\trishadmin"
echo Current dir: %CD%
call pnpm tauri icon "%SRC%\logo-admin.png" 2>&1
echo Exit code: %ERRORLEVEL%
echo.
pause

echo.
echo === Done. Log file: %LOG% ===
pause
