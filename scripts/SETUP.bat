@echo off
chcp 65001 >nul 2>&1
title TrishNexus - Setup may moi

REM ============================================================
REM SETUP.bat — chay 1 LAN DUY NHAT khi mang USB sang may moi.
REM Update 2026-05-03: them check VC++ Build Tools + .env.local.
REM ============================================================

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

echo   [1/9] Kiem tra Git...
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
echo   [2/9] Cau hinh Git (ten + email + safe directory)...
git config --global user.name "hosytri07"
git config --global user.email "hosytri07@gmail.com"
git config --global --add safe.directory "*"
echo   Da set: hosytri07 / hosytri07@gmail.com

echo.
echo   [3/9] Kiem tra Node.js (^>= 18 yeu cau cho monorepo Phase 14+)...
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
echo   [4/9] Kiem tra pnpm...
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
echo   [5/9] Kiem tra Rust (cho Tauri desktop app)...
rustc --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [!] Chua cai Rust. Bat buoc cho desktop app (Tauri).
    echo       Tai tai: https://www.rust-lang.org/tools/install
    echo       Chay rustup-init.exe va chon default.
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
echo   [6/9] Kiem tra Visual Studio C++ Build Tools (Rust can link.exe)...
where link.exe >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [!] Khong tim thay link.exe (MSVC linker).
    echo.
    echo       Rust tren Windows can Visual Studio C++ Build Tools.
    echo       Tai cai dat tai: https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo.
    echo       Khi cai, tick:
    echo         - "Desktop development with C++" workload
    echo         - "Windows 11 SDK" (hoac 10 SDK neu Win10)
    echo.
    echo       Sau khi cai, mo lai Terminal de PATH cap nhat.
    echo.
    set /p "SKIP_MSVC=  Bo qua va tiep tuc? (y/N): "
    if /i not "%SKIP_MSVC%"=="y" (
        pause
        exit /b 1
    )
) else (
    echo   link.exe found OK
)

echo.
echo   [7/9] Kiem tra WebView2 Runtime (Tauri webview)...
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>&1
if errorlevel 1 (
    reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>&1
    if errorlevel 1 (
        echo   [!] WebView2 Runtime co the chua cai.
        echo       Win11 thuong da co san. Win10 cu can cai:
        echo         https://developer.microsoft.com/en-us/microsoft-edge/webview2/
        echo       Phien ban "Evergreen Bootstrapper".
        echo.
    ) else (
        echo   WebView2 OK ^(per-user^)
    )
) else (
    echo   WebView2 OK ^(system^)
)

echo.
echo   [8/9] Cai node_modules cho monorepo (pnpm install)...
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
echo   [9/9] Kiem tra .env.local + service-account.json (secrets local)...
set MISSING_SECRETS=0
if not exist "website\.env.local" (
    echo   [!] website\.env.local KHONG CO
    echo       File nay chua secrets cho Vercel deploy + Firebase Admin.
    echo       Copy tu may cu hoac tao moi theo docs\FIREBASE-SETUP.md
    set MISSING_SECRETS=1
)
if not exist "website\service-account.json" (
    echo   [!] website\service-account.json KHONG CO
    echo       File nay chua Firebase Admin SDK key.
    echo       Copy tu may cu hoac tao moi tu Firebase Console.
    set MISSING_SECRETS=1
)
if "%MISSING_SECRETS%"=="0" (
    echo   .env.local + service-account.json OK
)

echo.
echo  ============================================
echo     SETUP XONG!
echo  ============================================
echo.
echo   Tu gio tren may nay:
echo     - Moi sang  -^>  bam START.bat (tu pull + pnpm install)
echo     - Moi toi   -^>  bam END.bat (commit + push)
echo     - Mo Cowork moi -^> go: tiep tuc
echo.
if "%MISSING_SECRETS%"=="1" (
    echo   [!] CHUA CO .env.local va/hoac service-account.json
    echo       Build website + TrishAdmin se fail.
    echo       Lay tu may nha hoac docs\FIREBASE-SETUP.md
    echo.
)
echo   Lan dau push se co popup dang nhap GitHub.
echo   Dang nhap hosytri07.
echo.
pause
exit /b 0
