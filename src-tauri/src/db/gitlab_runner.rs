use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use crate::error::AppError;

// ── Row types ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct GitLabRunnerRow {
    pub id: i64,
    pub server_id: String,
    pub project_name: String,
    pub runner_name: String,
    pub tags: String,
    pub executor: String,
    pub gitlab_url: String,
    pub token_masked: String,
    pub status: String,
    pub last_job_status: String,
    pub last_checked_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, sqlx::FromRow, Clone)]
pub struct GitLabRunnerRowWithServer {
    pub id: i64,
    pub server_id: String,
    pub server_name: String,
    pub project_name: String,
    pub runner_name: String,
    pub tags: String,
    pub executor: String,
    pub gitlab_url: String,
    pub token_masked: String,
    pub status: String,
    pub last_job_status: String,
    pub last_checked_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct GitLabApiSettingsRow {
    pub id: i64,
    pub gitlab_url: String,
    pub api_token_enc: Vec<u8>,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

// ── Input types ───────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct InsertRunnerInput {
    pub server_id: String,
    pub project_name: String,
    pub runner_name: String,
    pub tags: String,
    pub executor: String,
    pub gitlab_url: String,
    pub token_masked: String,
}

#[derive(Debug, Deserialize, Default)]
pub struct ListRunnersFilter {
    pub server_id: Option<String>,
    pub project_name: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
}

// ── Runner CRUD ───────────────────────────────────────────────────────────────

pub async fn insert_runner(pool: &SqlitePool, input: &InsertRunnerInput) -> Result<i64, AppError> {
    sqlx::query(
        "INSERT INTO gitlab_runners
         (server_id, project_name, runner_name, tags, executor, gitlab_url, token_masked)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&input.server_id)
    .bind(&input.project_name)
    .bind(&input.runner_name)
    .bind(&input.tags)
    .bind(&input.executor)
    .bind(&input.gitlab_url)
    .bind(&input.token_masked)
    .execute(pool)
    .await?;

    let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(pool)
        .await?;
    Ok(id)
}

pub async fn upsert_runner(pool: &SqlitePool, input: &InsertRunnerInput) -> Result<i64, AppError> {
    let existing: Option<GitLabRunnerRow> = sqlx::query_as::<_, GitLabRunnerRow>(
        "SELECT * FROM gitlab_runners WHERE server_id = ? AND runner_name = ?"
    )
    .bind(&input.server_id)
    .bind(&input.runner_name)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = existing {
        sqlx::query(
            "UPDATE gitlab_runners SET
               tags = ?, executor = ?, gitlab_url = ?, token_masked = ?
             WHERE id = ?"
        )
        .bind(&input.tags)
        .bind(&input.executor)
        .bind(&input.gitlab_url)
        .bind(&input.token_masked)
        .bind(row.id)
        .execute(pool)
        .await?;
        Ok(row.id)
    } else {
        insert_runner(pool, input).await
    }
}

pub async fn list_runners(
    pool: &SqlitePool,
    filter: &ListRunnersFilter,
) -> Result<Vec<GitLabRunnerRowWithServer>, AppError> {
    let mut where_parts: Vec<&str> = vec![];
    if filter.server_id.is_some()   { where_parts.push("r.server_id = ?"); }
    if filter.project_name.is_some(){ where_parts.push("r.project_name = ?"); }
    if filter.status.is_some()      { where_parts.push("r.status = ?"); }
    if filter.search.is_some()      { where_parts.push("(r.runner_name LIKE ? OR r.tags LIKE ?)"); }

    let where_clause = if where_parts.is_empty() {
        "1=1".to_string()
    } else {
        where_parts.join(" AND ")
    };

    let sql = format!(
        "SELECT r.id, r.server_id, s.name as server_name, r.project_name,
                r.runner_name, r.tags, r.executor, r.gitlab_url, r.token_masked,
                r.status, r.last_job_status, r.last_checked_at, r.created_at
         FROM gitlab_runners r
         JOIN servers s ON s.id = r.server_id
         WHERE {where_clause}
         ORDER BY s.name, r.runner_name"
    );

    let mut q = sqlx::query_as::<_, GitLabRunnerRowWithServer>(&sql);
    if let Some(ref v) = filter.server_id   { q = q.bind(v); }
    if let Some(ref v) = filter.project_name{ q = q.bind(v); }
    if let Some(ref v) = filter.status      { q = q.bind(v); }
    if let Some(ref v) = filter.search {
        let p = format!("%{v}%");
        q = q.bind(p.clone()).bind(p);
    }

    Ok(q.fetch_all(pool).await?)
}

pub async fn delete_runner(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM gitlab_runners WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_runner_status(
    pool: &SqlitePool,
    id: i64,
    status: &str,
    last_job_status: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE gitlab_runners
         SET status = ?, last_job_status = ?, last_checked_at = datetime('now')
         WHERE id = ?"
    )
    .bind(status)
    .bind(last_job_status)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_runner_by_id(pool: &SqlitePool, id: i64) -> Result<GitLabRunnerRow, AppError> {
    sqlx::query_as::<_, GitLabRunnerRow>("SELECT * FROM gitlab_runners WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Runner {id} not found")))
}

pub async fn count_runners_for_server(pool: &SqlitePool, server_id: &str) -> Result<i64, AppError> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM gitlab_runners WHERE server_id = ?"
    )
    .bind(server_id)
    .fetch_one(pool)
    .await?;
    Ok(count)
}

pub async fn get_distinct_project_names(pool: &SqlitePool) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT project_name FROM gitlab_runners WHERE project_name != '' ORDER BY project_name"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|(p,)| p).collect())
}

// ── API Settings CRUD ─────────────────────────────────────────────────────────

pub async fn save_api_settings(
    pool: &SqlitePool,
    gitlab_url: &str,
    api_token_enc: Vec<u8>,
    description: &str,
) -> Result<i64, AppError> {
    // Check if exists
    let existing: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM gitlab_api_settings WHERE gitlab_url = ?"
    )
    .bind(gitlab_url)
    .fetch_optional(pool)
    .await?;

    if let Some((id,)) = existing {
        sqlx::query(
            "UPDATE gitlab_api_settings
             SET api_token_enc = ?, description = ?, updated_at = datetime('now')
             WHERE gitlab_url = ?"
        )
        .bind(&api_token_enc)
        .bind(description)
        .bind(gitlab_url)
        .execute(pool)
        .await?;
        Ok(id)
    } else {
        sqlx::query(
            "INSERT INTO gitlab_api_settings (gitlab_url, api_token_enc, description)
             VALUES (?, ?, ?)"
        )
        .bind(gitlab_url)
        .bind(&api_token_enc)
        .bind(description)
        .execute(pool)
        .await?;

        let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
            .fetch_one(pool)
            .await?;
        Ok(id)
    }
}

pub async fn get_api_settings(
    pool: &SqlitePool,
    gitlab_url: &str,
) -> Result<Option<GitLabApiSettingsRow>, AppError> {
    Ok(
        sqlx::query_as::<_, GitLabApiSettingsRow>(
            "SELECT * FROM gitlab_api_settings WHERE gitlab_url = ?"
        )
        .bind(gitlab_url)
        .fetch_optional(pool)
        .await?
    )
}
