@echo off
REM Check icon.ico cua 4 app: thoi gian sua + size
REM De biet app nao da gen icon, app nao chua.

setlocal
set "REPO=%~dp0.."

echo === Check icon files cua 4 app ===
echo Thoi gian hien tai: %DATE% %TIME%
echo.

for %%A in (trishwork trishutilities trishfinance trishadmin) do (
  echo --- %%A ---
  if exist "%REPO%\apps-desktop\%%A\src-tauri\icons\icon.ico" (
    for %%F in ("%REPO%\apps-desktop\%%A\src-tauri\icons\icon.ico") do (
      echo   icon.ico: %%~zF bytes  ^| mtime: %%~tF
    )
  ) else (
    echo   icon.ico: KHONG TON TAI
  )
  if exist "%REPO%\apps-desktop\%%A\src-tauri\icons\icon.png" (
    for %%F in ("%REPO%\apps-desktop\%%A\src-tauri\icons\icon.png") do (
      echo   icon.png: %%~zF bytes  ^| mtime: %%~tF
    )
  )
  if exist "%REPO%\apps-desktop\%%A\src-tauri\icons\32x32.png" (
    for %%F in ("%REPO%\apps-desktop\%%A\src-tauri\icons\32x32.png") do (
      echo   32x32.png: %%~zF bytes  ^| mtime: %%~tF
    )
  )
  echo.
)

echo === Source PNG ===
for %%F in ("%REPO%\packages\design-system\src\assets\logo-work.png" "%REPO%\packages\design-system\src\assets\logo-utilities.png" "%REPO%\packages\design-system\src\assets\logo-finance.png" "%REPO%\packages\design-system\src\assets\logo-admin.png") do (
  if exist "%%F" (
    for %%G in ("%%F") do echo   %%~nxG: %%~zG bytes  ^| mtime: %%~tG
  )
)

echo.
echo === Done ===
pause
