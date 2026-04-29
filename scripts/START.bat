@echo off
chcp 65001 >nul 2>&1
title TrishNexus - Bat dau phien

REM === Tu dong tim monorepo ===
if exist "%~dp0..\.git" (
    cd /d "%~dp0.."
) else if exist "%~dp0trishnexus-monorepo\.git" (
    cd /d "%~dp0trishnexus-monorepo"
) else (
    echo.
    echo  [LOI] Khong tim thay trishnexus-monorepo.
    echo        Dat file .bat nay o monorepo\scripts\
    echo.
    pause
    exit /b 1
)

REM === Detect machine label (home / office) ===
set "MACHINE=unknown"
if exist ".machine-label" (
    set /p MACHINE=<.machine-label
) else (
    cls
    echo.
    echo  ============================================
    echo     LAN DAU TIEN TREN MAY NAY
    echo  ============================================
    echo.
    echo   May nay la may NHA hay may CO QUAN?
    echo.
    echo     [1] May NHA
    echo     [2] May CO QUAN
    echo.
    set /p choice="  Chon (1/2): "
    if "%choice%"=="1" (
        echo home> .machine-label
        set "MACHINE=home"
    ) else if "%choice%"=="2" (
        echo office> .machine-label
        set "MACHINE=office"
    ) else (
        echo unknown> .machine-label
        set "MACHINE=unknown"
    )
)

cls
echo.
echo  ============================================
if "%MACHINE%"=="home" (
    echo     TrishNexus  --  PHIEN MAY NHA
) else if "%MACHINE%"=="office" (
    echo     TrishNexus  --  PHIEN MAY CO QUAN
) else (
    echo     TrishNexus  --  BAT DAU PHIEN
)
echo  ============================================
echo.
echo   Project: %cd%
echo   Computer: %COMPUTERNAME%
echo.
echo  --------------------------------------------
echo.
echo   [1/3] Keo code moi nhat tu GitHub...
echo.
git pull origin main
if errorlevel 1 (
    echo.
    echo  --------------------------------------------
    echo   [!] Pull that bai. Co the do:
    echo       - Mat internet
    echo       - Co conflict voi may truoc
    echo.
    echo   Mo Cowork Desktop va nhan tin cho Claude de fix.
    echo  --------------------------------------------
    echo.
    pause
    exit /b 1
)

echo.
echo   [2/3] Cai node_modules (pnpm install)...
echo.
if exist pnpm-workspace.yaml (
    where pnpm >nul 2>&1
    if errorlevel 1 (
        echo   [!] Chua cai pnpm. Chay SETUP.bat truoc.
        pause
        exit /b 1
    )
    pnpm install
    if errorlevel 1 (
        echo.
        echo  --------------------------------------------
        echo   [!] pnpm install that bai.
        echo       Mo Cowork Desktop va nhan tin cho Claude.
        echo  --------------------------------------------
        echo.
        pause
        exit /b 1
    )
)

echo.
echo   [3/3] Kiem tra file dang do...
echo.
git status --short
echo.
echo  ============================================
if "%MACHINE%"=="home" (
    echo     SAN SANG  --  PHIEN MAY NHA
) else if "%MACHINE%"=="office" (
    echo     SAN SANG  --  PHIEN MAY CO QUAN
) else (
    echo     SAN SANG
)
echo  ============================================
echo.
echo   Mo Cowork Desktop ^> chat moi ^> paste:
echo.
echo     "tiep tuc"
echo.
echo   Claude se doc docs/HANDOFF-MASTER.md va biet
echo   phai lam gi tiep theo.
echo.
echo   Cua so nay co the dong.
echo.
pause
