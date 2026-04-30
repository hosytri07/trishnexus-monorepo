//! Telegram Bot API client. Phase 22.4 + 22.5 + 22.6.

use serde::{Deserialize, Serialize};

const TG_API: &str = "https://api.telegram.org";

#[derive(Debug, Serialize, Deserialize)]
pub struct BotInfo {
    pub id: i64,
    pub is_bot: bool,
    pub first_name: String,
    pub username: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatInfo {
    pub id: i64,
    #[serde(rename = "type")]
    pub chat_type: String,
    pub title: Option<String>,
    pub username: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DocumentInfo {
    pub file_id: String,
    pub file_unique_id: String,
    pub file_name: Option<String>,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct MessageInfo {
    pub message_id: i64,
    pub document: Option<DocumentInfo>,
}

#[derive(Debug, Deserialize)]
pub struct FilePathInfo {
    pub file_id: String,
    pub file_unique_id: String,
    pub file_size: Option<i64>,
    pub file_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiResponse<T> {
    ok: bool,
    description: Option<String>,
    result: Option<T>,
}

fn unwrap_response<T>(body: ApiResponse<T>) -> Result<T, String> {
    if body.ok {
        body.result.ok_or_else(|| "API ok=true but result missing".to_string())
    } else {
        Err(body.description.unwrap_or_else(|| "Unknown Telegram error".to_string()))
    }
}

pub async fn get_me(token: &str) -> Result<BotInfo, String> {
    let url = format!("{}/bot{}/getMe", TG_API, token);
    let resp = reqwest::Client::new().get(&url).send().await.map_err(|e| format!("HTTP: {}", e))?;
    let body: ApiResponse<BotInfo> = resp.json().await.map_err(|e| format!("JSON: {}", e))?;
    unwrap_response(body)
}

pub async fn get_chat(token: &str, chat_id: i64) -> Result<ChatInfo, String> {
    let url = format!("{}/bot{}/getChat?chat_id={}", TG_API, token, chat_id);
    let resp = reqwest::Client::new().get(&url).send().await.map_err(|e| format!("HTTP: {}", e))?;
    let body: ApiResponse<ChatInfo> = resp.json().await.map_err(|e| format!("JSON: {}", e))?;
    unwrap_response(body)
}

/// Upload file (raw bytes) lên Telegram channel qua sendDocument.
/// Bot API limit 50MB/file — Phase 22.5b sẽ chunk.
pub async fn send_document(
    token: &str,
    chat_id: i64,
    file_data: Vec<u8>,
    filename: &str,
) -> Result<MessageInfo, String> {
    let url = format!("{}/bot{}/sendDocument", TG_API, token);
    let part = reqwest::multipart::Part::bytes(file_data)
        .file_name(filename.to_string());
    let form = reqwest::multipart::Form::new()
        .text("chat_id", chat_id.to_string())
        .part("document", part);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300)) // 5 phút cho 50MB
        .build()
        .map_err(|e| format!("client build: {}", e))?;
    let resp = client.post(&url).multipart(form).send().await.map_err(|e| format!("HTTP: {}", e))?;
    let body: ApiResponse<MessageInfo> = resp.json().await.map_err(|e| format!("JSON: {}", e))?;
    unwrap_response(body)
}

/// Lấy file_path từ file_id (sau đó dùng file_path để download).
pub async fn get_file(token: &str, file_id: &str) -> Result<FilePathInfo, String> {
    let url = format!("{}/bot{}/getFile?file_id={}", TG_API, token, file_id);
    let resp = reqwest::Client::new().get(&url).send().await.map_err(|e| format!("HTTP: {}", e))?;
    let body: ApiResponse<FilePathInfo> = resp.json().await.map_err(|e| format!("JSON: {}", e))?;
    unwrap_response(body)
}

/// Download bytes từ file_path (cần file_path từ get_file).
pub async fn download_file_bytes(token: &str, file_path: &str) -> Result<Vec<u8>, String> {
    let url = format!("{}/file/bot{}/{}", TG_API, token, file_path);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("client build: {}", e))?;
    let resp = client.get(&url).send().await.map_err(|e| format!("HTTP: {}", e))?;
    let bytes = resp.bytes().await.map_err(|e| format!("read bytes: {}", e))?;
    Ok(bytes.to_vec())
}

/// Xoá tin nhắn (file) trên Telegram channel.
pub async fn delete_message(token: &str, chat_id: i64, message_id: i64) -> Result<bool, String> {
    let url = format!(
        "{}/bot{}/deleteMessage?chat_id={}&message_id={}",
        TG_API, token, chat_id, message_id
    );
    let resp = reqwest::Client::new().get(&url).send().await.map_err(|e| format!("HTTP: {}", e))?;
    let body: ApiResponse<bool> = resp.json().await.map_err(|e| format!("JSON: {}", e))?;
    unwrap_response(body)
}
