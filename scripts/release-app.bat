@echo off
REM ============================================================
REM release-app.bat — Phase 38 release wave wrapper (1-click).
REM
REM Usage:
REM   release-app.bat <app_id> <version>           (manual mode — in commands)
REM   release-app.bat <app_id> <version> --auto    (tự chạy gh + git)
REM
REM Example:
REM   release-app.bat trishfont 1.0.1
REM   release-app.bat trishlauncher 1.0.0 --auto
REM
REM Yêu cầu trước khi gọi:
REM   1. Đã build .exe production: pnpm tauri build trong apps-desktop/<app>/
REM   2. Đã cài gh CLI + login: gh auth login
REM   3. Đã setup git remote + push permission
REM ============================================================

setlocal

if "%~1"=="" goto :usage
if "%~2"=="" goto :usage

set APP_ID=%~1
set VERSION=%~2
set EXTRA=%~3

REM Detect repo root (parent of scripts/)
set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%.."
set REPO_ROOT=%CD%
popd

echo.
echo === TrishTEAM Release Wave ===
echo App:     %APP_ID%
echo Version: %VERSION%
echo Repo:    %REPO_ROOT%
if not "%EXTRA%"=="" echo Mode:    %EXTRA%
echo.

python "%SCRIPT_DIR%publish-app.py" %APP_ID% %VERSION% %EXTRA%
if errorlevel 1 (
  echo.
  echo ERROR: publish-app.py fail. Check log o tren.
  exit /b 1
)

echo.
echo === Done ===
exit /b 0

:usage
echo Usage:
echo   release-app.bat ^<app_id^> ^<version^>           (manual mode)
echo   release-app.bat ^<app_id^> ^<version^> --auto    (auto run gh + git)
echo.
echo App IDs: trishlauncher trishcheck trishfont trishclean trishshortcut
echo          trishlibrary trishdrive trishfinance trishiso trishdesign
echo          trishoffice
echo.
echo Example:
echo   release-app.bat trishfont 1.0.1 --auto
echo.
exit /b 1
