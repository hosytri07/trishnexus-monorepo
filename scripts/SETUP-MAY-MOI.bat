@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title TrishTEAM - Setup may moi (1-click full bootstrap)

cls
echo ===============================================================
echo  TrishTEAM Monorepo - SETUP MAY MOI (1-click full bootstrap)
echo ===============================================================
echo.
echo Script nay cai TAT CA can thiet de dev TrishTEAM tu may trang:
echo.
echo   TOOLCHAIN:
echo     [1]  Git                       - version control
echo     [2]  GitHub CLI (gh)           - auth + repo helpers
echo     [3]  Node.js LTS 22.x          - chay Vite + React
echo     [4]  pnpm (qua corepack)       - workspace manager
echo     [5]  Rust toolchain            - compile Tauri backend
echo     [6]  VS Build Tools 2022 (C++) - bat buoc cho Rust tren Windows
echo     [7]  Edge WebView2 Runtime     - Tauri renderer
echo     [8]  VS Code                   - editor de cao
echo.
echo   GLOBAL CLI:
echo     [9]  Firebase CLI              - deploy rules / functions
echo     [10] Vercel CLI                - deploy website
echo.
echo   AUTH:
echo     [11] GitHub auth (gh auth login)
echo     [12] Firebase auth (firebase login)
echo     [13] Vercel auth (vercel login)
echo.
echo   REPO:
echo     [14] Clone trishnexus-monorepo
echo     [15] pnpm install (cai dependencies, ~500 MB)
echo.
echo ---------------------------------------------------------------
echo Tong dung luong: ~7-10 GB
echo Thoi gian: 25-60 phut (tuy mang)
echo ---------------------------------------------------------------
echo.
echo CAC GIA TRI MAC DINH (sua trong file .bat neu can):
echo   Repo URL : https://github.com/hosytri07/trishnexus-monorepo.git
echo   Clone to : %%USERPROFILE%%\Documents\Claude\Projects\TrishTEAM
echo   Firebase : trishteam-17c2d
echo.
echo ===============================================================
echo  Bam ENTER de bat dau, hoac dong cua so de huy.
echo ===============================================================
pause >nul

REM ===============================================================
REM  CONFIG - sua o day neu can
REM ===============================================================
set "REPO_URL=https://github.com/hosytri07/trishnexus-monorepo.git"
set "PARENT_DIR=%USERPROFILE%\Documents\Claude\Projects\TrishTEAM"
set "REPO_DIR=%PARENT_DIR%\trishnexus-monorepo"
set "FIREBASE_PROJECT=trishteam-17c2d"

REM ===============================================================
REM  STEP 0 - Kiem tra winget
REM ===============================================================
cls
echo.
echo [BUOC 0/15] Kiem tra winget...
where winget >nul 2>&1
if errorlevel 1 (
  echo.
  echo [LOI] Khong tim thay 'winget'.
  echo Mo Microsoft Store, tim "App Installer", cai dat, chay lai script nay.
  pause
  exit /b 1
)
echo   OK - winget co san.
timeout /t 1 /nobreak >nul

REM ===============================================================
REM  STEP 1 - Git
REM ===============================================================
echo.
echo [BUOC 1/15] Cai Git...
git --version >nul 2>&1
if errorlevel 1 (
  winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements --silent
) else (
  for /f "tokens=*" %%v in ('git --version 2^>nul') do echo   OK - %%v
)

REM ===============================================================
REM  STEP 2 - GitHub CLI
REM ===============================================================
echo.
echo [BUOC 2/15] Cai GitHub CLI (gh)...
gh --version >nul 2>&1
if errorlevel 1 (
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements --silent
) else (
  echo   OK - gh da co.
)

REM ===============================================================
REM  STEP 3 - Node.js LTS
REM ===============================================================
echo.
echo [BUOC 3/15] Cai Node.js LTS...
node --version >nul 2>&1
if errorlevel 1 (
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent
) else (
  for /f "tokens=*" %%v in ('node --version 2^>nul') do echo   OK - Node %%v
)

REM ===============================================================
REM  STEP 4 - Rust
REM ===============================================================
echo.
echo [BUOC 4/15] Cai Rust toolchain...
rustc --version >nul 2>&1
if errorlevel 1 (
  winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements --silent
) else (
  for /f "tokens=*" %%v in ('rustc --version 2^>nul') do echo   OK - %%v
)

REM ===============================================================
REM  STEP 5 - VS Build Tools (C++)
REM ===============================================================
echo.
echo [BUOC 5/15] Cai VS 2022 Build Tools (C++) - lon nhat ~3-5 GB, 5-15 phut...
where cl.exe >nul 2>&1
if errorlevel 1 (
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e ^
    --accept-source-agreements --accept-package-agreements ^
    --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --includeRecommended"
) else (
  echo   OK - cl.exe da co.
)

REM ===============================================================
REM  STEP 6 - WebView2
REM ===============================================================
echo.
echo [BUOC 6/15] Cai Edge WebView2 Runtime...
winget install --id Microsoft.EdgeWebView2Runtime -e --accept-source-agreements --accept-package-agreements --silent 2>nul
echo   OK.

REM ===============================================================
REM  STEP 7 - VS Code
REM ===============================================================
echo.
echo [BUOC 7/15] Cai Visual Studio Code...
code --version >nul 2>&1
if errorlevel 1 (
  winget install --id Microsoft.VisualStudioCode -e --accept-source-agreements --accept-package-agreements --silent
) else (
  echo   OK - VS Code da co.
)

REM ===============================================================
REM  STEP 8 - Refresh PATH
REM ===============================================================
echo.
echo [BUOC 8/15] Refresh PATH...
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "_SYS_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "_USR_PATH=%%b"
set "PATH=%_SYS_PATH%;%_USR_PATH%"
echo   OK - PATH refresh.

REM ===============================================================
REM  STEP 9 - corepack + pnpm
REM ===============================================================
echo.
echo [BUOC 9/15] Cau hinh pnpm qua corepack...
where node >nul 2>&1
if errorlevel 1 (
  echo   [CANH BAO] Node chua xuat hien trong PATH. Restart may sau khi script xong.
  goto :skip_node_setup
)
call corepack enable >nul 2>&1
call corepack prepare pnpm@latest --activate
echo   OK - pnpm activated.

REM ===============================================================
REM  STEP 10 - Rust default + target
REM ===============================================================
echo.
echo [BUOC 10/15] Cau hinh Rust stable + target windows-msvc...
where rustup >nul 2>&1
if not errorlevel 1 (
  call rustup default stable >nul 2>&1
  call rustup target add x86_64-pc-windows-msvc >nul 2>&1
  echo   OK.
) else (
  echo   [CANH BAO] rustup chua co trong PATH.
)

REM ===============================================================
REM  STEP 11 - Firebase CLI + Vercel CLI (npm global)
REM ===============================================================
echo.
echo [BUOC 11/15] Cai Firebase CLI + Vercel CLI (global npm)...
where npm >nul 2>&1
if errorlevel 1 (
  echo   [CANH BAO] npm chua co. Skip.
  goto :skip_global_cli
)
echo   Cai firebase-tools...
call npm install -g firebase-tools --silent 2>nul
echo   Cai vercel...
call npm install -g vercel --silent 2>nul
echo   OK.

:skip_global_cli

REM ===============================================================
REM  STEP 12 - GitHub auth
REM ===============================================================
echo.
echo ===============================================================
echo [BUOC 12/15] DANG NHAP GITHUB
echo ===============================================================
echo.
echo Tiep theo, script se mo browser de Tri dang nhap GitHub.
echo Chon: HTTPS + Login with web browser + copy code vao browser.
echo.
where gh >nul 2>&1
if errorlevel 1 (
  echo   [CANH BAO] gh chua co. Skip - se login sau bang lenh 'gh auth login'.
  goto :skip_gh
)
echo Bam ENTER de bat dau login GitHub (hoac Ctrl+C de skip)...
pause >nul
call gh auth login --hostname github.com --git-protocol https --web
:skip_gh

REM ===============================================================
REM  STEP 13 - Firebase auth
REM ===============================================================
echo.
echo ===============================================================
echo [BUOC 13/15] DANG NHAP FIREBASE
echo ===============================================================
echo.
echo Script se mo browser de login Firebase voi tai khoan Google.
echo Project: %FIREBASE_PROJECT%
echo.
where firebase >nul 2>&1
if errorlevel 1 (
  echo   [CANH BAO] firebase CLI chua co. Skip - se login sau bang 'firebase login'.
  goto :skip_firebase
)
echo Bam ENTER de bat dau login Firebase (hoac Ctrl+C de skip)...
pause >nul
call firebase login
:skip_firebase

REM ===============================================================
REM  STEP 14 - Vercel auth
REM ===============================================================
echo.
echo ===============================================================
echo [BUOC 14/15] DANG NHAP VERCEL
echo ===============================================================
echo.
echo Script se mo browser de login Vercel.
echo.
where vercel >nul 2>&1
if errorlevel 1 (
  echo   [CANH BAO] vercel CLI chua co. Skip - se login sau bang 'vercel login'.
  goto :skip_vercel
)
echo Bam ENTER de bat dau login Vercel (hoac Ctrl+C de skip)...
pause >nul
call vercel login
:skip_vercel

:skip_node_setup

REM ===============================================================
REM  STEP 15 - Clone repo + pnpm install
REM ===============================================================
echo.
echo ===============================================================
echo [BUOC 15/15] CLONE REPO + CAI DEPENDENCIES
echo ===============================================================
echo.
echo Repo URL  : %REPO_URL%
echo Clone to  : %REPO_DIR%
echo.

if exist "%REPO_DIR%\.git" (
  echo   Repo da ton tai tai %REPO_DIR%
  echo   Pull updates...
  pushd "%REPO_DIR%"
  call git pull
  popd
) else (
  echo Bam ENTER de clone repo (hoac Ctrl+C de skip)...
  pause >nul
  if not exist "%PARENT_DIR%" mkdir "%PARENT_DIR%"
  pushd "%PARENT_DIR%"
  call git clone %REPO_URL% trishnexus-monorepo
  popd
)

if exist "%REPO_DIR%\package.json" (
  echo.
  echo Cai dependencies (pnpm install)... ~3-8 phut, ~500 MB
  pushd "%REPO_DIR%"
  call pnpm install
  popd
) else (
  echo   [CANH BAO] Khong tim thay %REPO_DIR%\package.json. Skip pnpm install.
)

REM ===============================================================
REM  DONE
REM ===============================================================
echo.
echo ===============================================================
echo  HOAN TAT! MAY CO QUAN DA SAN SANG.
echo ===============================================================
echo.
echo TIEP THEO:
echo.
echo   1. DONG cmd nay + MO cmd / PowerShell MOI
echo      (de PATH co hieu luc day du)
echo.
echo   2. Cd vao repo:
echo        cd %REPO_DIR%
echo.
echo   3. Chay 1 app dev (vi du):
echo        cd apps-desktop\trishutilities
echo        pnpm tauri:dev
echo.
echo   4. Build .exe release:
echo        pnpm tauri:build
echo.
echo   5. Doc HANDOFF + huong dan Cowork:
echo        - docs\HANDOFF-MASTER.md       (tien do du an)
echo        - docs\COWORK-MAY-MOI.md       (huong dan Cowork tren may moi)
echo        - CLAUDE.md                    (memory cho AI session)
echo.
echo ---------------------------------------------------------------
echo HELP:
echo   * Neu VS Build Tools chua xong, RESTART may roi mo cmd moi.
echo   * Lan dau 'pnpm tauri:dev' build Rust mat 5-15 phut.
echo   * Cac lan sau nhanh hon (incremental compile).
echo   * 4 app desktop: trishwork, trishutilities, trishfinance, trishadmin
echo     - Moi app o thu muc apps-desktop\^<ten app^>
echo     - Chay: cd vao roi 'pnpm tauri:dev'
echo ===============================================================
echo.
pause
endlocal
