; ═══════════════════════════════════════════════════════════════════════════
;  TrishTEAM Runtime — NSIS installer script
; ═══════════════════════════════════════════════════════════════════════════
;
; Build:
;     makensis packaging/trishteam-installer.nsi
;
; Output:
;     packaging/build/TrishTEAM-Setup-${VERSION}.exe
;
; Prerequisites:
;     - PyInstaller đã build `dist/TrishTEAM/` (onedir bundle)
;     - NSIS 3.09+ với Modern UI 2 plugin (macro MUI2 có sẵn)
;
; Features:
;     - Per-user install (mặc định, không cần admin)
;     - Machine-wide install (yêu cầu UAC admin) — option trong wizard
;     - Desktop + Start Menu shortcut cho Launcher
;     - Registry: HKLM/HKCU\Software\TrishTEAM\Runtime\InstallLocation
;     - Uninstaller đăng ký trong Control Panel → Apps & Features
;     - Preserve installed apps khi uninstall (chỉ xoá Runtime + _internal)
;
; ═══════════════════════════════════════════════════════════════════════════

!define PRODUCT_NAME      "TrishTEAM"
!define PRODUCT_VERSION   "0.1.0"
!define PRODUCT_PUBLISHER "TrishTEAM"
!define PRODUCT_WEB_SITE  "https://trishteam.app"
!define PRODUCT_DIR_REGKEY "Software\TrishTEAM\Runtime"
!define UNINST_REGKEY      "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "build\TrishTEAM-Setup-${PRODUCT_VERSION}.exe"
BrandingText "TrishTEAM Runtime v${PRODUCT_VERSION}"
SetCompressor /SOLID lzma
Unicode true

; Default install = per-user (không cần admin). Wizard cho user đổi.
InstallDir "$LOCALAPPDATA\Programs\TrishTEAM"
InstallDirRegKey HKCU "${PRODUCT_DIR_REGKEY}" "InstallLocation"

RequestExecutionLevel user    ; User-level mặc định; MUI sẽ prompt UAC nếu chọn machine-wide

; ═══════════════════════════ Modern UI 2 ═══════════════════════════

!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON    "..\apps\trishlauncher\src\trishlauncher\resources\app.ico"
!define MUI_UNICON  "..\apps\trishlauncher\src\trishlauncher\resources\app.ico"

; Welcome & finish page bitmap (tuỳ chọn — comment nếu chưa có)
; !define MUI_WELCOMEFINISHPAGE_BITMAP "assets\installer-sidebar.bmp"

!define MUI_WELCOMEPAGE_TITLE_3LINES
!define MUI_WELCOMEPAGE_TITLE "Chào mừng đến với TrishTEAM"
!define MUI_WELCOMEPAGE_TEXT  "Wizard này sẽ cài TrishTEAM Runtime ${PRODUCT_VERSION} vào máy của bạn.$\r$\n$\r$\nRuntime cần thiết để các app TrishNexus (TrishFont, TrishLauncher…) chạy được. Bạn chỉ cài Runtime một lần, sau đó Launcher sẽ tự tải các app riêng lẻ.$\r$\n$\r$\nNhấn Tiếp để tiếp tục."

; --- Pages ---
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"   ; Bỏ dòng này nếu repo chưa có LICENSE
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_TITLE "Cài đặt xong!"
!define MUI_FINISHPAGE_TEXT  "TrishTEAM Runtime đã được cài thành công. Nhấn Hoàn tất để mở Launcher và bắt đầu cài các app bạn cần."
!define MUI_FINISHPAGE_RUN             "$INSTDIR\TrishTEAM.exe"
!define MUI_FINISHPAGE_RUN_TEXT        "Mở TrishLauncher ngay"
!define MUI_FINISHPAGE_SHOWREADME      "${PRODUCT_WEB_SITE}"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Mở trang chủ TrishTEAM"
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
; Custom page giữa CONFIRM và INSTFILES: hỏi user có gỡ app + user data không
UninstPage custom un.OptionsPageShow un.OptionsPageLeave
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; nsDialogs cho custom page (uninstall options)
!include "nsDialogs.nsh"

!insertmacro MUI_LANGUAGE "Vietnamese"
!insertmacro MUI_LANGUAGE "English"

; Variables cho custom uninstall page
Var Dialog
Var ChkRemoveApps
Var ChkRemoveUserData
Var ChkRemoveAppsState
Var ChkRemoveUserDataState

; ═══════════════════════════ Install section ═══════════════════════════

Section "TrishTEAM Runtime (bắt buộc)" SEC_CORE
  SectionIn RO      ; Không thể bỏ chọn — core

  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Copy toàn bộ PyInstaller onedir bundle
  File /r "..\dist\TrishTEAM\*.*"

  ; Đăng ký InstallLocation để Launcher/Install worker resolve được
  ${If} $MultiUser.InstallMode == "AllUsers"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "Version"         "${PRODUCT_VERSION}"
  ${Else}
    WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "Version"         "${PRODUCT_VERSION}"
  ${EndIf}

  ; Tạo folder apps/ để Launcher extract tpack vào đây
  CreateDirectory "$INSTDIR\apps"

  ; Ghi uninstaller + Control Panel entry
  WriteUninstaller "$INSTDIR\uninstall.exe"

  WriteRegStr   HKCU "${UNINST_REGKEY}" "DisplayName"     "TrishTEAM Runtime"
  WriteRegStr   HKCU "${UNINST_REGKEY}" "DisplayVersion"  "${PRODUCT_VERSION}"
  WriteRegStr   HKCU "${UNINST_REGKEY}" "DisplayIcon"     "$INSTDIR\TrishTEAM.exe"
  WriteRegStr   HKCU "${UNINST_REGKEY}" "Publisher"       "${PRODUCT_PUBLISHER}"
  WriteRegStr   HKCU "${UNINST_REGKEY}" "URLInfoAbout"    "${PRODUCT_WEB_SITE}"
  WriteRegStr   HKCU "${UNINST_REGKEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr   HKCU "${UNINST_REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "${UNINST_REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_REGKEY}" "NoRepair" 1

  ; Estimate install size (KB) cho Control Panel
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_REGKEY}" "EstimatedSize" "$0"
SectionEnd


Section "Desktop shortcut (TrishLauncher)" SEC_DESKTOP
  CreateShortCut "$DESKTOP\TrishLauncher.lnk" "$INSTDIR\TrishTEAM.exe" "launcher" "$INSTDIR\TrishTEAM.exe" 0
SectionEnd


Section "Start Menu shortcut" SEC_STARTMENU
  CreateDirectory "$SMPROGRAMS\TrishTEAM"
  CreateShortCut  "$SMPROGRAMS\TrishTEAM\TrishLauncher.lnk" "$INSTDIR\TrishTEAM.exe" "launcher" "$INSTDIR\TrishTEAM.exe" 0
  CreateShortCut  "$SMPROGRAMS\TrishTEAM\Uninstall TrishTEAM.lnk" "$INSTDIR\uninstall.exe"
SectionEnd


; ═══════════════════════════ Uninstall section ═══════════════════════════

; ═══════════════════════════ Uninstall custom page ═══════════════════════════

Function un.OptionsPageShow
  !insertmacro MUI_HEADER_TEXT "Tuỳ chọn gỡ cài đặt" "Chọn mức độ dọn dẹp mà bạn muốn."

  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Theo mặc định, Runtime được gỡ nhưng các app đã cài và user data (settings, favorites, licenses…) được GIỮ lại để khi cài lại Runtime bạn không mất gì."
  Pop $0

  ${NSD_CreateCheckbox} 0 40u 100% 12u "Gỡ tất cả app đã cài (TrishFont, TrishLauncher, …)"
  Pop $ChkRemoveApps

  ${NSD_CreateLabel} 16u 54u 100% 16u "→ Sẽ gọi `TrishTEAM.exe uninstall <app>` cho từng app, xoá shortcut + folder + registry entry. Dung lượng bundled data (nếu có) cũng xoá."
  Pop $0

  ${NSD_CreateCheckbox} 0 76u 100% 12u "Xoá cả user data trong %APPDATA%\TrishTEAM"
  Pop $ChkRemoveUserData

  ${NSD_CreateLabel} 16u 90u 100% 24u "→ CẢNH BÁO: Xoá vĩnh viễn settings, favorites, licenses, fontpacks cache. Không khôi phục được. Chỉ tick nếu bạn chắc chắn không cài lại nữa."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function un.OptionsPageLeave
  ${NSD_GetState} $ChkRemoveApps     $ChkRemoveAppsState
  ${NSD_GetState} $ChkRemoveUserData $ChkRemoveUserDataState
FunctionEnd


; ═══════════════════════════ Uninstall section ═══════════════════════════

Section "Uninstall"
  ; ─── Bước 1 (optional): Gỡ tất cả app đã cài qua Launcher bootstrap ───
  ${If} $ChkRemoveAppsState == ${BST_CHECKED}
    DetailPrint "Đang gỡ các app đã cài qua TrishTEAM.exe uninstall…"

    ; Iterate folder $INSTDIR\apps\* và gọi TrishTEAM.exe uninstall <app_id>
    ; trước khi xoá file (để bootstrap dọn shortcut + registry entry riêng)
    ClearErrors
    FindFirst $0 $1 "$INSTDIR\apps\*"
    ${Do}
      ${If} ${Errors}
        ${Break}
      ${EndIf}
      ${If} $1 == "."
      ${OrIf} $1 == ".."
        FindNext $0 $1
        ${Continue}
      ${EndIf}
      ${If} ${FileExists} "$INSTDIR\apps\$1\*.*"
        DetailPrint "  → uninstall $1"
        nsExec::Exec '"$INSTDIR\TrishTEAM.exe" uninstall "$1" --quiet'
      ${EndIf}
      FindNext $0 $1
    ${Loop}
    FindClose $0

    ; Sau khi bootstrap dọn xong, xoá luôn folder apps/
    RMDir /r "$INSTDIR\apps"
  ${EndIf}

  ; ─── Bước 2: Clean PyInstaller bundle ───
  Delete "$INSTDIR\TrishTEAM.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir /r "$INSTDIR\_internal"

  ; Warn user nếu còn app chưa gỡ (khi user không tick Gỡ app)
  ${If} $ChkRemoveAppsState != ${BST_CHECKED}
    ${If} ${FileExists} "$INSTDIR\apps\*.*"
      MessageBox MB_OK|MB_ICONINFORMATION "Các app đã cài trong $INSTDIR\apps được giữ lại. Bạn có thể xoá thủ công qua 'Apps & Features'."
    ${EndIf}
  ${EndIf}

  ; Xoá folder nếu rỗng
  RMDir "$INSTDIR"

  ; ─── Bước 3: Shortcuts của Launcher ───
  Delete "$DESKTOP\TrishLauncher.lnk"
  Delete "$SMPROGRAMS\TrishTEAM\TrishLauncher.lnk"
  Delete "$SMPROGRAMS\TrishTEAM\Uninstall TrishTEAM.lnk"
  RMDir  "$SMPROGRAMS\TrishTEAM"

  ; ─── Bước 4: Registry cleanup (Runtime entries) ───
  DeleteRegKey HKCU "${UNINST_REGKEY}"
  DeleteRegKey HKCU "${PRODUCT_DIR_REGKEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"

  ; ─── Bước 5 (optional): Xoá user data ───
  ${If} $ChkRemoveUserDataState == ${BST_CHECKED}
    DetailPrint "Đang xoá %APPDATA%\TrishTEAM (user data)…"
    RMDir /r "$APPDATA\TrishTEAM"
    RMDir /r "$LOCALAPPDATA\TrishLauncher"
  ${EndIf}
SectionEnd


; ═══════════════════════════ Component descriptions ═══════════════════════════

LangString DESC_SEC_CORE      ${LANG_VIETNAMESE} "TrishTEAM Runtime core — bắt buộc cho mọi app."
LangString DESC_SEC_DESKTOP   ${LANG_VIETNAMESE} "Tạo shortcut TrishLauncher trên Desktop."
LangString DESC_SEC_STARTMENU ${LANG_VIETNAMESE} "Tạo shortcut trong Start Menu (khuyến nghị)."

LangString DESC_SEC_CORE      ${LANG_ENGLISH} "TrishTEAM Runtime core — required for all apps."
LangString DESC_SEC_DESKTOP   ${LANG_ENGLISH} "Create TrishLauncher shortcut on Desktop."
LangString DESC_SEC_STARTMENU ${LANG_ENGLISH} "Create shortcut in Start Menu (recommended)."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CORE}      $(DESC_SEC_CORE)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_DESKTOP}   $(DESC_SEC_DESKTOP)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_STARTMENU} $(DESC_SEC_STARTMENU)
!insertmacro MUI_FUNCTION_DESCRIPTION_END


; ═══════════════════════════ Initialization ═══════════════════════════

Function .onInit
  ; 64-bit only
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "TrishTEAM chỉ hỗ trợ Windows 64-bit."
    Abort
  ${EndIf}

  ; Check Windows version — cần Windows 10+
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "TrishTEAM yêu cầu Windows 10 trở lên."
    Abort
  ${EndIf}
FunctionEnd
