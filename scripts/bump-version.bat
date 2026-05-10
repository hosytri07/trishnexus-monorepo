@echo off
REM bump-version.bat — Update version trong package.json + Cargo.toml + tauri.conf.json
REM
REM Usage:
REM   bump-version.bat <app_id> <new_version>
REM
REM Example:
REM   bump-version.bat trishfont 1.0.1

setlocal

if "%~1"=="" goto :usage
if "%~2"=="" goto :usage

set SCRIPT_DIR=%~dp0
python "%SCRIPT_DIR%bump-version.py" %*
exit /b %errorlevel%

:usage
echo Usage: bump-version.bat ^<app_id^> ^<new_version^>
echo Example: bump-version.bat trishfont 1.0.1
exit /b 1
