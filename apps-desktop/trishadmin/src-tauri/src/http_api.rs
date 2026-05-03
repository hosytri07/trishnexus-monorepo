//! Phase 25.0.D — Local HTTP API server cho external upload.
//!
//! Endpoints:
//!   POST   /api/upload                — multipart file upload (Bearer auth)
//!   GET    /api/files                 — list files (Bearer auth, JSON)
//!   GET    /api/file/:id/download     — download file (Bearer auth)
//!   GET    /api/health                — public health check
//!
//! Auth: header `Authorization: Bearer <token>` (token gen UUID, lưu keyring).
//!
//! Server bind 127.0.0.1:port (configurable, default 8765). KHÔNG expose ra
//! ngoài internet trừ khi user chủ động port-forward / reverse-proxy.

use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

#[derive(Clone)]
pub struct ApiState {
    pub uid: String,
    pub token: String,
    pub app_handle: tauri::AppHandle,
}

#[derive(Debug, Serialize)]
pub struct ApiUploadResponse {
    pub file_id: String,
    pub name: String,
    pub size_bytes: i64,
    pub sha256_hex: String,
    pub total_chunks: i64,
}

#[derive(Debug, Serialize)]
pub struct ApiFileItem {
    pub id: String,
    pub name: String,
    pub size_bytes: i64,
    pub created_at: i64,
    pub pipeline: String,
}

#[derive(Debug, Deserialize)]
pub struct UploadQuery {
    #[allow(dead_code)]
    pub folder_id: Option<String>,
    #[allow(dead_code)]
    pub note: Option<String>,
}

fn check_auth(state: &ApiState, headers: &HeaderMap) -> Result<(), StatusCode> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    let prefix = "Bearer ";
    if !auth.starts_with(prefix) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let token = auth[prefix.len()..].trim();
    if token != state.token {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(())
}

async fn handle_health() -> &'static str {
    "ok — TrishDrive HTTP API ready"
}

async fn handle_upload(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<ApiUploadResponse>, (StatusCode, String)> {
    check_auth(&state, &headers).map_err(|s| (s, "Unauthorized".into()))?;

    // Save uploaded file to temp first
    let mut filename: Option<String> = None;
    let mut tmp_path: Option<std::path::PathBuf> = None;
    let mut folder_id: Option<String> = None;
    let mut note: Option<String> = None;

    while let Some(field) = multipart.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("multipart: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "file" => {
                let fname = field.file_name().unwrap_or("upload.bin").to_string();
                let tmp = std::env::temp_dir().join(format!(
                    "trishdrive-api-{}-{}",
                    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_nanos()).unwrap_or(0),
                    sanitize(&fname)
                ));
                let mut f = tokio::fs::File::create(&tmp).await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("create tmp: {}", e)))?;
                let bytes = field.bytes().await
                    .map_err(|e| (StatusCode::BAD_REQUEST, format!("read field: {}", e)))?;
                f.write_all(&bytes).await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("write tmp: {}", e)))?;
                f.flush().await.ok();
                filename = Some(fname);
                tmp_path = Some(tmp);
            }
            "folder_id" => {
                folder_id = field.text().await.ok().filter(|s| !s.is_empty());
            }
            "note" => {
                note = field.text().await.ok().filter(|s| !s.is_empty());
            }
            _ => {}
        }
    }

    let _ = filename.ok_or((StatusCode::BAD_REQUEST, "Missing 'file' field".into()))?;
    let path = tmp_path.ok_or((StatusCode::BAD_REQUEST, "Missing 'file' field".into()))?;
    let path_str = path.to_string_lossy().to_string();

    // Call existing file_upload_auto via Tauri command. Need to invoke directly
    // but file_upload_auto is `#[tauri::command]` async fn. Re-implement minimal
    // dispatch: just call the Rust function. Since they're in same crate, we
    // can call them directly — but they're declared in lib.rs. We'll expose a
    // helper for HTTP API.
    let result = crate::http_api_dispatch_upload(
        state.app_handle.clone(),
        state.uid.clone(),
        path_str.clone(),
        folder_id,
        note,
    ).await;

    let _ = std::fs::remove_file(&path);

    let r = result.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(ApiUploadResponse {
        file_id: r.file_id,
        name: r.name,
        size_bytes: r.size_bytes,
        sha256_hex: r.sha256_hex,
        total_chunks: r.total_chunks,
    }))
}

async fn handle_list_files(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<ApiFileItem>>, (StatusCode, String)> {
    check_auth(&state, &headers).map_err(|s| (s, "Unauthorized".into()))?;
    let items = crate::http_api_dispatch_list(state.app_handle.clone())
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(items))
}

async fn handle_download(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(file_id): Path<String>,
) -> Result<axum::response::Response, (StatusCode, String)> {
    check_auth(&state, &headers).map_err(|s| (s, "Unauthorized".into()))?;
    let bytes = crate::http_api_dispatch_download(state.app_handle.clone(), state.uid.clone(), file_id.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    use axum::response::IntoResponse;
    let resp = (
        [
            (axum::http::header::CONTENT_TYPE, "application/octet-stream"),
            (axum::http::header::CONTENT_DISPOSITION, "attachment"),
        ],
        bytes,
    ).into_response();
    Ok(resp)
}

fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

pub async fn run_server(state: ApiState, port: u16) -> Result<(), String> {
    let state = Arc::new(state);
    let app = Router::new()
        .route("/api/health", get(handle_health))
        .route("/api/upload", post(handle_upload))
        .route("/api/files", get(handle_list_files))
        .route("/api/file/:id/download", get(handle_download))
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024 * 1024)) // 2GB max
        .with_state(state);
    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await
        .map_err(|e| format!("bind {}: {}", addr, e))?;
    axum::serve(listener, app).await.map_err(|e| format!("serve: {}", e))?;
    Ok(())
}
