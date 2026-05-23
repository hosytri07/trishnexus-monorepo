//! Phase 25.1.E — WebDAV mount cho TrishDrive USER app.
//!
//! Architecture:
//!   - Cache local: app_data_dir/webdav_cache/library/
//!   - WebDAV server (read-only) serve cache dir qua port local
//!   - User Map Network Drive → ổ Z:\ (drive letter user tự chọn)
//!   - Trên file open lần đầu: chưa download → user phải bấm "Sync" trước
//!     Phase tương lai: lazy fetch on-demand qua custom DavFileSystem.
//!
//! LRU cache cap 2GB (configurable, default 2GB):
//!   - Trước mỗi lần download mới, check tổng size cache
//!   - Nếu > cap → xoá LRU theo mtime tăng dần đến khi < cap*0.8

use dav_server::{DavHandler, fakels::FakeLs, localfs::LocalFs};
use http_body_util::{BodyExt, Full};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Manager;

/// Default cache cap 2GB. User configure được qua Settings.
pub const DEFAULT_CACHE_CAP_BYTES: u64 = 2 * 1024 * 1024 * 1024;

pub fn cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?;
    let cache = dir.join("webdav_cache").join("library");
    std::fs::create_dir_all(&cache).map_err(|e| format!("mkdir cache: {}", e))?;
    // Phase 25.1.E.2 — sub-folders structure
    std::fs::create_dir_all(cache.join("TrishTEAM Library"))
        .map_err(|e| format!("mkdir TrishTEAM Library: {}", e))?;
    std::fs::create_dir_all(cache.join("My Shares"))
        .map_err(|e| format!("mkdir My Shares: {}", e))?;
    Ok(cache)
}

/// Tổng size cache hiện tại (recursive, theo bytes).
pub fn cache_size(dir: &Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(rd) = std::fs::read_dir(dir) {
        for ent in rd.flatten() {
            let p = ent.path();
            if p.is_dir() {
                total += cache_size(&p);
            } else if let Ok(meta) = ent.metadata() {
                total += meta.len();
            }
        }
    }
    total
}

/// Evict LRU files theo mtime tăng dần đến khi cache size < target.
/// Trả về (n_files_deleted, bytes_freed).
pub fn evict_lru(dir: &Path, target: u64) -> (usize, u64) {
    let current = cache_size(dir);
    if current <= target {
        return (0, 0);
    }
    let mut all_files: Vec<(PathBuf, std::time::SystemTime, u64)> = Vec::new();
    fn walk(dir: &Path, out: &mut Vec<(PathBuf, std::time::SystemTime, u64)>) {
        if let Ok(rd) = std::fs::read_dir(dir) {
            for ent in rd.flatten() {
                let p = ent.path();
                if p.is_dir() {
                    walk(&p, out);
                } else if let Ok(meta) = ent.metadata() {
                    let mtime = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
                    out.push((p, mtime, meta.len()));
                }
            }
        }
    }
    walk(dir, &mut all_files);
    all_files.sort_by_key(|(_, m, _)| *m);

    let mut freed: u64 = 0;
    let mut count = 0;
    let mut size_now = current;
    for (p, _, sz) in all_files {
        if size_now <= target { break; }
        if std::fs::remove_file(&p).is_ok() {
            size_now -= sz;
            freed += sz;
            count += 1;
        }
    }
    (count, freed)
}

/// Bind HTTP server cho WebDAV trên 127.0.0.1:port.
pub async fn run_webdav(
    cache_dir: PathBuf,
    port: u16,
) -> Result<(), String> {
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;

    let dav_server = DavHandler::builder()
        .filesystem(LocalFs::new(&cache_dir, /*public=*/ false, /*case_insensitive=*/ true, /*macos=*/ false))
        .locksystem(FakeLs::new())
        .build_handler();
    let dav = Arc::new(dav_server);

    let addr: std::net::SocketAddr = format!("127.0.0.1:{}", port)
        .parse()
        .map_err(|e| format!("bind addr: {}", e))?;
    let listener = tokio::net::TcpListener::bind(addr).await
        .map_err(|e| format!("bind {}: {}", addr, e))?;

    loop {
        let (stream, _) = match listener.accept().await {
            Ok(v) => v,
            Err(e) => {
                eprintln!("[webdav] accept error: {}", e);
                continue;
            }
        };
        let io = TokioIo::new(stream);
        let dav_clone = dav.clone();
        tokio::spawn(async move {
            let svc = service_fn(move |req: hyper::Request<hyper::body::Incoming>| {
                let dav = dav_clone.clone();
                async move {
                    // Convert hyper Incoming → bytes::Bytes → Full<Bytes> (impl HttpBody)
                    let (parts, body) = req.into_parts();
                    let body_bytes = match body.collect().await {
                        Ok(b) => b.to_bytes(),
                        Err(e) => {
                            eprintln!("[webdav] read body: {}", e);
                            bytes::Bytes::new()
                        }
                    };
                    let req_full = hyper::Request::from_parts(parts, Full::new(body_bytes));
                    Ok::<_, std::convert::Infallible>(dav.handle(req_full).await)
                }
            });
            if let Err(e) = hyper::server::conn::http1::Builder::new()
                .serve_connection(io, svc)
                .await
            {
                eprintln!("[webdav] connection error: {}", e);
            }
        });
    }
}
