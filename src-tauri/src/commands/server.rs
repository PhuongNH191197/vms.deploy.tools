use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::crypto;
use crate::db::server_repo::{self, CreateServerInput, ServerRow};
use crate::error::AppError;
use crate::ssh::{server_info::ServerInfo, SshSession};
use crate::ssh::metrics::ServerMetrics;

pub struct DbState(pub SqlitePool);

// ──────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AddServerPayload {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String, // "password" | "key"
    pub credential: String, // plaintext password or key path
    pub group_name: String,
}

#[derive(Debug, Serialize)]
pub struct ServerDto {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_type: String,
    pub group_name: String,
    pub last_seen: Option<String>,
}

impl From<ServerRow> for ServerDto {
    fn from(r: ServerRow) -> Self {
        ServerDto {
            id: r.id,
            name: r.name,
            host: r.host,
            port: r.port,
            username: r.username,
            auth_type: r.auth_type,
            group_name: r.group_name,
            last_seen: r.last_seen,
        }
    }
}

// ──────────────────────────────────────────
// Commands
// ──────────────────────────────────────────

#[tauri::command]
pub async fn add_server(
    payload: AddServerPayload,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let encrypted = crypto::encrypt(&payload.credential).map_err(AppError::from)?;

    let input = CreateServerInput {
        name: payload.name,
        host: payload.host,
        port: payload.port,
        username: payload.username,
        auth_type: payload.auth_type,
        credential_plain: payload.credential,
        group_name: payload.group_name,
    };

    server_repo::insert_server(&state.0, &input, encrypted)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_servers(state: State<'_, DbState>) -> Result<Vec<ServerDto>, String> {
    server_repo::get_all_servers(&state.0)
        .await
        .map(|rows| rows.into_iter().map(ServerDto::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_server(id: String, state: State<'_, DbState>) -> Result<(), String> {
    server_repo::delete_server(&state.0, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_connection(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
) -> Result<String, String> {
    let mut session = match auth_type.as_str() {
        "password" => {
            SshSession::connect_password(&host, port, &username, &credential).await
        }
        "key" => {
            SshSession::connect_key(&host, port, &username, &credential, None).await
        }
        _ => return Err("Invalid auth_type".into()),
    }
    .map_err(|e| e.to_string())?;

    let result = session.execute("echo OK").await.map_err(|e| e.to_string())?;
    session.disconnect().await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub async fn fetch_server_info(
    server_id: String,
    state: State<'_, DbState>,
) -> Result<ServerInfo, String> {
    let row = server_repo::get_server_by_id(&state.0, &server_id)
        .await
        .map_err(|e| e.to_string())?;

    let credential = crypto::decrypt(&row.credential).map_err(|e| e.to_string())?;

    let mut session = match row.auth_type.as_str() {
        "password" => {
            SshSession::connect_password(&row.host, row.port as u16, &row.username, &credential).await
        }
        "key" => {
            SshSession::connect_key(&row.host, row.port as u16, &row.username, &credential, None).await
        }
        _ => return Err("Invalid auth_type".into()),
    }
    .map_err(|e| e.to_string())?;

    let info = crate::ssh::server_info::fetch_server_info(&mut session)
        .await
        .map_err(|e| e.to_string())?;

    let _ = server_repo::update_last_seen(&state.0, &server_id).await;

    session.disconnect().await.map_err(|e| e.to_string())?;

    Ok(info)
}

#[tauri::command]
pub async fn get_server_metrics(
    server_id: String,
    state: State<'_, DbState>,
) -> Result<ServerMetrics, String> {
    let row = server_repo::get_server_by_id(&state.0, &server_id)
        .await
        .map_err(|e| e.to_string())?;

    let credential = crypto::decrypt(&row.credential).map_err(|e| e.to_string())?;

    let mut session = match row.auth_type.as_str() {
        "password" => {
            SshSession::connect_password(&row.host, row.port as u16, &row.username, &credential).await
        }
        "key" => {
            SshSession::connect_key(&row.host, row.port as u16, &row.username, &credential, None).await
        }
        _ => return Err("Invalid auth_type".into()),
    }
    .map_err(|e| e.to_string())?;

    let metrics = crate::ssh::metrics::fetch_metrics(&mut session)
        .await
        .map_err(|e| e.to_string())?;

    session.disconnect().await.map_err(|e| e.to_string())?;

    Ok(metrics)
}
