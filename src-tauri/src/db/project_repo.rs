use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub created_at: String,
    pub server_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: String,
    pub color: String,
}

pub async fn insert_project(pool: &SqlitePool, input: &CreateProjectInput) -> Result<String, AppError> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO projects (id, name, description, color) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.color)
        .execute(pool)
        .await?;
    Ok(id)
}

pub async fn get_all_projects(pool: &SqlitePool) -> Result<Vec<ProjectRow>, AppError> {
    let rows = sqlx::query_as::<_, ProjectRow>(
        "SELECT p.id, p.name, p.description, p.color, p.created_at,
                COUNT(s.id) as server_count
         FROM projects p
         LEFT JOIN servers s ON s.project_id = p.id
         GROUP BY p.id
         ORDER BY p.name"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn update_project(pool: &SqlitePool, id: &str, input: &CreateProjectInput) -> Result<(), AppError> {
    sqlx::query("UPDATE projects SET name = ?, description = ?, color = ? WHERE id = ?")
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.color)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_project(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM servers WHERE project_id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;

    if count.0 > 0 {
        return Err(AppError::Other(format!(
            "Project vẫn còn {} server. Hãy gỡ hết server trước khi xóa project.",
            count.0
        )));
    }

    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
