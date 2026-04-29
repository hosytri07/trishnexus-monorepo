@echo off
chcp 65001 >nul
REM ============================================================
REM CLEANUP-PHASE21-PREP.bat
REM Phiên 2026-04-29 — dọn nhà trước khi bắt tay TrishDesign (Phase 21)
REM
REM Việc làm:
REM   A1. Xóa 4 folder deprecated apps (trishnote/trishimage/trishsearch/trishtype)
REM   A2. Xóa folder apps/ (Python/Qt legacy — đã thay bằng apps-desktop/ Tauri)
REM   A3. Xóa 3 workflow legacy (build-runtime, build-tpack, update-apps-json)
REM   A4. Move release-notes.md → docs/releases/trishlibrary-3.0.0.md
REM
REM An toàn: chỉ xóa folder/file đã được xác minh là không còn dùng.
REM Backup git có lịch sử nếu cần khôi phục.
REM ============================================================

setlocal enabledelayedexpansion
cd /d "%~dp0..\"

echo.
echo ============================================================
echo CLEANUP-PHASE21-PREP — bat dau don nha
echo ============================================================
echo.

REM --- A1: Xóa 4 deprecated apps ---
echo [A1] Xoa 4 folder apps-desktop deprecated...
for %%a in (trishnote trishimage trishsearch trishtype) do (
  if exist "apps-desktop\%%a" (
    echo   - Xoa apps-desktop\%%a
    rmdir /s /q "apps-desktop\%%a"
  ) else (
    echo   - apps-desktop\%%a (da xoa truoc do)
  )
)
echo.

REM --- A2: Xóa apps/ legacy Python/Qt ---
echo [A2] Xoa folder apps/ (Python/Qt legacy)...
if exist "apps" (
  echo   - Xoa apps\
  rmdir /s /q "apps"
) else (
  echo   - apps\ (da xoa truoc do)
)
echo.

REM --- A3: Xóa workflows legacy ---
echo [A3] Xoa 3 workflow legacy...
for %%w in (build-runtime.yml build-tpack.yml update-apps-json.yml) do (
  if exist ".github\workflows\%%w" (
    echo   - Xoa .github\workflows\%%w
    del /q ".github\workflows\%%w"
  ) else (
    echo   - .github\workflows\%%w (da xoa truoc do)
  )
)
echo.

REM --- A4: Move release-notes.md ---
echo [A4] Move release-notes.md - docs/releases/...
if not exist "docs\releases" mkdir "docs\releases"
if exist "release-notes.md" (
  if not exist "docs\releases\trishlibrary-3.0.0.md" (
    echo   - Move release-notes.md - docs\releases\trishlibrary-3.0.0.md
    move /y "release-notes.md" "docs\releases\trishlibrary-3.0.0.md" >nul
  ) else (
    echo   - docs\releases\trishlibrary-3.0.0.md da co, xoa release-notes.md goc
    del /q "release-notes.md"
  )
) else (
  echo   - release-notes.md (da xoa truoc do)
)
echo.

echo ============================================================
echo HOAN TAT CLEANUP PHASE 21 PREP
echo Tiep theo:
echo   1. git status   - kiem tra cac file da xoa
echo   2. git add -A
echo   3. git commit -m "chore: cleanup Phase 21 prep"
echo ============================================================
echo.

endlocal
pause
