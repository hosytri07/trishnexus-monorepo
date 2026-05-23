@echo off
REM Phase 44.10 - Force Tauri rebuild .exe de embed icon moi
REM Chay sau khi copy-logos.bat va truoc khi tauri:dev neu thay icon taskbar van cu.

setlocal
set "REPO=%~dp0.."

echo === Force rebuild Tauri (xoa target de embed icon moi) ===
echo.
echo Yeu cau: TAT CA 4 app phai dong (Ctrl+C tat terminal pnpm tauri:dev)!
echo.
pause

for %%A in (trishwork trishutilities trishfinance trishadmin) do (
  if exist "%REPO%\apps-desktop\%%A\src-tauri\target" (
    echo --- Xoa apps-desktop\%%A\src-tauri\target ---
    rmdir /s /q "%REPO%\apps-desktop\%%A\src-tauri\target" 2>nul
    if exist "%REPO%\apps-desktop\%%A\src-tauri\target" (
      echo [ERR] Xoa khong duoc - app dang chay hay file bi lock
    ) else (
      echo [OK] %%A target da xoa
    )
  ) else (
    echo [SKIP] %%A target khong ton tai
  )
)

echo.
echo === Done. Chay lai pnpm tauri:dev ===
echo Lan dau sau khi xoa target se mat 5-10 phut compile Rust.
echo Icon moi se duoc embed vao .exe -^> taskbar + window title hien dung.
echo.
pause
