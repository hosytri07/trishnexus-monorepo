@echo off
chcp 65001 >nul 2>&1
title TrishAdmin - Chay dev mode

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
echo     TrishAdmin  --  CHAY DEV MODE
echo  ============================================
echo.
echo   Project: %cd%
echo.
echo  --------------------------------------------
echo.

REM === Kiem tra TrishAdmin ton tai ===
if not exist "apps-desktop\trishadmin\package.json" (
    echo  [LOI] Khong thay apps-desktop\trishadmin.
    echo        Co the chua pull code moi nhat.
    echo        Chay START.bat truoc.
    echo.
    pause
    exit /b 1
)

REM === Kiem tra pnpm ===
where pnpm >nul 2>&1
if errorlevel 1 (
    echo  [LOI] Chua cai pnpm. Chay SETUP.bat truoc.
    pause
    exit /b 1
)

REM === Kiem tra node_modules da cai chua ===
if not exist "node_modules" (
    echo  [!] Chua cai deps. Chay START.bat truoc de pnpm install.
    pause
    exit /b 1
)

echo   [1/2] Vao thu muc TrishAdmin...
cd apps-desktop\trishadmin
echo.
echo   [2/2] Chay pnpm tauri dev...
echo.
echo  --------------------------------------------
echo   Lan dau cargo build mat ~10-25 phut.
echo   Cac lan sau nhanh hon (10-30s).
echo  --------------------------------------------
echo.
echo   Login email admin (1 trong 2):
echo     - trishteam.official@gmail.com
echo     - hosytri77@gmail.com
echo.
echo   Email khac se thay man hinh BLOCK + auto signOut.
echo.
echo  --------------------------------------------
echo.

call pnpm tauri dev

REM Sau khi user dong app
echo.
echo   Da dong TrishAdmin.
echo.
pause
