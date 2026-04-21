@echo off
chcp 65001 >nul 2>&1
title TrishNexus - Ket thuc lam viec

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
echo     TrishNexus  --  KET THUC NGAY LAM VIEC
echo  ============================================
echo.
echo   Project: %cd%
echo.
echo  --------------------------------------------
echo.
echo   [1/4] Kiem tra co gi thay doi khong...
echo.

REM Neu status --porcelain khong co output -> khong co thay doi
git status --porcelain | findstr . >nul
if errorlevel 1 (
    echo   Khong co gi thay doi. Khong can luu.
    echo.
    goto :done
)

echo   Cac file da thay doi:
echo   --------------------------------------------
git status --short
echo   --------------------------------------------
echo.

set "MSG="
set /p "MSG=  Mo ta ngan (Enter de dung mac dinh): "
if "%MSG%"=="" set "MSG=wip: save end of day"

echo.
echo   [2/4] Them tat ca file...
git add .
if errorlevel 1 goto :err_add

echo   [3/4] Luu thanh 1 commit...
git commit -m "%MSG%"
if errorlevel 1 (
    echo.
    echo   [!] Commit that bai. Hoi Claude.
    pause
    exit /b 1
)

echo.
echo   [4/4] Day len GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo  --------------------------------------------
    echo   [!] Push that bai. KHONG rut USB voi.
    echo       Mo Cowork Desktop va hoi Claude.
    echo  --------------------------------------------
    echo.
    pause
    exit /b 1
)

:done
echo.
echo  ============================================
echo     DA LUU XONG  --  Nho EJECT USB!
echo  ============================================
echo.
echo   Cach eject:
echo     Click chuot phai vao USB trong This PC
echo     --^> chon "Eject"
echo.
echo   (Dung rut thang - de tranh hong file)
echo.
pause
exit /b 0

:err_add
echo.
echo   [!] Git add that bai. Hoi Claude.
pause
exit /b 1
