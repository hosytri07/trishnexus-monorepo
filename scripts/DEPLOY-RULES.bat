@echo off
chcp 65001 >nul 2>&1
title TrishTEAM - Deploy Firestore rules

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
echo     Firestore Rules  --  DEPLOY
echo  ============================================
echo.
echo   Project: %cd%
echo   File:    firestore.rules
echo.
echo  --------------------------------------------
echo.
echo   Ban se deploy rules moi nhat len Firebase.
echo   Anh huong toan bo apps + website (read/write Firestore).
echo.
echo   Phase 18.8.a moi: cho phep admin write audit/ collection.
echo.
echo  --------------------------------------------
echo.

REM === Kiem tra Firebase CLI ===
where firebase >nul 2>&1
if errorlevel 1 (
    echo  [LOI] Chua cai Firebase CLI.
    echo.
    echo   Cai bang lenh:
    echo     npm install -g firebase-tools
    echo.
    echo   Sau do dang nhap:
    echo     firebase login
    echo.
    pause
    exit /b 1
)

REM === Kiem tra dang nhap Firebase ===
firebase projects:list >nul 2>&1
if errorlevel 1 (
    echo  [LOI] Chua dang nhap Firebase.
    echo.
    echo   Chay lenh nay roi quay lai:
    echo     firebase login
    echo.
    pause
    exit /b 1
)

REM === Kiem tra firestore.rules ton tai ===
if not exist firestore.rules (
    echo  [LOI] Khong thay firestore.rules.
    pause
    exit /b 1
)

echo   [1/2] Hien rules hien tai (10 dong dau):
echo  --------------------------------------------
type firestore.rules | more +0 | findstr /N "^" | findstr /R "^[1-9]:" /C:"^10:"
echo  --------------------------------------------
echo.

set "CONFIRM="
set /p "CONFIRM=  Tiep tuc deploy? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo.
    echo   Huy.
    pause
    exit /b 0
)

echo.
echo   [2/2] Deploy rules len Firebase...
echo.

call firebase deploy --only firestore:rules
if errorlevel 1 (
    echo.
    echo  --------------------------------------------
    echo   [!] Deploy that bai. Mo Cowork hoi Claude.
    echo  --------------------------------------------
    echo.
    pause
    exit /b 1
)

echo.
echo  ============================================
echo     DA DEPLOY RULES THANH CONG
echo  ============================================
echo.
echo   Cac apps va TrishAdmin co the dung Firestore
echo   voi rules moi ngay.
echo.
pause
