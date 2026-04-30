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
    // Migration: add columns nếu DB cũ thiếu (silent ignore nếu duplicate)
    let _ = conn.execute("ALTER TABLE files ADD COLUMN note TEXT", []);
    let _ = conn.execute("ALTER TABLE files ADD COLUMN deleted_at INTEGER", []);
    // Phase 23.4: 'botapi' (default, Bot API + 19MB chunk) hoặc 'mtproto' (user account + 100MB chunk)
    let _ = conn.execute("ALTER TABLE files ADD COLUMN pipeline TEXT NOT NULL DEFAULT 'botapi'", []);
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
            note        TEXT,
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL,
            total_chunks INTEGER NOT NULL DEFAULT 1
        );
        -- Migration v2: add note column nếu DB cũ chưa có (SQLite tolerate dup)
        -- Nếu lỗi "duplicate column", bỏ qua silently qua try.
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
    pub note: Option<String>,
    pub deleted_at: Option<i64>,
    /// Phase 23.4: 'botapi' hoặc 'mtproto' — quyết định download/purge route
    #[serde(default = "default_pipeline")]
    pub pipeline: String,
}

fn default_pipeline() -> String { "botapi".to_string() }

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct FolderRow {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub created_at: i64,
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
        "INSERT INTO files (id, name, size_bytes, mime, sha256_hex, folder_id, created_at, updated_at, total_chunks, note, pipeline)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, ?9, ?10)",
        params![
            row.id, row.name, row.size_bytes, row.mime, row.sha256_hex,
            row.folder_id, row.created_at, row.total_chunks, row.note,
            row.pipeline
        ],
    )?;
    Ok(())
}

pub fn update_file_meta(
    conn: &Connection,
    file_id: &str,
    name: Option<&str>,
    folder_id: Option<&str>,
    note: Option<&str>,
) -> Result<()> {
    if let Some(n) = name {
        conn.execute("UPDATE files SET name = ?, updated_at = ? WHERE id = ?", params![n, chrono_now_ms(), file_id])?;
    }
    if let Some(f) = folder_id {
        conn.execute("UPDATE files SET folder_id = ?, updated_at = ? WHERE id = ?", params![f, chrono_now_ms(), file_id])?;
    }
    if let Some(nt) = note {
        conn.execute("UPDATE files SET note = ?, updated_at = ? WHERE id = ?", params![nt, chrono_now_ms(), file_id])?;
    }
    Ok(())
}

// ===== Folder CRUD =====
pub fn insert_folder(conn: &Connection, row: &FolderRow) -> Result<()> {
    conn.execute(
        "INSERT INTO folders (id, name, parent_id, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![row.id, row.name, row.parent_id, row.created_at],
    )?;
    Ok(())
}

pub fn list_folders(conn: &Connection) -> Result<Vec<FolderRow>> {
    let mut stmt = conn.prepare("SELECT id, name, parent_id, created_at FROM folders ORDER BY name ASC")?;
    let rows = stmt.query_map([], |r| {
        Ok(FolderRow {
            id: r.get(0)?, name: r.get(1)?,
            parent_id: r.get(2)?, created_at: r.get(3)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn rename_folder(conn: &Connection, id: &str, name: &str) -> Result<()> {
    conn.execute("UPDATE folders SET name = ? WHERE id = ?", params![name, id])?;
    Ok(())
}

pub fn delete_folder(conn: &Connection, id: &str) -> Result<()> {
    // Set folder_id của files trong folder này về NULL (root)
    conn.execute("UPDATE files SET folder_id = NULL WHERE folder_id = ?", params![id])?;
    conn.execute("DELETE FROM folders WHERE id = ?", params![id])?;
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
        "SELECT id, name, size_bytes, mime, sha256_hex, folder_id, created_at, total_chunks, note, deleted_at, pipeline
         FROM files WHERE id = ?",
    )?;
    let mut rows = stmt.query_map(params![file_id], |r| {
        Ok(FileRow {
            id: r.get(0)?, name: r.get(1)?, size_bytes: r.get(2)?,
            mime: r.get(3)?, sha256_hex: r.get(4)?, folder_id: r.get(5)?,
            created_at: r.get(6)?, total_chunks: r.get(7)?, note: r.get(8)?,
            deleted_at: r.get(9)?,
            pipeline: r.get(10)?,
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
    // Hard delete — cascade chunks via FOREIGN KEY ON DELETE CASCADE.
    // Phase 22.7f: dùng soft_delete cho user action (vào Trash 30 ngày).
    conn.execute("DELETE FROM files WHERE id = ?", params![file_id])?;
    Ok(())
}

/// Soft delete — file vào Trash, vẫn còn chunks Telegram + SQLite, có thể restore.
pub fn soft_delete_file(conn: &Connection, file_id: &str) -> Result<()> {
    conn.execute("UPDATE files SET deleted_at = ? WHERE id = ?", params![chrono_now_ms(), file_id])?;
    Ok(())
}

pub fn restore_file(conn: &Connection, file_id: &str) -> Result<()> {
    conn.execute("UPDATE files SET deleted_at = NULL WHERE id = ?", params![file_id])?;
    Ok(())
}

/// List file đã trash (deleted_at IS NOT NULL) sort theo deleted_at desc.
pub fn list_trashed(conn: &Connection) -> Result<Vec<FileRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, size_bytes, mime, sha256_hex, folder_id, created_at, total_chunks, note, deleted_at, pipeline
         FROM files WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 500",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(FileRow {
            id: r.get(0)?, name: r.get(1)?, size_bytes: r.get(2)?,
            mime: r.get(3)?, sha256_hex: r.get(4)?, folder_id: r.get(5)?,
            created_at: r.get(6)?, total_chunks: r.get(7)?,
            note: r.get(8)?, deleted_at: r.get(9)?,
            pipeline: r.get(10)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

/// Tìm file trashed cũ hơn `older_than_ms` để purge auto.
pub fn list_trashed_older_than(conn: &Connection, older_than_ms: i64) -> Result<Vec<FileRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, size_bytes, mime, sha256_hex, folder_id, created_at, total_chunks, note, deleted_at, pipeline
         FROM files WHERE deleted_at IS NOT NULL AND deleted_at < ?",
    )?;
    let rows = stmt.query_map(params![older_than_ms], |r| {
        Ok(FileRow {
            id: r.get(0)?, name: r.get(1)?, size_bytes: r.get(2)?,
            mime: r.get(3)?, sha256_hex: r.get(4)?, folder_id: r.get(5)?,
            created_at: r.get(6)?, total_chunks: r.get(7)?,
            note: r.get(8)?, deleted_at: r.get(9)?,
            pipeline: r.get(10)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

fn chrono_now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn list_files(conn: &Connection, folder_id: Option<&str>, search: Option<&str>) -> Result<Vec<FileRow>> {
    // List active files only (deleted_at IS NULL). Trash dùng list_trashed.
    let cols = "SELECT id, name, size_bytes, mime, sha256_hex, folder_id, created_at, total_chunks, note, deleted_at, pipeline FROM files";
    let order = "ORDER BY created_at DESC LIMIT 500";
    let sql = match (folder_id, &search) {
        (Some(_), Some(q)) => format!("{} WHERE deleted_at IS NULL AND folder_id = ? AND name LIKE '%{}%' {}", cols, escape_like(q), order),
        (Some(_), None) => format!("{} WHERE deleted_at IS NULL AND folder_id = ? {}", cols, order),
        (None, Some(q)) => format!("{} WHERE deleted_at IS NULL AND name LIKE '%{}%' {}", cols, escape_like(q), order),
        (None, None) => format!("{} WHERE deleted_at IS NULL {}", cols, order),
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
            note: r.get(8)?,
            deleted_at: r.get(9)?,
            pipeline: r.get(10)?,
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
