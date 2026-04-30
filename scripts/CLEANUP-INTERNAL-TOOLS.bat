@echo off
chcp 65001 >nul
REM ============================================================
REM CLEANUP-INTERNAL-TOOLS.bat
REM Phase 22 prep — xóa folder internal-tools/ cũ
REM (đã move sang apps-desktop/trishiso, trishfinance)
REM ============================================================

setlocal
cd /d "%~dp0..\"

echo.
echo [Phase 22] Xoa folder internal-tools/ cu (da move sang apps-desktop)...
if exist "internal-tools" (
  rmdir /s /q "internal-tools"
  echo   - Da xoa internal-tools/
) else (
  echo   - internal-tools/ (da xoa truoc do)
)
echo.

echo Done. Verify:
dir /AD apps-desktop\ | findstr "trishiso trishfinance trishdrive"
echo.
endlocal
pause
