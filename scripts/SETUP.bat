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

echo   [1/7] Kiem tra Git...
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
echo   [2/7] Cau hinh Git (ten + email + safe directory)...
git config --global user.name "hosytri07"
git config --global user.email "hosytri07@gmail.com"
git config --global --add safe.directory "*"
echo   Da set: hosytri07 / hosytri07@gmail.com

echo.
echo   [3/7] Kiem tra Node.js (^>= 18 yeu cau cho monorepo Phase 14+)...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [!] Chua cai Node.js.
    echo       Tai LTS moi nhat tai: https://nodejs.org/
    echo       Luu y: tick "Add to PATH" khi cai.
    echo.
    pause
    exit /b 1
)
node --version

echo.
echo   [4/7] Kiem tra pnpm...
where pnpm >nul 2>&1
if errorlevel 1 (
    echo   Chua co pnpm - cai qua npm...
    call npm install -g pnpm
    if errorlevel 1 (
        echo.
        echo   [!] Cai pnpm that bai. Thu chay PowerShell admin va lam lai.
        pause
        exit /b 1
    )
)
pnpm --version

echo.
echo   [5/7] Kiem tra Rust (cho Tauri desktop app)...
rustc --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [!] Chua cai Rust. Bat buoc cho desktop app (Tauri).
    echo       Tai tai: https://www.rust-lang.org/tools/install
    echo       Chay rustup-init.exe va chon default.
    echo       (Neu khong can chay desktop app, co the skip - nhung website
    echo        va pnpm qa vẫn chạy được.)
    echo.
    set /p "SKIP_RUST=  Bo qua Rust va tiep tuc? (y/N): "
    if /i not "%SKIP_RUST%"=="y" (
        pause
        exit /b 1
    )
) else (
    rustc --version
)

echo.
echo   [6/7] Cai node_modules cho monorepo (pnpm install)...
echo   (Lan dau co the mat 3-5 phut, tuy internet)
echo.
pnpm install
if errorlevel 1 (
    echo.
    echo   [!] pnpm install that bai. Hoi Claude.
    pause
    exit /b 1
)

echo.
echo   [7/7] Kiem tra Python (cho legacy app + QA script)...
python --version >nul 2>&1
if errorlevel 1 (
    echo   (Khong co Python - bo qua. Se can neu muon chay script QA
    echo    nhu gen-icons.py hoac dung legacy Qt app.)
) else (
    python --version
    echo   Tao .venv cho Python deps neu chua co...
    if not exist .venv (
        python -m venv .venv
    )
)

echo.
echo  ============================================
echo     SETUP XONG!
echo  ============================================
echo.
echo   Tu gio tren may nay:
echo     - Moi sang  -^>  bam START.bat (tu pull + pnpm install)
echo     - Moi toi   -^>  bam END.bat (commit + push)
echo     - Mo chat moi -^> go: tiep tuc
echo.
echo   Lan dau push se co popup dang nhap GitHub.
echo   Dang nhap hosytri07.
echo.
pause
exit /b 0
