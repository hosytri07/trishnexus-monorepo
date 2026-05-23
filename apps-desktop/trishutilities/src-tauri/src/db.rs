//! TrishDrive USER app — local SQLite cho download history + folder tags + notes.
//! Phase 26.1.A — schema mới, drop tables admin (files/chunks/folders/share_links cũ).
//! Phase 26.1.B sẽ implement đầy đủ schema download_history.
//!
//! Path: %APPDATA%/vn.trishteam.drive/user.db (đổi từ index.db để tránh conflict
//! với DB cũ admin nếu user đã từng dùng TrishDrive standalone trước Phase 26).

use rusqlite::{Connection, Result};
use std::path::PathBuf;
use tauri::Manager;

pub fn db_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {}", e))?;
    Ok(dir.join("user.db"))
}

pub fn open(path: &PathBuf) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    init_schema(&conn)?;
    Ok(conn)
}

pub fn init_schema(conn: &Connection) -> Result<()> {
    // Phase 26.1.A — schema skeleton. Phase 26.1.B sẽ thêm columns + indexes.
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS download_history (
            id          TEXT PRIMARY KEY,
            file_name   TEXT NOT NULL,
            size_bytes  INTEGER NOT NULL,
            sha256_hex  TEXT NOT NULL,
            source_url  TEXT NOT NULL,
            dest_path   TEXT,
            downloaded_at INTEGER NOT NULL,
            tag         TEXT,
            note        TEXT,
            bookmarked  INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_history_date ON download_history(downloaded_at DESC);
        CREATE INDEX IF NOT EXISTS idx_history_sha ON download_history(sha256_hex);
        CREATE INDEX IF NOT EXISTS idx_history_bookmarked ON download_history(bookmarked);
        "#,
    )?;
    Ok(())
}
