use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::project_repo::{self, CreateProjectInput};
use crate::commands::server::DbState;

#[derive(Debug, Deserialize)]
pub struct ProjectPayload {
    pub name: String,
    pub description: String,
    pub color: String,
}

#[derive(Debug, Serialize)]
pub struct ProjectDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub created_at: String,
    pub server_count: i64,
}

impl From<project_repo::ProjectRow> for ProjectDto {
    fn from(r: project_repo::ProjectRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            description: r.description,
            color: r.color,
            created_at: r.created_at,
            server_count: r.server_count,
        }
    }
}

#[tauri::command]
pub async fn create_project(payload: ProjectPayload, state: State<'_, DbState>) -> Result<String, String> {
    let input = CreateProjectInput { name: payload.name, description: payload.description, color: payload.color };
    project_repo::insert_project(&state.0, &input).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_projects(state: State<'_, DbState>) -> Result<Vec<ProjectDto>, String> {
    project_repo::get_all_projects(&state.0)
        .await
        .map(|rows| rows.into_iter().map(ProjectDto::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_project(id: String, payload: ProjectPayload, state: State<'_, DbState>) -> Result<(), String> {
    let input = CreateProjectInput { name: payload.name, description: payload.description, color: payload.color };
    project_repo::update_project(&state.0, &id, &input).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_project(id: String, state: State<'_, DbState>) -> Result<(), String> {
    project_repo::delete_project(&state.0, &id).await.map_err(|e| e.to_string())
}
