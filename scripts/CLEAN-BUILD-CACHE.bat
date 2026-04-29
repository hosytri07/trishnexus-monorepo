@echo off
chcp 65001 >nul 2>&1
title TrishNexus - Clean Build Cache

REM ============================================================
REM CLEAN-BUILD-CACHE.bat — Phase 19.22
REM
REM Xoa toan bo build cache (Rust target + Vite dist) trong
REM apps-desktop. KHONG dong source code. Source van nguyen ven.
REM
REM Sau khi clean, neu can build lai 1 app:
REM    cd apps-desktop\<ten-app>
REM    pnpm install
REM    pnpm tauri dev   (lan dau co the lau 5-15 phut)
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
echo   Se xoa:
echo     - apps-desktop\*\src-tauri\target  (Rust build cache, ~64GB)
echo     - apps-desktop\*\dist               (Vite output, ~41MB)
echo.
echo   GIU NGUYEN:
echo     - Source code (src/, src-tauri/src/, src-tauri/Cargo.toml)
echo     - node_modules (de pnpm khoi cai lai)
echo     - website/, docs/, scripts/
echo     - .git, .venv
echo.
echo  --------------------------------------------
set /p confirm="  Tiep tuc? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo.
    echo   Da huy. Khong xoa gi.
    pause
    exit /b 0
)

echo.
echo  --------------------------------------------
echo   Bat dau xoa...
echo  --------------------------------------------
echo.

set count=0

REM ===== Xoa src-tauri/target trong apps-desktop =====
for %%A in (trishadmin trishcheck trishclean trishdesign trishfont trishimage trishlauncher trishlibrary trishnote trishsearch trishtype) do (
    if exist "apps-desktop\%%A\src-tauri\target" (
        echo   [target] apps-desktop\%%A\src-tauri\target
        rmdir /s /q "apps-desktop\%%A\src-tauri\target"
        set /a count+=1
    )
)

echo.

REM ===== Xoa dist trong apps-desktop =====
for %%A in (trishadmin trishcheck trishclean trishdesign trishfont trishimage trishlauncher trishlibrary trishnote trishsearch trishtype) do (
    if exist "apps-desktop\%%A\dist" (
        echo   [dist]   apps-desktop\%%A\dist
        rmdir /s /q "apps-desktop\%%A\dist"
        set /a count+=1
    )
)

echo.
echo  --------------------------------------------
echo     XONG  --  Da xoa cac folder build cache
echo  --------------------------------------------
echo.
echo   Source code van nguyen ven.
echo   Khi can build lai 1 app desktop:
echo     cd apps-desktop\trishlibrary
echo     pnpm install
echo     pnpm tauri dev
echo.
echo   Kiem tra dung luong moi:
echo     Mo File Explorer ^> Properties tren folder TrishTEAM
echo.
pause
