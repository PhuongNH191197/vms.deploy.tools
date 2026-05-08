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

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .expect("in-memory DB");
        sqlx::query(
            "CREATE TABLE servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 22,
                username TEXT NOT NULL,
                auth_type TEXT NOT NULL CHECK (auth_type IN ('password','key')),
                credential BLOB NOT NULL,
                group_name TEXT NOT NULL DEFAULT 'lab',
                last_seen DATETIME
            )"
        )
        .execute(&pool).await.expect("create servers");
        pool
    }

    fn sample_input(name: &str) -> CreateServerInput {
        CreateServerInput {
            name: name.to_string(),
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_type: "password".to_string(),
            credential_plain: "secret".to_string(),
            group_name: "production".to_string(),
        }
    }

    #[tokio::test]
    async fn test_insert_then_get_all() {
        let pool = setup_db().await;
        let input = sample_input("prod-01");
        let id = insert_server(&pool, &input, vec![0u8; 16]).await.expect("insert");
        assert!(!id.is_empty(), "id is UUID");

        let rows = get_all_servers(&pool).await.expect("get_all");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "prod-01");
        assert_eq!(rows[0].host, "192.168.1.1");
        assert_eq!(rows[0].port, 22);
    }

    #[tokio::test]
    async fn test_get_server_by_id_found() {
        let pool = setup_db().await;
        let id = insert_server(&pool, &sample_input("srv"), vec![1u8; 8]).await.unwrap();
        let row = get_server_by_id(&pool, &id).await.expect("found");
        assert_eq!(row.id, id);
        assert_eq!(row.group_name, "production");
    }

    #[tokio::test]
    async fn test_get_server_by_id_not_found() {
        let pool = setup_db().await;
        let result = get_server_by_id(&pool, "nonexistent-id").await;
        assert!(result.is_err(), "should return NotFound error");
    }

    #[tokio::test]
    async fn test_delete_server() {
        let pool = setup_db().await;
        let id = insert_server(&pool, &sample_input("to-delete"), vec![]).await.unwrap();
        delete_server(&pool, &id).await.expect("delete");
        let rows = get_all_servers(&pool).await.unwrap();
        assert!(rows.is_empty());
    }

    #[tokio::test]
    async fn test_get_all_servers_sorted_by_name() {
        let pool = setup_db().await;
        insert_server(&pool, &sample_input("zzz-server"), vec![]).await.unwrap();
        insert_server(&pool, &sample_input("aaa-server"), vec![]).await.unwrap();
        insert_server(&pool, &sample_input("mmm-server"), vec![]).await.unwrap();

        let rows = get_all_servers(&pool).await.unwrap();
        assert_eq!(rows[0].name, "aaa-server");
        assert_eq!(rows[1].name, "mmm-server");
        assert_eq!(rows[2].name, "zzz-server");
    }

    #[tokio::test]
    async fn test_update_last_seen_sets_timestamp() {
        let pool = setup_db().await;
        let id = insert_server(&pool, &sample_input("srv"), vec![]).await.unwrap();

        let before = get_server_by_id(&pool, &id).await.unwrap();
        assert!(before.last_seen.is_none(), "last_seen starts null");

        update_last_seen(&pool, &id).await.expect("update");
        let after = get_server_by_id(&pool, &id).await.unwrap();
        assert!(after.last_seen.is_some(), "last_seen now set");
    }

    #[tokio::test]
    async fn test_credential_blob_stored_and_retrieved() {
        let pool = setup_db().await;
        let fake_encrypted = vec![0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x11, 0x22, 0x33];
        let id = insert_server(&pool, &sample_input("srv"), fake_encrypted.clone()).await.unwrap();
        let row = get_server_by_id(&pool, &id).await.unwrap();
        assert_eq!(row.credential, fake_encrypted);
    }
}
