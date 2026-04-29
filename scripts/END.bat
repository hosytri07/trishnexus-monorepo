@echo off
chcp 65001 >nul 2>&1
title TrishNexus - Ket thuc phien

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

REM === Detect machine label ===
set "MACHINE=unknown"
if exist ".machine-label" (
    set /p MACHINE=<.machine-label
)

cls
echo.
echo  ============================================
if "%MACHINE%"=="home" (
    echo     TrishNexus  --  KET THUC PHIEN MAY NHA
) else if "%MACHINE%"=="office" (
    echo     TrishNexus  --  KET THUC PHIEN MAY CO QUAN
) else (
    echo     TrishNexus  --  KET THUC PHIEN
)
echo  ============================================
echo.
echo   Project: %cd%
echo.
echo  --------------------------------------------
echo.
echo   [REMINDER] Truoc khi luu, anh da:
echo     - Cap nhat docs\HANDOFF-MASTER.md chua?
echo       (section "PICK UP TU DAY" cho phien ke)
echo.
set "CONTINUE="
set /p "CONTINUE=  Tiep tuc luu? (Y/N): "
if /i not "%CONTINUE%"=="Y" (
    echo.
    echo   Da huy. Update handoff truoc roi chay lai END.bat.
    pause
    exit /b 0
)

echo.
echo   [1/4] Kiem tra co gi thay doi khong...
echo.

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
if "%MSG%"=="" (
    if "%MACHINE%"=="home" (
        set "MSG=wip: end of home session"
    ) else if "%MACHINE%"=="office" (
        set "MSG=wip: end of office session"
    ) else (
        set "MSG=wip: end of session"
    )
)

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
    echo   [!] Push that bai. Co the do:
    echo       - Mat internet
    echo       - Cau hinh git auth chua co
    echo.
    echo   Mo Cowork Desktop va hoi Claude de fix.
    echo  --------------------------------------------
    echo.
    pause
    exit /b 1
)

:done
echo.
echo  ============================================
if "%MACHINE%"=="home" (
    echo     DA LUU XONG  --  Het phien may NHA
    echo  ============================================
    echo.
    echo   Lan toi den co quan, chay START.bat de pull.
) else if "%MACHINE%"=="office" (
    echo     DA LUU XONG  --  Het phien may CO QUAN
    echo  ============================================
    echo.
    echo   Lan toi ve nha, chay START.bat de pull.
) else (
    echo     DA LUU XONG  --  Het phien
    echo  ============================================
)
echo.
echo   Cua so nay co the dong.
echo.
pause
exit /b 0

:err_add
echo.
echo   [!] Git add that bai. Hoi Claude.
pause
exit /b 1
