use russh_sftp::client::SftpSession;
use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tokio::fs;
use tokio::io::AsyncReadExt;
use crate::error::AppError;

const CHUNK_SIZE: usize = 64 * 1024; // 64 KB

#[derive(Clone, Serialize)]
pub struct ScpProgress {
    pub event_id: String,
    pub file_name: String,
    pub bytes_sent: u64,
    pub total_bytes: u64,
}

pub async fn upload_file(
    sftp: &SftpSession,
    local_path: &Path,
    remote_path: &str,
    app: &AppHandle,
    event_id: &str,
) -> Result<(), AppError> {
    let file_name = local_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut local_file = fs::File::open(local_path).await?;
    let total_bytes = local_file.metadata().await?.len();

    let mut remote_file = sftp
        .create(remote_path)
        .await
        .map_err(|e| AppError::Scp(e.to_string()))?;

    let mut buf = vec![0u8; CHUNK_SIZE];
    let mut bytes_sent: u64 = 0;

    loop {
        let n = local_file.read(&mut buf).await?;
        if n == 0 {
            break;
        }

        use tokio::io::AsyncWriteExt;
        remote_file
            .write_all(&buf[..n])
            .await
            .map_err(|e| AppError::Scp(e.to_string()))?;

        bytes_sent += n as u64;

        let _ = app.emit(
            "scp_progress",
            ScpProgress {
                event_id: event_id.to_string(),
                file_name: file_name.clone(),
                bytes_sent,
                total_bytes,
            },
        );
    }

    use tokio::io::AsyncWriteExt;
    remote_file.shutdown().await.map_err(|e| AppError::Scp(e.to_string()))?;

    Ok(())
}

pub async fn upload_dir(
    sftp: &SftpSession,
    local_dir: &Path,
    remote_dir: &str,
    app: &AppHandle,
    event_id: &str,
) -> Result<(), AppError> {
    // Ensure remote directory exists
    let _ = sftp.create_dir(remote_dir).await;

    let mut entries = fs::read_dir(local_dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        let local_path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_string();
        let remote_path = format!("{remote_dir}/{entry_name}");

        if local_path.is_dir() {
            Box::pin(upload_dir(sftp, &local_path, &remote_path, app, event_id)).await?;
        } else {
            upload_file(sftp, &local_path, &remote_path, app, event_id).await?;
        }
    }

    Ok(())
}
