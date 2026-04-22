@echo off
chcp 65001 >nul 2>&1
title TrishFont - Chay app

REM === Tu dong tim monorepo ===
REM File nay co the dat o: (a) monorepo\scripts\ | (b) TrishTEAM\ (parent monorepo)
if exist "%~dp0..\.git" (
    cd /d "%~dp0.."
) else if exist "%~dp0trishnexus-monorepo\.git" (
    cd /d "%~dp0trishnexus-monorepo"
) else (
    echo.
    echo  [LOI] Khong tim thay trishnexus-monorepo.
    echo        Dat file .bat nay o TrishTEAM\ hoac trong monorepo\scripts\
    echo.
    pause
    exit /b 1
)

cls
echo.
echo  ============================================
echo     TrishFont  --  CHAY APP
echo  ============================================
echo   Project: %cd%
echo.

REM --- [1/3] Kiem tra .venv ---
echo   [1/3] Kiem tra moi truong Python (.venv)...
if not exist ".venv\Scripts\python.exe" (
    echo.
    echo   [!] Chua co .venv. May nay chua chay SETUP.bat.
    echo       Chay: scripts\SETUP.bat truoc nhe.
    echo.
    pause
    exit /b 1
)
echo   OK — .venv da co.

REM --- [2/3] Kiem tra package trishfont ---
echo.
echo   [2/3] Kiem tra package trishfont...
".venv\Scripts\python.exe" -c "import trishfont" >nul 2>&1
if errorlevel 1 (
    echo   [!] trishfont chua duoc cai. Cai nhanh bay gio...
    ".venv\Scripts\python.exe" -m pip install -e shared\trishteam_core --quiet
    if errorlevel 1 goto :err_install
    ".venv\Scripts\python.exe" -m pip install -e apps\trishfont --quiet
    if errorlevel 1 goto :err_install
    echo   OK — da cai xong.
) else (
    echo   OK — trishfont da co.
)

REM --- [3/3] Chay app ---
echo.
echo   [3/3] Khoi dong TrishFont...
echo  --------------------------------------------
echo.
".venv\Scripts\python.exe" -m trishfont.app

echo.
echo  --------------------------------------------
echo   App da dong. Log luu o %%LOCALAPPDATA%%\TrishFont\logs\
echo.
pause
exit /b 0

:err_install
echo.
echo   [!] pip install that bai.
echo       Kiem tra ket noi mang hoac hoi Claude.
pause
exit /b 1
