use sqlx::SqlitePool;
use serde::Serialize;
use uuid::Uuid;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MetricsPoint {
    pub id: String,
    pub server_id: String,
    pub cpu_percent: i64,
    pub ram_percent: i64,
    pub ram_used_mb: i64,
    pub ram_total_mb: i64,
    pub disk_percent: i64,
    pub recorded_at: String,
}

pub async fn save_snapshot(
    pool: &SqlitePool,
    server_id: &str,
    cpu: u32,
    ram_pct: u32,
    ram_used: u64,
    ram_total: u64,
    disk: u32,
) -> Result<(), AppError> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO metrics_history (id, server_id, cpu_percent, ram_percent, ram_used_mb, ram_total_mb, disk_percent)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(server_id)
    .bind(cpu as i64)
    .bind(ram_pct as i64)
    .bind(ram_used as i64)
    .bind(ram_total as i64)
    .bind(disk as i64)
    .execute(pool)
    .await?;

    // Auto-purge data older than 48h to keep DB size bounded
    sqlx::query("DELETE FROM metrics_history WHERE recorded_at < datetime('now', '-48 hours')")
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn get_history(
    pool: &SqlitePool,
    server_id: &str,
    hours: i64,
) -> Result<Vec<MetricsPoint>, AppError> {
    let modifier = format!("-{} hours", hours);
    let rows = sqlx::query_as::<_, MetricsPoint>(
        "SELECT id, server_id, cpu_percent, ram_percent, ram_used_mb, ram_total_mb, disk_percent, recorded_at
         FROM metrics_history
         WHERE server_id = ? AND recorded_at >= datetime('now', ?)
         ORDER BY recorded_at ASC"
    )
    .bind(server_id)
    .bind(&modifier)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}
