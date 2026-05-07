use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;
use crate::error::AppError;
use crate::ssh::SshSession;
use crate::scp;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkCreateResult {
    pub name: String,
    pub created: bool,
    pub already_existed: bool,
    pub error: Option<String>,
}

async fn open_session(host: &str, port: u16, username: &str, auth_type: &str, credential: &str)
    -> Result<SshSession, AppError>
{
    match auth_type {
        "password" => SshSession::connect_password(host, port, username, credential).await,
        "key"      => SshSession::connect_key(host, port, username, credential, None).await,
        _          => Err(AppError::InvalidInput("Invalid auth_type".into())),
    }
}

#[tauri::command]
pub async fn create_docker_networks(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    networks: Vec<String>,
) -> Result<Vec<NetworkCreateResult>, String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for network in &networks {
        let name = network.trim().to_lowercase();
        if name.is_empty() { continue; }

        let cmd = format!("docker network create --driver bridge {name} 2>&1");
        match session.execute(&cmd).await {
            Ok(output) => {
                let already_existed = output.contains("already exists");
                results.push(NetworkCreateResult {
                    name: name.clone(),
                    created: !already_existed,
                    already_existed,
                    error: None,
                });
            }
            Err(e) => {
                results.push(NetworkCreateResult {
                    name: name.clone(),
                    created: false,
                    already_existed: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    session.disconnect().await.map_err(|e| e.to_string())?;

    Ok(results)
}

#[tauri::command]
pub async fn upload_path(
    app: AppHandle,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    local_path: String,
    remote_path: String,
    event_id: String,
) -> Result<(), String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    let sftp = session.open_sftp().await.map_err(|e| e.to_string())?;
    let local = Path::new(&local_path);

    let result = if local.is_dir() {
        scp::upload_dir(&sftp, local, &remote_path, &app, &event_id).await
    } else {
        scp::upload_file(&sftp, local, &remote_path, &app, &event_id).await
    };

    sftp.close().await.ok();
    session.disconnect().await.ok();

    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_vms_env(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    root_path: String,
    content: String,
) -> Result<(), String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    // Ensure root_path directory exists
    session
        .execute(&format!("mkdir -p {root_path}"))
        .await
        .map_err(|e| e.to_string())?;

    let sftp = session.open_sftp().await.map_err(|e| e.to_string())?;
    let remote_path = format!("{root_path}/vms.env");

    let mut file = sftp
        .create(&remote_path)
        .await
        .map_err(|e| e.to_string())?;

    use tokio::io::AsyncWriteExt;
    file.write_all(content.as_bytes())
        .await
        .map_err(|e| e.to_string())?;

    sftp.close().await.ok();
    session.disconnect().await.ok();

    Ok(())
}

#[tauri::command]
pub async fn write_remote_file(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    remote_path: String,
    content: String,
) -> Result<(), String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&remote_path).parent() {
        let parent_str = parent.to_string_lossy();
        if !parent_str.is_empty() {
            session
                .execute(&format!("mkdir -p {parent_str}"))
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    let sftp = session.open_sftp().await.map_err(|e| e.to_string())?;
    let mut file = sftp.create(&remote_path).await.map_err(|e| e.to_string())?;

    use tokio::io::AsyncWriteExt;
    file.write_all(content.as_bytes()).await.map_err(|e| e.to_string())?;

    sftp.close().await.ok();
    session.disconnect().await.ok();
    Ok(())
}
