@echo off
chcp 65001 >nul 2>&1
title TrishNexus - Bat dau lam viec

REM === Tu dong tim monorepo ===
REM File nay co the dat o USB root HOAC trong monorepo/scripts/
if exist "%~dp0..\.git" (
    cd /d "%~dp0.."
) else if exist "%~dp0trishnexus-monorepo\.git" (
    cd /d "%~dp0trishnexus-monorepo"
) else (
    echo.
    echo  [LOI] Khong tim thay trishnexus-monorepo.
    echo        Dat file .bat nay o USB root hoac trong monorepo\scripts\
    echo.
    pause
    exit /b 1
)

cls
echo.
echo  ============================================
echo     TrishNexus  --  BAT DAU NGAY LAM VIEC
echo  ============================================
echo.
echo   Project: %cd%
echo.
echo  --------------------------------------------
echo.
echo   [1/2] Keo code moi nhat tu GitHub...
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
REM Chi chay pnpm install neu co pnpm-workspace.yaml (monorepo Phase 14+)
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
        echo   [!] pnpm install that bai. Co the do:
        echo       - Mat internet
        echo       - Node version qua cu (can ^>= 18)
        echo.
        echo   Mo Cowork Desktop va nhan tin cho Claude de fix.
        echo  --------------------------------------------
        echo.
        pause
        exit /b 1
    )
) else (
    echo   (Khong phai monorepo Node - bo qua)
)

echo.
echo   [3/3] Kiem tra file con dang do...
echo.
git status --short
echo.
echo  ============================================
echo     SAN SANG  --  Mo Cowork Desktop!
echo  ============================================
echo.
echo   Mo chat moi -^> paste cau hoi:
echo.
echo     "Doc handoff de tiep tuc project:"
echo     "docs/HANDOFF-WEBSITE-PHASE-19.md"
echo.
echo     (Neu lam desktop apps thi doc:
echo      docs/HANDOFF-TRISHLIBRARY-3.0.md)
echo.
echo   Claude se doc handoff va biet phai lam gi tiep.
echo.
echo   Neu can deploy Firestore rules moi:
echo     scripts\DEPLOY-RULES.bat
echo.
echo   Neu can chay TrishAdmin (test phase 18.7+):
echo     scripts\RUN-TRISHADMIN.bat
echo.
echo   Cua so nay co the dong.
echo.
pause
