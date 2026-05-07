use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("SSH error: {0}")]
    Ssh(String),

    #[error("SCP error: {0}")]
    Scp(String),

    #[error("Database error: {0}")]
    Db(#[from] sqlx::Error),

    #[error("Encryption error: {0}")]
    Crypto(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("{0}")]
    Other(String),
}

impl From<AppError> for String {
    fn from(e: AppError) -> String {
        e.to_string()
    }
}
