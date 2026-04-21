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
echo   [2/2] Kiem tra file con dang do...
echo.
git status --short
echo.
echo  ============================================
echo     SAN SANG  --  Mo Cowork Desktop!
echo  ============================================
echo.
echo   Cua so nay co the dong.
echo.
pause
