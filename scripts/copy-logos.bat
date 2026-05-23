@echo off
REM Phase 44.10 - Copy 4 logo PNG dep sang TAT CA cho logo cu (assets + module + Tauri icons)

setlocal
set "REPO=%~dp0.."
set "SRC=%REPO%\packages\design-system\src\assets"

echo === Phase 44 Copy logos to all locations ===
echo Source: %SRC%
echo.

for %%F in (logo-work.png logo-utilities.png logo-finance.png logo-admin.png) do (
  if not exist "%SRC%\%%F" (
    echo [ERR] Khong tim thay %SRC%\%%F
    pause
    exit /b 1
  )
)

REM ========== TrishWork (xanh la) ==========
set "L=%SRC%\logo-work.png"
copy /Y "%L%" "%REPO%\apps-desktop\trishwork\src\assets\logo.png" >nul && echo OK: trishwork\src\assets\logo.png
if exist "%REPO%\apps-desktop\trishwork\src\modules\design\assets\logo.png" copy /Y "%L%" "%REPO%\apps-desktop\trishwork\src\modules\design\assets\logo.png" >nul && echo OK: trishwork\modules\design\assets\logo.png
if exist "%REPO%\apps-desktop\trishwork\src\modules\library\assets\logo.png" copy /Y "%L%" "%REPO%\apps-desktop\trishwork\src\modules\library\assets\logo.png" >nul && echo OK: trishwork\modules\library\assets\logo.png
if exist "%REPO%\apps-desktop\trishwork\src\modules\iso\assets\logo.png" copy /Y "%L%" "%REPO%\apps-desktop\trishwork\src\modules\iso\assets\logo.png" >nul && echo OK: trishwork\modules\iso\assets\logo.png
copy /Y "%L%" "%REPO%\apps-desktop\trishwork\src-tauri\icons\icon.png" >nul && echo OK: trishwork\icons\icon.png

REM ========== TrishUtilities (vang) ==========
set "L=%SRC%\logo-utilities.png"
copy /Y "%L%" "%REPO%\apps-desktop\trishutilities\src\assets\logo.png" >nul && echo OK: trishutilities\src\assets\logo.png
for %%M in (check clean drive font shortcut) do (
  if exist "%REPO%\apps-desktop\trishutilities\src\modules\%%M\assets\logo.png" copy /Y "%L%" "%REPO%\apps-desktop\trishutilities\src\modules\%%M\assets\logo.png" >nul && echo OK: trishutilities\modules\%%M\assets\logo.png
)
copy /Y "%L%" "%REPO%\apps-desktop\trishutilities\src-tauri\icons\icon.png" >nul && echo OK: trishutilities\icons\icon.png

REM ========== TrishFinance (xanh duong) ==========
set "L=%SRC%\logo-finance.png"
copy /Y "%L%" "%REPO%\apps-desktop\trishfinance\src\assets\logo.png" >nul && echo OK: trishfinance\src\assets\logo.png
if exist "%REPO%\apps-desktop\trishfinance\public\logo-192.png" copy /Y "%L%" "%REPO%\apps-desktop\trishfinance\public\logo-192.png" >nul && echo OK: trishfinance\public\logo-192.png
if exist "%REPO%\apps-desktop\trishfinance\public\logo-512.png" copy /Y "%L%" "%REPO%\apps-desktop\trishfinance\public\logo-512.png" >nul && echo OK: trishfinance\public\logo-512.png
copy /Y "%L%" "%REPO%\apps-desktop\trishfinance\src-tauri\icons\icon.png" >nul && echo OK: trishfinance\icons\icon.png
if exist "%REPO%\apps-desktop\trishfinance\src-tauri\icons\32x32.png" copy /Y "%L%" "%REPO%\apps-desktop\trishfinance\src-tauri\icons\32x32.png" >nul && echo OK: trishfinance\icons\32x32.png
if exist "%REPO%\apps-desktop\trishfinance\src-tauri\icons\128x128.png" copy /Y "%L%" "%REPO%\apps-desktop\trishfinance\src-tauri\icons\128x128.png" >nul && echo OK: trishfinance\icons\128x128.png
if exist "%REPO%\apps-desktop\trishfinance\src-tauri\icons\128x128@2x.png" copy /Y "%L%" "%REPO%\apps-desktop\trishfinance\src-tauri\icons\128x128@2x.png" >nul && echo OK: trishfinance\icons\128x128@2x.png

REM ========== TrishAdmin (do) ==========
set "L=%SRC%\logo-admin.png"
copy /Y "%L%" "%REPO%\apps-desktop\trishadmin\src\assets\logo.png" >nul && echo OK: trishadmin\src\assets\logo.png
copy /Y "%L%" "%REPO%\apps-desktop\trishadmin\src-tauri\icons\icon.png" >nul && echo OK: trishadmin\icons\icon.png
if exist "%REPO%\apps-desktop\trishadmin\src-tauri\icons\32x32.png" copy /Y "%L%" "%REPO%\apps-desktop\trishadmin\src-tauri\icons\32x32.png" >nul && echo OK: trishadmin\icons\32x32.png
if exist "%REPO%\apps-desktop\trishadmin\src-tauri\icons\128x128.png" copy /Y "%L%" "%REPO%\apps-desktop\trishadmin\src-tauri\icons\128x128.png" >nul && echo OK: trishadmin\icons\128x128.png
if exist "%REPO%\apps-desktop\trishadmin\src-tauri\icons\128x128@2x.png" copy /Y "%L%" "%REPO%\apps-desktop\trishadmin\src-tauri\icons\128x128@2x.png" >nul && echo OK: trishadmin\icons\128x128@2x.png

echo.
echo === Done. Tat ca logo da update ===
echo Note: Icon Windows taskbar can xoa cache Tauri:
echo   rmdir /s /q apps-desktop\trishwork\src-tauri\target\debug ^(neu can^)
echo   rmdir /s /q apps-desktop\trishutilities\src-tauri\target\debug
echo   rmdir /s /q apps-desktop\trishfinance\src-tauri\target\debug
echo   rmdir /s /q apps-desktop\trishadmin\src-tauri\target\debug
echo.
echo Sau do chay lai pnpm tauri:dev de Rust rebuild icon + Vite re-bundle PNG.
pause
