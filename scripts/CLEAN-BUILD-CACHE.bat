@echo off
chcp 65001 >nul 2>&1
title TrishNexus - Clean Build Cache

REM ============================================================
REM CLEAN-BUILD-CACHE.bat — Update 2026-05-03 (Phase 33 cleanup)
REM
REM Xoa cache build (Rust target + Vite dist + Cargo lock + tuy chon
REM node_modules) cho 11 app trong apps-desktop. KHONG dong source code.
REM
REM Tien ich: chuan bi truoc khi chuyen may nha <-> co quan,
REM hoac giai phong dung luong USB.
REM
REM Sau khi clean, neu can build lai 1 app:
REM    cd apps-desktop\<ten-app>
REM    pnpm install      (neu da xoa node_modules)
REM    pnpm tauri dev    (lan dau Rust compile lai 5-15 phut)
REM ============================================================

REM === Tu dong tim monorepo ===
if exist "%~dp0..\.git" (
    cd /d "%~dp0.."
) else (
    echo.
    echo  [LOI] Khong tim thay trishnexus-monorepo.
    echo        Dat file .bat nay trong monorepo\scripts\
    echo.
    pause
    exit /b 1
)

cls
echo.
echo  ============================================
echo     TrishNexus  --  CLEAN BUILD CACHE
echo  ============================================
echo.
echo   Project: %cd%
echo.
echo  --- LUON XOA ---
echo     - apps-desktop\*\src-tauri\target  (Rust build cache, ~5-30GB / app)
echo     - apps-desktop\*\src-tauri\Cargo.lock (~50KB / app)
echo     - apps-desktop\*\dist               (Vite output, ~5-50MB / app)
echo     - apps-desktop\*\dist-web           (PWA Finance output)
echo.
echo  --- TUY CHON ---
echo     - node_modules                       (~600MB-2GB tong)
echo     - .next                              (Next.js website cache, ~200-500MB)
echo.
echo  --- GIU NGUYEN ---
echo     - Source code (src/, src-tauri/src/, Cargo.toml, package.json)
echo     - website/, docs/, scripts/
echo     - .git, .venv, .env.local, *.session, service-account.json
echo.
echo  --------------------------------------------
set /p confirm="  Tiep tuc xoa target + dist + Cargo.lock? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo.
    echo   Da huy. Khong xoa gi.
    pause
    exit /b 0
)

echo.
set /p alsonm="  Xoa luon node_modules de tiet kiem ~1GB? (Y/N): "
echo.

set /p alsonext="  Xoa luon website\.next cache? (Y/N): "

echo.
echo  --------------------------------------------
echo   Bat dau xoa...
echo  --------------------------------------------
echo.

set count=0

REM ===== Danh sach 11 app hien tai (Phase 33) =====
set APPS=trishadmin trishcheck trishclean trishdesign trishdrive trishfinance trishfont trishiso trishlauncher trishlibrary trishshortcut

REM ===== Xoa src-tauri/target =====
for %%A in (%APPS%) do (
    if exist "apps-desktop\%%A\src-tauri\target" (
        echo   [target]    apps-desktop\%%A\src-tauri\target
        rmdir /s /q "apps-desktop\%%A\src-tauri\target"
        set /a count+=1
    )
)

REM ===== Xoa Cargo.lock (force re-resolve dep cleaner) =====
for %%A in (%APPS%) do (
    if exist "apps-desktop\%%A\src-tauri\Cargo.lock" (
        echo   [Cargo.lock] apps-desktop\%%A\src-tauri\Cargo.lock
        del /q "apps-desktop\%%A\src-tauri\Cargo.lock"
        set /a count+=1
    )
)

REM ===== Xoa dist + dist-web =====
for %%A in (%APPS%) do (
    if exist "apps-desktop\%%A\dist" (
        echo   [dist]      apps-desktop\%%A\dist
        rmdir /s /q "apps-desktop\%%A\dist"
        set /a count+=1
    )
    if exist "apps-desktop\%%A\dist-web" (
        echo   [dist-web]  apps-desktop\%%A\dist-web
        rmdir /s /q "apps-desktop\%%A\dist-web"
        set /a count+=1
    )
)

REM ===== Tuy chon: node_modules =====
if /i "%alsonm%"=="Y" (
    echo.
    echo   --- Xoa node_modules ---
    if exist "node_modules" (
        echo   [root]      node_modules
        rmdir /s /q "node_modules"
        set /a count+=1
    )
    for %%A in (%APPS%) do (
        if exist "apps-desktop\%%A\node_modules" (
            echo   [app]       apps-desktop\%%A\node_modules
            rmdir /s /q "apps-desktop\%%A\node_modules"
            set /a count+=1
        )
    )
    for %%P in (auth core data design-system telemetry ui adapters admin-keys) do (
        if exist "packages\%%P\node_modules" (
            echo   [package]   packages\%%P\node_modules
            rmdir /s /q "packages\%%P\node_modules"
            set /a count+=1
        )
    )
    if exist "website\node_modules" (
        echo   [website]   website\node_modules
        rmdir /s /q "website\node_modules"
        set /a count+=1
    )
)

REM ===== Tuy chon: website .next =====
if /i "%alsonext%"=="Y" (
    if exist "website\.next" (
        echo   [.next]     website\.next
        rmdir /s /q "website\.next"
        set /a count+=1
    )
)

echo.
echo  --------------------------------------------
echo     XONG  --  Da xoa %count% folder/file
echo  --------------------------------------------
echo.
echo   Source code van nguyen ven.
echo.
echo   Khi can build lai 1 app desktop:
echo     pnpm install
echo     pnpm -C apps-desktop\^<app^> tauri dev
echo.
echo   Kiem tra dung luong moi:
echo     Mo File Explorer ^> Properties tren folder TrishTEAM
echo.
pause
