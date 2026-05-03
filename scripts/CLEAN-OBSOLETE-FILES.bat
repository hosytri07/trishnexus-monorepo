@echo off
chcp 65001 >nul 2>&1
title TrishNexus - Clean Obsolete Files

REM ============================================================
REM CLEAN-OBSOLETE-FILES.bat — Phase 33 cleanup (2026-05-03)
REM
REM Xoa cac file/folder OBSOLETE (Phase 21 prep + TPack format cu +
REM smoke test cu + plan Phase cu) khong con dung trong Phase 33+.
REM
REM KHAC voi CLEAN-BUILD-CACHE.bat: file nay xoa SOURCE FILES da
REM het tac dung (van con trong git history neu can restore), KHONG
REM xoa build cache (target/, node_modules/, dist/).
REM
REM An toan:
REM   - Tat ca xoa van con trong git history (git log --all)
REM   - Khong xoa file ESSENTIAL (HANDOFF, ROADMAP, CHANGELOG, AUTH, ...)
REM   - Khong xoa script .bat dang dung (START/END/SETUP/CLEAN-BUILD-CACHE)
REM   - Khong xoa source code apps-desktop, packages, website
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
echo     TrishNexus  --  CLEAN OBSOLETE FILES
echo  ============================================
echo.
echo   Project: %cd%
echo.
echo  --- Se xoa cac file/folder sau (~160KB + folder) ---
echo.
echo  SCRIPTS (Phase 21 + cu khong dung):
echo     - bootstrap_smoke.py
echo     - build-app-tpack.py
echo     - build-pack.py
echo     - CLEANUP-INTERNAL-TOOLS.bat
echo     - CLEANUP-PHASE21-PREP.bat
echo     - export-tokens.py
echo     - install_smoke.py
echo     - packaging_tiers.py
echo     - tiers_smoke.py
echo     - uninstall_smoke.py
echo     - RUN-TRISHFONT.bat
echo     - qa\ folder
echo.
echo  DOCS (plan + parity historical):
echo     - PHASE-22-PLAN.md
echo     - PARITY-WEB-TRISHADMIN.md
echo     - WEB-DESKTOP-PARITY.md
echo     - cowork-memory\ folder (memory legacy backup)
echo.
echo  --- GIU NGUYEN (essential + dang dung) ---
echo     scripts\START.bat END.bat SETUP.bat CLEAN-BUILD-CACHE.bat
echo     scripts\DEPLOY-RULES.bat RUN-TRISHADMIN.bat
echo     scripts\gen-tokens.js README.txt ci\ firebase\
echo     docs\HANDOFF-MASTER.md ROADMAP.md CHANGELOG.md
echo     docs\AUTH.md FIREBASE-SETUP.md DEPLOY-VERCEL.md
echo     docs\DOMAIN-TENTEN.md SETUP-HOME-PC.md WEBSITE.md
echo     docs\DESIGN.md design-spec.md PACKAGING.md
echo     docs\RELEASE-* FONT-PACK-* FONTPACK-WORKFLOW.md
echo     docs\ANALYTICS-UMAMI.md SENTRY-SETUP.md STORAGE-STRATEGY.md
echo     docs\release-notes\ releases\ launcher-registry\
echo.
echo  --------------------------------------------
echo   GHI CHU: file da xoa van con trong git history.
echo           Restore bang: git log --all -- ^<duong-dan^>
echo  --------------------------------------------
set /p confirm="  Tiep tuc xoa? (Y/N): "
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

REM ===== Scripts obsolete =====
for %%F in (
    bootstrap_smoke.py
    build-app-tpack.py
    build-pack.py
    CLEANUP-INTERNAL-TOOLS.bat
    CLEANUP-PHASE21-PREP.bat
    export-tokens.py
    install_smoke.py
    packaging_tiers.py
    tiers_smoke.py
    uninstall_smoke.py
    RUN-TRISHFONT.bat
) do (
    if exist "scripts\%%F" (
        echo   [scripts]  %%F
        del /q "scripts\%%F"
        set /a count+=1
    )
)

if exist "scripts\qa" (
    echo   [scripts]  qa\ folder
    rmdir /s /q "scripts\qa"
    set /a count+=1
)

REM ===== Docs obsolete =====
for %%F in (
    PHASE-22-PLAN.md
    PARITY-WEB-TRISHADMIN.md
    WEB-DESKTOP-PARITY.md
) do (
    if exist "docs\%%F" (
        echo   [docs]     %%F
        del /q "docs\%%F"
        set /a count+=1
    )
)

if exist "docs\cowork-memory" (
    echo   [docs]     cowork-memory\ folder
    rmdir /s /q "docs\cowork-memory"
    set /a count+=1
)

echo.
echo  --------------------------------------------
echo     XONG  --  Da xoa %count% file/folder
echo  --------------------------------------------
echo.
echo   Tat ca file da xoa van con trong git history.
echo   Restore neu can: git log --all -- ^<duong-dan-cu^>
echo.
echo   Buoc tiep theo:
echo     1. Chay END.bat de commit + push thay doi.
echo     2. (Tuy chon) Chay CLEAN-BUILD-CACHE.bat de xoa cache build.
echo.
pause
