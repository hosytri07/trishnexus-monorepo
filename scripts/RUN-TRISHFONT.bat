@echo off
setlocal EnableExtensions EnableDelayedExpansion
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

REM Hien thi phien ban Python de user verify dung venv
set "PYEXE=%cd%\.venv\Scripts\python.exe"
echo   OK -- .venv da co.
echo   Python: "!PYEXE!"
for /f "delims=" %%v in ('"!PYEXE!" -V 2^>^&1') do echo   Version: %%v

REM --- [2/3] Kiem tra package trishfont + trishteam_core ---
echo.
echo   [2/3] Kiem tra package trishteam_core + trishfont...

"!PYEXE!" -c "import trishteam_core" >nul 2>&1
set "TC_OK=%errorlevel%"
"!PYEXE!" -c "import trishfont" >nul 2>&1
set "TF_OK=%errorlevel%"

if not "!TC_OK!"=="0" (
    echo   [!] trishteam_core chua duoc cai. Cai ngay...
    "!PYEXE!" -m pip install -e shared\trishteam_core
    if errorlevel 1 goto :err_install
)

if not "!TF_OK!"=="0" (
    echo   [!] trishfont chua duoc cai. Cai ngay...
    "!PYEXE!" -m pip install -e apps\trishfont
    if errorlevel 1 goto :err_install
)

REM Verify lai sau khi install (debug log duong dan thuc te)
"!PYEXE!" -c "import trishfont, trishteam_core; print('  trishteam_core @', trishteam_core.__file__); print('  trishfont      @', trishfont.__file__)"
if errorlevel 1 (
    echo.
    echo   [LOI] Van khong import duoc trishfont sau khi cai.
    echo         Xem log ben tren + bao Claude.
    pause
    exit /b 1
)

REM --- [3/3] Chay app ---
echo.
echo   [3/3] Khoi dong TrishFont...
echo   Command: "!PYEXE!" -m trishfont.app
echo  --------------------------------------------
echo.
"!PYEXE!" -m trishfont.app
set "APP_RC=%errorlevel%"

echo.
echo  --------------------------------------------
if "!APP_RC!"=="0" (
    echo   App da dong binh thuong. Log: %%LOCALAPPDATA%%\TrishFont\logs\
) else (
    echo   [!] App ket thuc voi errorlevel !APP_RC!.
    echo       Xem log: %%LOCALAPPDATA%%\TrishFont\logs\
)
echo.
pause
exit /b !APP_RC!

:err_install
echo.
echo   [!] pip install that bai.
echo       Kiem tra ket noi mang hoac bao Claude loi ben tren.
pause
exit /b 1
