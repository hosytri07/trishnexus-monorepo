@echo off
chcp 65001 >nul 2>&1
title TrishTEAM - Deploy Firestore rules

REM === Tu dong tim monorepo ===
if exist "%~dp0..\.git" (
    cd /d "%~dp0.."
) else if exist "%~dp0trishnexus-monorepo\.git" (
    cd /d "%~dp0trishnexus-monorepo"
) else (
    echo [!] Khong tim thay repo trishnexus-monorepo
    pause
    exit /b 1
)

echo.
echo  ============================================
echo     Firestore Rules  --  DEPLOY
echo  ============================================
echo.
echo   Project: %CD%
echo   File:    firestore.rules
echo.
echo  --------------------------------------------
echo   Ban se deploy rules moi nhat len Firebase.
echo   Anh huong toan bo apps + website (read/write Firestore).
echo.
echo   Phase 19.17: bo Storage step (Spark plan khong ho tro,
echo   anh dung Cloudinary thay the).
echo  --------------------------------------------
echo.

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
echo   [2/2] Deploy Firestore rules + indexes...
echo.

call firebase deploy --only firestore:rules,firestore:indexes
if errorlevel 1 (
    echo.
    echo  --------------------------------------------
    echo   [!] Firestore deploy fail. Hoi Claude.
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
echo   Firestore rules + indexes da update.
echo   Storage: bo qua (Spark plan khong support).
echo   Cloudinary lam storage chinh - khong can Firebase Storage.
echo.
pause
