pub mod server_repo;
pub mod deploy_repo;

use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::PathBuf;
use crate::error::AppError;

pub async fn init_db() -> Result<SqlitePool, AppError> {
    let db_path = get_db_path()?;

    if let Some(parent) = db_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(AppError::Db)?;

    run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::migrate!("./src/db/migrations")
        .run(pool)
        .await
        .map_err(|e| AppError::Db(e.into()))?;
    Ok(())
}

fn get_db_path() -> Result<PathBuf, AppError> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| AppError::Other("APPDATA env not set".into()))?;

    Ok(PathBuf::from(appdata)
        .join("VMS-Tool")
        .join("db")
        .join("servers.db"))
}
