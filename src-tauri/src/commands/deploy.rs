use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use crate::commands::server::DbState;
use crate::db::deploy_repo;
use crate::error::AppError;
use crate::ssh::SshSession;

// ── SSH helpers ──────────────────────────────────────────────────────────────

async fn open_session(
    host: &str, port: u16, username: &str, auth_type: &str, credential: &str,
) -> Result<SshSession, AppError> {
    match auth_type {
        "password" => SshSession::connect_password(host, port, username, credential).await,
        "key"      => SshSession::connect_key(host, port, username, credential, None).await,
        _          => Err(AppError::InvalidInput("Invalid auth_type".into())),
    }
}

// ── Event payload ────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
struct DeployEvent {
    step_id: String,
    line: String,
    done: bool,
    error: bool,
}

fn emit_line(app: &AppHandle, event_id: &str, step_id: &str, line: &str, done: bool, error: bool) {
    let _ = app.emit(event_id, DeployEvent {
        step_id: step_id.to_string(),
        line: line.to_string(),
        done,
        error,
    });
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// Execute a single SSH command, streaming output line-by-line via Tauri events.
/// Event payload: { step_id, line, done, error }
#[tauri::command]
pub async fn run_ssh_stream(
    app: AppHandle,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    command: String,
    event_id: String,
    step_id: String,
) -> Result<(), String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    emit_line(&app, &event_id, &step_id, &format!("$ {command}"), false, false);

    match session.execute(&command).await {
        Ok(output) => {
            for line in output.lines() {
                emit_line(&app, &event_id, &step_id, line, false, false);
            }
            emit_line(&app, &event_id, &step_id, "", true, false);
        }
        Err(e) => {
            let msg = e.to_string();
            emit_line(&app, &event_id, &step_id, &msg, true, true);
            session.disconnect().await.ok();
            return Err(msg);
        }
    }

    session.disconnect().await.ok();
    Ok(())
}

/// Execute a batch of SSH commands for a deploy step (mkdir, docker cmds, etc.).
/// Each command streams to the same event_id + step_id.
#[tauri::command]
pub async fn run_deploy_step(
    app: AppHandle,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    commands: Vec<String>,
    event_id: String,
    step_id: String,
) -> Result<(), String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    for cmd in &commands {
        emit_line(&app, &event_id, &step_id, &format!("$ {cmd}"), false, false);
        match session.execute(cmd).await {
            Ok(output) => {
                for line in output.lines() {
                    emit_line(&app, &event_id, &step_id, line, false, false);
                }
            }
            Err(e) => {
                let msg = e.to_string();
                emit_line(&app, &event_id, &step_id, &format!("ERROR: {msg}"), true, true);
                session.disconnect().await.ok();
                return Err(msg);
            }
        }
    }

    emit_line(&app, &event_id, &step_id, "", true, false);
    session.disconnect().await.ok();
    Ok(())
}

/// Save a deploy record to DB and create a snapshot entry.
#[tauri::command]
pub async fn save_deploy_record(
    state: State<'_, DbState>,
    server_id: String,
    module_name: String,
    module_version: String,
    action: String,
    status: String,
    compose_backup: String,
    image_tag: String,
) -> Result<String, String> {
    let pool = &state.0;

    let operator_host = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let deploy_id = deploy_repo::insert_deploy_record(
        pool,
        &server_id,
        &module_name,
        &module_version,
        &action,
        &status,
        "127.0.0.1",
        &operator_host,
        None,
    )
    .await
    .map_err(|e| e.to_string())?;

    deploy_repo::insert_snapshot(
        pool,
        &deploy_id,
        &server_id,
        &module_name,
        &compose_backup,
        &image_tag,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(deploy_id)
}

/// Fetch deploy history for a server.
#[tauri::command]
pub async fn get_deploy_history(
    state: State<'_, DbState>,
    server_id: String,
) -> Result<Vec<deploy_repo::DeployRecord>, String> {
    deploy_repo::get_deploy_history(&state.0, &server_id)
        .await
        .map_err(|e| e.to_string())
}

/// Fetch snapshots for a server.
#[tauri::command]
pub async fn get_snapshots(
    state: State<'_, DbState>,
    server_id: String,
) -> Result<Vec<deploy_repo::SnapshotRecord>, String> {
    deploy_repo::get_snapshots_by_server(&state.0, &server_id)
        .await
        .map_err(|e| e.to_string())
}

/// Rollback: compose down → restore backup → compose up, streaming output.
#[tauri::command]
pub async fn rollback_deployment(
    app: AppHandle,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    root_path: String,
    app_name: String,
    compose_backup: String,
    event_id: String,
) -> Result<(), String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    let step_id = "rollback";

    // Compose down
    let down_cmd = format!("cd {root_path} && docker-compose down --remove-orphans 2>&1");
    emit_line(&app, &event_id, step_id, &format!("$ {down_cmd}"), false, false);
    let down_out = session.execute(&down_cmd).await.map_err(|e| e.to_string())?;
    for line in down_out.lines() {
        emit_line(&app, &event_id, step_id, line, false, false);
    }

    // Restore compose file via SFTP
    let sftp = session.open_sftp().await.map_err(|e| e.to_string())?;
    let compose_path = format!("{root_path}/apps/{app_name}/docker-compose.yml");

    {
        use tokio::io::AsyncWriteExt;
        let mut f = sftp.create(&compose_path).await.map_err(|e| e.to_string())?;
        f.write_all(compose_backup.as_bytes()).await.map_err(|e| e.to_string())?;
    }
    sftp.close().await.ok();

    emit_line(&app, &event_id, step_id, "Restored compose file", false, false);

    // Compose up
    let up_cmd = format!("cd {root_path}/apps/{app_name} && docker-compose up -d 2>&1");
    emit_line(&app, &event_id, step_id, &format!("$ {up_cmd}"), false, false);
    let up_out = session.execute(&up_cmd).await.map_err(|e| e.to_string())?;
    for line in up_out.lines() {
        emit_line(&app, &event_id, step_id, line, false, false);
    }

    emit_line(&app, &event_id, step_id, "Rollback complete", true, false);
    session.disconnect().await.ok();
    Ok(())
}
