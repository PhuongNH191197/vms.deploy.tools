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
                id TEXT PRIMARY KEY, name TEXT NOT NULL, host TEXT NOT NULL,
                port INTEGER NOT NULL, username TEXT NOT NULL, auth_type TEXT NOT NULL,
                credential BLOB NOT NULL, group_name TEXT NOT NULL, last_seen DATETIME
            )"
        ).execute(&pool).await.expect("servers");

        sqlx::query(
            "CREATE TABLE deploy_history (
                id TEXT PRIMARY KEY,
                server_id TEXT NOT NULL,
                module_name TEXT NOT NULL,
                module_version TEXT NOT NULL,
                action TEXT NOT NULL,
                status TEXT NOT NULL,
                operator_ip TEXT NOT NULL,
                operator_host TEXT NOT NULL,
                snapshot_path TEXT,
                log_output TEXT,
                deployed_at DATETIME NOT NULL DEFAULT (datetime('now'))
            )"
        ).execute(&pool).await.expect("deploy_history");

        sqlx::query(
            "CREATE TABLE snapshots (
                id TEXT PRIMARY KEY,
                deploy_id TEXT NOT NULL,
                server_id TEXT NOT NULL,
                module_name TEXT NOT NULL,
                compose_backup TEXT NOT NULL,
                image_tag TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT (datetime('now'))
            )"
        ).execute(&pool).await.expect("snapshots");

        // Seed a server for JOIN in get_audit_logs
        sqlx::query(
            "INSERT INTO servers (id,name,host,port,username,auth_type,credential,group_name)
             VALUES ('srv-1','prod-01','1.2.3.4',22,'admin','password',X'00','production')"
        ).execute(&pool).await.expect("seed server");

        pool
    }

    async fn insert_sample(pool: &SqlitePool, server_id: &str, action: &str, status: &str) -> String {
        insert_deploy_record(pool, server_id, "nginx", "1.0.0", action, status, "10.0.0.1", "devbox", None)
            .await
            .expect("insert")
    }

    // ── insert_deploy_record ──────────────────────────────────────────────────

    #[tokio::test]
    async fn test_insert_deploy_record_returns_id() {
        let pool = setup_db().await;
        let id = insert_sample(&pool, "srv-1", "install", "success").await;
        assert!(!id.is_empty());
    }

    #[tokio::test]
    async fn test_insert_deploy_record_with_log_output() {
        let pool = setup_db().await;
        let id = insert_deploy_record(&pool, "srv-1", "nginx", "2.0", "update", "success", "1.1.1.1", "host", Some("build ok"))
            .await.expect("insert");

        let rows = get_deploy_history(&pool, "srv-1").await.unwrap();
        assert_eq!(rows[0].id, id);
        assert_eq!(rows[0].log_output.as_deref(), Some("build ok"));
    }

    // ── update_deploy_status ──────────────────────────────────────────────────

    #[tokio::test]
    async fn test_update_deploy_status_changes_status_and_log() {
        let pool = setup_db().await;
        let id = insert_sample(&pool, "srv-1", "install", "in_progress").await;

        update_deploy_status(&pool, &id, "success", Some("done")).await.expect("update");

        let rows = get_deploy_history(&pool, "srv-1").await.unwrap();
        assert_eq!(rows[0].status, "success");
        assert_eq!(rows[0].log_output.as_deref(), Some("done"));
    }

    // ── get_deploy_history ────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_get_deploy_history_server_isolation() {
        let pool = setup_db().await;
        insert_sample(&pool, "srv-1", "install", "success").await;
        insert_sample(&pool, "other-srv", "install", "success").await;

        let rows = get_deploy_history(&pool, "srv-1").await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].server_id, "srv-1");
    }

    #[tokio::test]
    async fn test_get_deploy_history_ordered_desc() {
        let pool = setup_db().await;
        insert_sample(&pool, "srv-1", "install", "success").await;
        insert_sample(&pool, "srv-1", "update", "success").await;

        let rows = get_deploy_history(&pool, "srv-1").await.unwrap();
        assert_eq!(rows.len(), 2);
        // More recent record comes first
        assert!(rows[0].deployed_at >= rows[1].deployed_at);
    }

    // ── insert_snapshot / get_snapshots_by_server ─────────────────────────────

    #[tokio::test]
    async fn test_insert_and_get_snapshots() {
        let pool = setup_db().await;
        let deploy_id = insert_sample(&pool, "srv-1", "install", "success").await;

        let snap_id = insert_snapshot(&pool, &deploy_id, "srv-1", "nginx", "version: '3'", "nginx:1.0")
            .await.expect("insert snapshot");
        assert!(!snap_id.is_empty());

        let snaps = get_snapshots_by_server(&pool, "srv-1").await.unwrap();
        assert_eq!(snaps.len(), 1);
        assert_eq!(snaps[0].image_tag, "nginx:1.0");
        assert_eq!(snaps[0].compose_backup, "version: '3'");
    }

    #[tokio::test]
    async fn test_get_snapshots_server_isolation() {
        let pool = setup_db().await;
        let deploy_id = insert_sample(&pool, "srv-1", "install", "success").await;
        insert_snapshot(&pool, &deploy_id, "srv-1", "nginx", "...", "nginx:1.0").await.unwrap();
        insert_snapshot(&pool, &deploy_id, "other-srv", "nginx", "...", "nginx:2.0").await.unwrap();

        let snaps = get_snapshots_by_server(&pool, "srv-1").await.unwrap();
        assert_eq!(snaps.len(), 1);
        assert_eq!(snaps[0].image_tag, "nginx:1.0");
    }

    // ── get_audit_logs ────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_get_audit_logs_no_filter_returns_all() {
        let pool = setup_db().await;
        insert_sample(&pool, "srv-1", "install", "success").await;
        insert_sample(&pool, "srv-1", "rollback", "failed").await;

        let logs = get_audit_logs(&pool, None, None, None, None).await.unwrap();
        assert_eq!(logs.len(), 2);
    }

    #[tokio::test]
    async fn test_get_audit_logs_filter_by_server() {
        let pool = setup_db().await;
        insert_sample(&pool, "srv-1", "install", "success").await;
        insert_sample(&pool, "other-srv", "install", "success").await;

        let logs = get_audit_logs(&pool, Some("srv-1"), None, None, None).await.unwrap();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].server_id, "srv-1");
    }

    #[tokio::test]
    async fn test_get_audit_logs_filter_by_action() {
        let pool = setup_db().await;
        insert_sample(&pool, "srv-1", "install", "success").await;
        insert_sample(&pool, "srv-1", "rollback", "success").await;

        let logs = get_audit_logs(&pool, None, Some("rollback"), None, None).await.unwrap();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].action, "rollback");
    }

    #[tokio::test]
    async fn test_get_audit_logs_filter_by_status() {
        let pool = setup_db().await;
        insert_sample(&pool, "srv-1", "install", "success").await;
        insert_sample(&pool, "srv-1", "install", "failed").await;

        let logs = get_audit_logs(&pool, None, None, Some("failed"), None).await.unwrap();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].status, "failed");
    }

    #[tokio::test]
    async fn test_get_audit_logs_filter_by_search_module_name() {
        let pool = setup_db().await;
        // "nginx" in module_name
        insert_deploy_record(&pool, "srv-1", "nginx", "1.0", "install", "success", "1.1.1.1", "host", None).await.unwrap();
        insert_deploy_record(&pool, "srv-1", "postgres", "14", "install", "success", "1.1.1.1", "host", None).await.unwrap();

        let logs = get_audit_logs(&pool, None, None, None, Some("nginx")).await.unwrap();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].module_name, "nginx");
    }

    #[tokio::test]
    async fn test_get_audit_logs_server_name_from_join() {
        let pool = setup_db().await;
        insert_sample(&pool, "srv-1", "install", "success").await;

        let logs = get_audit_logs(&pool, Some("srv-1"), None, None, None).await.unwrap();
        assert_eq!(logs[0].server_name, "prod-01"); // resolved via LEFT JOIN
    }
}
