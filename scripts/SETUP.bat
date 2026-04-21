@echo off
chcp 65001 >nul 2>&1
title TrishNexus - Setup may moi

REM === Tu dong tim monorepo ===
if exist "%~dp0..\.git" (
    cd /d "%~dp0.."
) else if exist "%~dp0trishnexus-monorepo\.git" (
    cd /d "%~dp0trishnexus-monorepo"
) else (
    echo.
    echo  [LOI] Khong tim thay trishnexus-monorepo.
    pause
    exit /b 1
)

cls
echo.
echo  ============================================
echo     TrishNexus  --  SETUP MAY MOI
echo  ============================================
echo.
echo   Script nay chay 1 LAN DUY NHAT khi ban
echo   mang USB sang mot may tinh moi.
echo.
echo   Lan sau chi can bam START.bat thoi.
echo.
echo  --------------------------------------------
echo.
pause
echo.

echo   [1/5] Kiem tra Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [!] Chua cai Python.
    echo       Tai tai: https://www.python.org/downloads/
    echo       Luu y: tick "Add Python to PATH" khi cai.
    echo.
    pause
    exit /b 1
)
python --version

echo.
echo   [2/5] Kiem tra Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [!] Chua cai Git.
    echo       Tai tai: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)
git --version

echo.
echo   [3/5] Cau hinh Git (ten + email + USB trust)...
git config --global user.name "hosytri07"
git config --global user.email "hosytri77@gmail.com"
REM Fix "dubious ownership" khi repo nam tren USB (FAT/exFAT)
git config --global --add safe.directory "*"
echo   Da set: hosytri07 / hosytri77@gmail.com (+ trust USB)

echo.
echo   [4/5] Tao moi truong Python (.venv) cho may nay...
if exist .venv (
    echo   .venv da ton tai - bo qua.
) else (
    python -m venv .venv
    if errorlevel 1 (
        echo.
        echo   [!] Tao .venv that bai. Hoi Claude.
        pause
        exit /b 1
    )
    echo   Da tao .venv
)

echo.
echo   [5/5] Cai cac package Python (editable)...
echo   (Qua trinh nay co the mat 1-2 phut, kien nhan nhe)
echo.
call .venv\Scripts\activate.bat
pip install -e shared\trishteam_core
if errorlevel 1 goto :err_pip
pip install -e apps\trishdesign
if errorlevel 1 goto :err_pip
pip install -e apps\trishfont
if errorlevel 1 goto :err_pip

echo.
echo  ============================================
echo     SETUP XONG!
echo  ============================================
echo.
echo   Tu gio tren may nay:
echo     - Moi sang  -^>  bam START.bat
echo     - Moi toi   -^>  bam END.bat
echo.
echo   Lan dau push se co popup dang nhap GitHub
echo   (trinh duyet tu mo). Dang nhap hosytri07.
echo.
pause
exit /b 0

:err_pip
echo.
echo   [!] pip install that bai. Hoi Claude.
pause
exit /b 1
