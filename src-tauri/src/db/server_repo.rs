use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ServerRow {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_type: String,
    pub credential: Vec<u8>,
    pub group_name: String,
    pub last_seen: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateServerInput {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub credential_plain: String,
    pub group_name: String,
}

pub async fn insert_server(pool: &SqlitePool, input: &CreateServerInput, encrypted_credential: Vec<u8>) -> Result<String, AppError> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO servers (id, name, host, port, username, auth_type, credential, group_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.host)
    .bind(input.port as i64)
    .bind(&input.username)
    .bind(&input.auth_type)
    .bind(&encrypted_credential)
    .bind(&input.group_name)
    .execute(pool)
    .await?;

    Ok(id)
}

pub async fn get_all_servers(pool: &SqlitePool) -> Result<Vec<ServerRow>, AppError> {
    let rows = sqlx::query_as::<_, ServerRow>(
        "SELECT id, name, host, port, username, auth_type, credential, group_name, last_seen FROM servers ORDER BY name"
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn get_server_by_id(pool: &SqlitePool, id: &str) -> Result<ServerRow, AppError> {
    let row = sqlx::query_as::<_, ServerRow>(
        "SELECT id, name, host, port, username, auth_type, credential, group_name, last_seen FROM servers WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Server {id} not found")))?;

    Ok(row)
}

pub async fn delete_server(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM servers WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn update_last_seen(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE servers SET last_seen = datetime('now') WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}
