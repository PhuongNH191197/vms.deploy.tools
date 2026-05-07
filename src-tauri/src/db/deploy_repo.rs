use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::error::AppError;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditRecord {
    pub id: String,
    pub server_id: String,
    pub server_name: String,
    pub module_name: String,
    pub module_version: String,
    pub action: String,
    pub status: String,
    pub operator_ip: String,
    pub operator_host: String,
    pub log_output: Option<String>,
    pub deployed_at: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DeployRecord {
    pub id: String,
    pub server_id: String,
    pub module_name: String,
    pub module_version: String,
    pub action: String,
    pub status: String,
    pub operator_ip: String,
    pub operator_host: String,
    pub log_output: Option<String>,
    pub deployed_at: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SnapshotRecord {
    pub id: String,
    pub deploy_id: String,
    pub server_id: String,
    pub module_name: String,
    pub compose_backup: String,
    pub image_tag: String,
    pub created_at: String,
}

pub async fn insert_deploy_record(
    pool: &SqlitePool,
    server_id: &str,
    module_name: &str,
    module_version: &str,
    action: &str,
    status: &str,
    operator_ip: &str,
    operator_host: &str,
    log_output: Option<&str>,
) -> Result<String, AppError> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO deploy_history (id, server_id, module_name, module_version, action, status, operator_ip, operator_host, log_output)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(server_id)
    .bind(module_name)
    .bind(module_version)
    .bind(action)
    .bind(status)
    .bind(operator_ip)
    .bind(operator_host)
    .bind(log_output)
    .execute(pool)
    .await?;
    Ok(id)
}

pub async fn update_deploy_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
    log_output: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query("UPDATE deploy_history SET status = ?, log_output = ? WHERE id = ?")
        .bind(status)
        .bind(log_output)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_deploy_history(
    pool: &SqlitePool,
    server_id: &str,
) -> Result<Vec<DeployRecord>, AppError> {
    let rows = sqlx::query_as::<_, DeployRecord>(
        "SELECT id, server_id, module_name, module_version, action, status,
                operator_ip, operator_host, log_output, deployed_at
         FROM deploy_history WHERE server_id = ?
         ORDER BY deployed_at DESC LIMIT 50"
    )
    .bind(server_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn insert_snapshot(
    pool: &SqlitePool,
    deploy_id: &str,
    server_id: &str,
    module_name: &str,
    compose_backup: &str,
    image_tag: &str,
) -> Result<String, AppError> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO snapshots (id, deploy_id, server_id, module_name, compose_backup, image_tag)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(deploy_id)
    .bind(server_id)
    .bind(module_name)
    .bind(compose_backup)
    .bind(image_tag)
    .execute(pool)
    .await?;
    Ok(id)
}

pub async fn get_audit_logs(
    pool: &SqlitePool,
    server_id: Option<&str>,
    action: Option<&str>,
    status: Option<&str>,
    search: Option<&str>,
) -> Result<Vec<AuditRecord>, AppError> {
    let search_pat = search.map(|s| format!("%{s}%"));
    let rows = sqlx::query_as::<_, AuditRecord>(
        "SELECT dh.id, dh.server_id,
                COALESCE(s.name, dh.server_id) AS server_name,
                dh.module_name, dh.module_version, dh.action, dh.status,
                dh.operator_ip, dh.operator_host, dh.log_output, dh.deployed_at
         FROM deploy_history dh
         LEFT JOIN servers s ON s.id = dh.server_id
         WHERE (? IS NULL OR dh.server_id = ?)
           AND (? IS NULL OR dh.action = ?)
           AND (? IS NULL OR dh.status = ?)
           AND (? IS NULL OR dh.module_name LIKE ? OR dh.log_output LIKE ?)
         ORDER BY dh.deployed_at DESC
         LIMIT 200"
    )
    .bind(server_id).bind(server_id)
    .bind(action).bind(action)
    .bind(status).bind(status)
    .bind(search_pat.as_deref()).bind(search_pat.as_deref()).bind(search_pat.as_deref())
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_snapshots_by_server(
    pool: &SqlitePool,
    server_id: &str,
) -> Result<Vec<SnapshotRecord>, AppError> {
    let rows = sqlx::query_as::<_, SnapshotRecord>(
        "SELECT s.id, s.deploy_id, s.server_id, s.module_name, s.compose_backup, s.image_tag, s.created_at
         FROM snapshots s
         WHERE s.server_id = ?
         ORDER BY s.created_at DESC LIMIT 30"
    )
    .bind(server_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}
