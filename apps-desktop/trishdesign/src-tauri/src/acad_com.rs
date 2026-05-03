//! TrishDesign Phase 28.4.E — AutoCAD COM Automation.
//!
//! Connect tới AutoCAD đang chạy qua COM (Running Object Table) và gửi
//! lệnh AutoCAD command thông qua `IAcadDocument.SendCommand(string)`.
//!
//! Workflow:
//!   1. CoInitializeEx (apartment threaded)
//!   2. CLSIDFromProgID("AutoCAD.Application") → CLSID
//!   3. GetActiveObject(&CLSID, None, &mut Option<IUnknown>) → IUnknown → IDispatch (IAcadApplication)
//!   4. app.ActiveDocument → IDispatch (IAcadDocument)
//!   5. doc.SendCommand(cmd + "\n") cho từng lệnh
//!
//! Lưu ý: SendCommand cần "\n" cuối để execute, KHÔNG phải "\r\n".
//! Lệnh AutoCAD bắt đầu bằng "_" để không bị translate sang ngôn ngữ địa phương.

#[tauri::command]
pub fn autocad_check_running() -> Result<bool, String> {
    #[cfg(windows)]
    {
        let _g = win::ComGuard::new()?;
        match win::get_acad_app() {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn autocad_get_version() -> Result<String, String> {
    #[cfg(windows)]
    {
        let _g = win::ComGuard::new()?;
        let app = win::get_acad_app()?;
        win::get_version(&app)
    }
    #[cfg(not(windows))]
    {
        Err("AutoCAD COM chỉ hoạt động trên Windows.".to_string())
    }
}

#[tauri::command]
pub fn autocad_ensure_document() -> Result<(), String> {
    #[cfg(windows)]
    {
        let _g = win::ComGuard::new()?;
        let app = win::get_acad_app()?;
        win::ensure_document(&app)
    }
    #[cfg(not(windows))]
    {
        Err("AutoCAD COM chỉ hoạt động trên Windows.".to_string())
    }
}

#[tauri::command]
pub fn autocad_send_commands(commands: Vec<String>) -> Result<usize, String> {
    #[cfg(windows)]
    {
        let _g = win::ComGuard::new()?;
        let app = win::get_acad_app()?;
        let doc = win::get_active_document(&app)?;

        // Phase 28.4 fix: chunks NHỎ HƠN (~1500 char) + retry NHIỀU HƠN (50 lần)
        // + pause LÂU HƠN giữa chunks (200ms). AutoCAD HATCH command tốn nhiều
        // thời gian compute boundary, dễ gây RPC_E_CALL_REJECTED.
        const CHUNK_LIMIT: usize = 1500;
        let mut chunks: Vec<String> = Vec::new();
        let mut current = String::with_capacity(CHUNK_LIMIT);
        for cmd in commands.iter() {
            let line = if cmd.ends_with('\n') {
                cmd.clone()
            } else {
                format!("{}\n", cmd)
            };
            if !current.is_empty() && current.len() + line.len() > CHUNK_LIMIT {
                chunks.push(std::mem::take(&mut current));
            }
            current.push_str(&line);
        }
        if !current.is_empty() {
            chunks.push(current);
        }

        // Send mỗi chunk với retry logic cho RPC_E_CALL_REJECTED
        for chunk in chunks.iter() {
            let mut attempt: u64 = 0;
            loop {
                match win::invoke_method_bstr(&doc, "SendCommand", chunk) {
                    Ok(_) => break,
                    Err(e) if e.contains("0x80010001") || e.contains("ejected") => {
                        attempt += 1;
                        if attempt >= 50 {
                            return Err(format!(
                                "AutoCAD bận sau 50 lần thử (~10 giây). Có thể HATCH đang compute boundary lâu. Thử reduce số miếng hoặc đóng AutoCAD dialog đang mở. Lỗi: {}",
                                e
                            ));
                        }
                        // Backoff: 100ms × attempt (max 5s)
                        let delay = std::cmp::min(100 * attempt, 5000);
                        std::thread::sleep(std::time::Duration::from_millis(delay));
                    }
                    Err(e) => return Err(e),
                }
            }
            // Pause 200ms giữa chunks để AutoCAD xử lý hoàn toàn
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
        Ok(commands.len())
    }
    #[cfg(not(windows))]
    {
        let _ = commands;
        Err("AutoCAD COM chỉ hoạt động trên Windows.".to_string())
    }
}

// ============================================================
// Windows-only COM implementation
// ============================================================
#[cfg(windows)]
mod win {
    use std::ffi::OsStr;
    use std::os::windows::prelude::OsStrExt;

    use windows::core::{Interface, BSTR, GUID, HRESULT, PCWSTR, VARIANT};
    use windows::Win32::System::Com::{
        CLSIDFromProgID, CoInitializeEx, CoUninitialize, IDispatch, COINIT_APARTMENTTHREADED,
        DISPATCH_METHOD, DISPATCH_PROPERTYGET, DISPPARAMS,
    };
    use windows::Win32::System::Ole::GetActiveObject;

    // VT codes (windows::Win32::System::Variant::VARENUM)
    const VT_BSTR: u16 = 8;
    const VT_DISPATCH: u16 = 9;

    pub fn to_pcwstr(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(Some(0)).collect()
    }

    pub fn get_dispid(disp: &IDispatch, name: &str) -> Result<i32, String> {
        let wname = to_pcwstr(name);
        let names = [PCWSTR(wname.as_ptr())];
        let mut dispid: i32 = 0;
        unsafe {
            disp.GetIDsOfNames(&GUID::zeroed(), names.as_ptr(), 1, 0, &mut dispid)
                .map_err(|e| format!("GetIDsOfNames({}): {}", name, e))?;
        }
        Ok(dispid)
    }

    pub fn invoke_property_get(disp: &IDispatch, name: &str) -> Result<VARIANT, String> {
        let dispid = get_dispid(disp, name)?;
        let mut params = DISPPARAMS::default();
        let mut result = VARIANT::default();
        unsafe {
            disp.Invoke(
                dispid,
                &GUID::zeroed(),
                0,
                DISPATCH_PROPERTYGET,
                &mut params,
                Some(&mut result),
                None,
                None,
            )
            .map_err(|e| format!("Invoke property {}: {}", name, e))?;
        }
        Ok(result)
    }

    pub fn invoke_method_bstr(disp: &IDispatch, name: &str, arg: &str) -> Result<(), String> {
        let dispid = get_dispid(disp, name)?;
        let bstr = BSTR::from(arg);
        let mut variant_arg = VARIANT::from(bstr);
        let mut params = DISPPARAMS {
            rgvarg: &mut variant_arg,
            rgdispidNamedArgs: std::ptr::null_mut(),
            cArgs: 1,
            cNamedArgs: 0,
        };
        unsafe {
            disp.Invoke(
                dispid,
                &GUID::zeroed(),
                0,
                DISPATCH_METHOD,
                &mut params,
                None,
                None,
                None,
            )
            .map_err(|e| format!("AutoCAD lỗi khi chạy {}: {}", name, e))?;
        }
        Ok(())
    }

    /// Lấy variant type code (vt field) — bypass union/ManuallyDrop wrapping bằng raw ptr.
    fn variant_vt(var: &VARIANT) -> u16 {
        unsafe {
            // VARIANT layout: { vt: u16, wReserved1..3: u16, payload: union }
            // Đọc 2 byte đầu của VARIANT struct
            let ptr = var as *const VARIANT as *const u16;
            *ptr
        }
    }

    /// Đọc payload offset 8 của VARIANT — là pdispVal (IDispatch pointer raw).
    fn variant_payload_ptr(var: &VARIANT) -> *mut std::ffi::c_void {
        unsafe {
            // VARIANT_0_0 = { vt: u16 (offset 0), wReserved1..3: u16 (2,4,6), payload: union (offset 8) }
            // Trên x64, alignment của union với pointer field là 8 → offset 8.
            let ptr = (var as *const VARIANT as *const u8).add(8) as *const *mut std::ffi::c_void;
            *ptr
        }
    }

    /// Extract IDispatch từ VARIANT (chỉ hỗ trợ VT_DISPATCH).
    pub fn variant_to_idispatch(var: &VARIANT) -> Result<IDispatch, String> {
        let vt = variant_vt(var);
        if vt != VT_DISPATCH {
            return Err(format!(
                "VARIANT vt={} không phải VT_DISPATCH ({})",
                vt, VT_DISPATCH
            ));
        }
        let raw = variant_payload_ptr(var);
        if raw.is_null() {
            return Err("VARIANT.pdispVal null".to_string());
        }
        // Tăng refcount + tạo IDispatch wrapper từ raw pointer
        unsafe {
            // from_raw_borrowed cho IDispatch — borrow + clone tăng refcount
            let borrowed = IDispatch::from_raw_borrowed(&raw)
                .ok_or_else(|| "IDispatch::from_raw_borrowed null".to_string())?;
            Ok(borrowed.clone())
        }
    }

    /// Extract String từ VARIANT (chỉ hỗ trợ VT_BSTR).
    pub fn variant_to_string(var: &VARIANT) -> Result<String, String> {
        let vt = variant_vt(var);
        if vt != VT_BSTR {
            return Err(format!(
                "VARIANT vt={} không phải VT_BSTR ({})",
                vt, VT_BSTR
            ));
        }
        let raw = variant_payload_ptr(var) as *const u16;
        if raw.is_null() {
            return Err("VARIANT.bstrVal null".to_string());
        }
        // BSTR là wide-string null-terminated, đọc thành OsString
        unsafe {
            let mut len = 0;
            while *raw.add(len) != 0 {
                len += 1;
            }
            let slice = std::slice::from_raw_parts(raw, len);
            Ok(String::from_utf16_lossy(slice))
        }
    }

    pub struct ComGuard;
    impl ComGuard {
        pub fn new() -> Result<Self, String> {
            unsafe {
                let hr: HRESULT = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
                // S_OK (0) hoặc S_FALSE (1) đều OK; RPC_E_CHANGED_MODE (-2147417850) chấp nhận tiếp
                if hr.0 < 0 && hr.0 != -2147417850 {
                    return Err(format!("CoInitializeEx fail: 0x{:x}", hr.0));
                }
            }
            Ok(ComGuard)
        }
    }
    impl Drop for ComGuard {
        fn drop(&mut self) {
            unsafe { CoUninitialize() };
        }
    }

    pub fn get_acad_app() -> Result<IDispatch, String> {
        let prog_id = to_pcwstr("AutoCAD.Application");
        let clsid: GUID = unsafe {
            CLSIDFromProgID(PCWSTR(prog_id.as_ptr()))
                .map_err(|e| format!("AutoCAD chưa cài đặt? CLSIDFromProgID lỗi: {}", e))?
        };
        let mut unk: Option<windows::core::IUnknown> = None;
        unsafe {
            GetActiveObject(&clsid, None, &mut unk).map_err(|_| {
                "Không tìm thấy AutoCAD đang chạy. Vui lòng mở AutoCAD trước khi vẽ.".to_string()
            })?;
        }
        let unk = unk.ok_or_else(|| "GetActiveObject trả về null".to_string())?;
        let app: IDispatch = unk
            .cast()
            .map_err(|e| format!("AutoCAD object không hỗ trợ IDispatch: {}", e))?;
        Ok(app)
    }

    pub fn get_active_document(app: &IDispatch) -> Result<IDispatch, String> {
        let var = invoke_property_get(app, "ActiveDocument")?;
        variant_to_idispatch(&var)
    }

    pub fn get_version(app: &IDispatch) -> Result<String, String> {
        let var = invoke_property_get(app, "Version")?;
        variant_to_string(&var)
    }

    pub fn ensure_document(app: &IDispatch) -> Result<(), String> {
        match get_active_document(app) {
            Ok(_) => Ok(()),
            Err(_) => {
                let docs_var = invoke_property_get(app, "Documents")?;
                let docs_disp = variant_to_idispatch(&docs_var)?;
                let dispid = get_dispid(&docs_disp, "Add")?;
                let mut params = DISPPARAMS::default();
                unsafe {
                    docs_disp
                        .Invoke(
                            dispid,
                            &GUID::zeroed(),
                            0,
                            DISPATCH_METHOD,
                            &mut params,
                            None,
                            None,
                            None,
                        )
                        .map_err(|e| format!("Documents.Add lỗi: {}", e))?;
                }
                Ok(())
            }
        }
    }
}
