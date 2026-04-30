//! SQLite local index — Phase 22.5 prep schema.
//! Path: %APPDATA%/vn.trishteam.drive/index.db (Windows) hoặc tương đương.

use rusqlite::{Connection, params, Result};
use std::path::PathBuf;
use tauri::Manager;

pub fn db_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {}", e))?;
    Ok(dir.join("index.db"))
}

pub fn open(path: &PathBuf) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    init_schema(&conn)?;
    Ok(conn)
}

pub fn init_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS files (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            size_bytes  INTEGER NOT NULL,
            mime        TEXT,
            sha256_hex  TEXT NOT NULL,
            folder_id   TEXT,
            tags        TEXT,
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL,
            total_chunks INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS chunks (
            file_id     TEXT NOT NULL,
            idx         INTEGER NOT NULL,
            tg_message_id INTEGER NOT NULL,
            tg_file_id  TEXT,
            byte_size   INTEGER NOT NULL,
            nonce_hex   TEXT NOT NULL,
            uploaded_at INTEGER NOT NULL,
            PRIMARY KEY (file_id, idx),
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS folders (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            parent_id   TEXT,
            created_at  INTEGER NOT NULL,
            FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS share_links (
            token       TEXT PRIMARY KEY,
            file_id     TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            expires_at  INTEGER,
            max_downloads INTEGER,
            download_count INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
        CREATE INDEX IF NOT EXISTS idx_files_sha256 ON files(sha256_hex);
        CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id);
        "#,
    )?;
    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct FileRow {
    pub id: String,
    pub name: String,
    pub size_bytes: i64,
    pub mime: Option<String>,
    pub sha256_hex: String,
    pub folder_id: Option<String>,
    pub created_at: i64,
    pub total_chunks: i64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ChunkRow {
    pub file_id: String,
    pub idx: i64,
    pub tg_message_id: i64,
    pub tg_file_id: Option<String>,
    pub byte_size: i64,
    pub nonce_hex: String,
}

pub fn insert_file(
    conn: &Connection,
    row: &FileRow,
) -> Result<()> {
    conn.execute(
        "INSERT INTO files (id, name, size_bytes, mime, sha256_hex, folder_id, created_at, updated_at, total_chunks)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)",
        params![
            row.id, row.name, row.size_bytes, row.mime, row.sha256_hex,
            row.folder_id, row.created_at, row.total_chunks
        ],
    )?;
    Ok(())
}

pub fn insert_chunk(conn: &Connection, row: &ChunkRow) -> Result<()> {
    conn.execute(
        "INSERT INTO chunks (file_id, idx, tg_message_id, tg_file_id, byte_size, nonce_hex, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            row.file_id, row.idx, row.tg_message_id, row.tg_file_id,
            row.byte_size, row.nonce_hex,
            chrono_now_ms()
        ],
    )?;
    Ok(())
}

pub fn get_file(conn: &Connection, file_id: &str) -> Result<Option<FileRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, size_bytes, mime, sha256_hex, folder_id, created_at, total_chunks
         FROM files WHERE id = ?",
    )?;
    let mut rows = stmt.query_map(params![file_id], |r| {
        Ok(FileRow {
            id: r.get(0)?, name: r.get(1)?, size_bytes: r.get(2)?,
            mime: r.get(3)?, sha256_hex: r.get(4)?, folder_id: r.get(5)?,
            created_at: r.get(6)?, total_chunks: r.get(7)?,
        })
    })?;
    Ok(rows.next().transpose()?)
}

pub fn get_chunks(conn: &Connection, file_id: &str) -> Result<Vec<ChunkRow>> {
    let mut stmt = conn.prepare(
        "SELECT file_id, idx, tg_message_id, tg_file_id, byte_size, nonce_hex
         FROM chunks WHERE file_id = ? ORDER BY idx ASC",
    )?;
    let rows = stmt.query_map(params![file_id], |r| {
        Ok(ChunkRow {
            file_id: r.get(0)?, idx: r.get(1)?, tg_message_id: r.get(2)?,
            tg_file_id: r.get(3)?, byte_size: r.get(4)?, nonce_hex: r.get(5)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn delete_file(conn: &Connection, file_id: &str) -> Result<()> {
    // Cascade: chunks bị xoá tự động qua FOREIGN KEY ... ON DELETE CASCADE
    conn.execute("DELETE FROM files WHERE id = ?", params![file_id])?;
    Ok(())
}

fn chrono_now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn list_files(conn: &Connection, folder_id: Option<&str>, search: Option<&str>) -> Result<Vec<FileRow>> {
    let sql = match (folder_id, &search) {
        (Some(_), Some(q)) => format!(
            "SELECT id, name, size_bytes, mime, sha256_hex, folder_id, created_at, total_chunks FROM files WHERE folder_id = ? AND name LIKE '%{}%' ORDER BY created_at DESC LIMIT 500",
            escape_like(q)
        ),
        (Some(_), None) => "SELECT id, name, size_bytes, mime, sha256_hex, folder_id, created_at, total_chunks FROM files WHERE folder_id = ? ORDER BY created_at DESC LIMIT 500".to_string(),
        (None, Some(q)) => format!(
            "SELECT id, name, size_bytes, mime, sha256_hex, folder_id, created_at, total_chunks FROM files WHERE name LIKE '%{}%' ORDER BY created_at DESC LIMIT 500",
            escape_like(q)
        ),
        (None, None) => "SELECT id, name, size_bytes, mime, sha256_hex, folder_id, created_at, total_chunks FROM files ORDER BY created_at DESC LIMIT 500".to_string(),
    };
    let mut stmt = conn.prepare(&sql)?;
    let map_row = |r: &rusqlite::Row| {
        Ok(FileRow {
            id: r.get(0)?,
            name: r.get(1)?,
            size_bytes: r.get(2)?,
            mime: r.get(3)?,
            sha256_hex: r.get(4)?,
            folder_id: r.get(5)?,
            created_at: r.get(6)?,
            total_chunks: r.get(7)?,
        })
    };
    let rows = if let Some(fid) = folder_id {
        stmt.query_map(params![fid], map_row)?.collect::<Result<Vec<_>>>()?
    } else {
        stmt.query_map([], map_row)?.collect::<Result<Vec<_>>>()?
    };
    Ok(rows)
}

fn escape_like(s: &str) -> String {
    s.replace('%', "\\%").replace('_', "\\_")
}
