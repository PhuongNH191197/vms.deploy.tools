use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::time::Duration;
use russh::ChannelMsg;
use crate::error::AppError;
use crate::ssh::SshSession;
use crate::commands::server::DbState;
use crate::db::metrics_repo::{self, MetricsPoint};

// ── Cancellation registry ────────────────────────────────────────────────────

pub struct LogStreamState(pub Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>);

impl LogStreamState {
    pub fn new() -> Self {
        LogStreamState(Arc::new(Mutex::new(HashMap::new())))
    }
}

// ── Structs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ContainerInfo {
    pub name: String,
    pub image: String,
    pub status: String,
    pub created: String,
    pub cpu_perc: String,
    pub mem_perc: String,
}

#[derive(Clone, Serialize)]
struct LogLine {
    line: String,
    done: bool,
}

// ── SSH helper ───────────────────────────────────────────────────────────────

async fn open_session(
    host: &str, port: u16, username: &str, auth_type: &str, credential: &str,
) -> Result<SshSession, AppError> {
    match auth_type {
        "password" => SshSession::connect_password(host, port, username, credential).await,
        "key"      => SshSession::connect_key(host, port, username, credential, None).await,
        _          => Err(AppError::InvalidInput("Invalid auth_type".into())),
    }
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// Get running containers with CPU/RAM stats.
#[tauri::command]
pub async fn get_container_info(
    host: String, port: u16, username: String, auth_type: String, credential: String,
) -> Result<Vec<ContainerInfo>, String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await.map_err(|e| e.to_string())?;

    // docker ps: name|image|status|created
    let ps_cmd = r#"docker ps --format "{{.Names}}|{{.Image}}|{{.Status}}|{{.RunningFor}}" 2>&1"#;
    let ps_out = session.execute(ps_cmd).await.map_err(|e| e.to_string())?;

    // docker stats --no-stream: name|cpu|mem
    let stats_cmd = r#"docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemPerc}}" 2>&1"#;
    let stats_out = session.execute(stats_cmd).await.map_err(|e| e.to_string())?;

    session.disconnect().await.ok();

    // Parse stats into a map: name → (cpu, mem)
    let stats_map: HashMap<String, (String, String)> = stats_out.lines()
        .filter_map(|l| {
            let parts: Vec<&str> = l.splitn(3, '|').collect();
            if parts.len() == 3 {
                Some((parts[0].trim().to_string(), (parts[1].trim().to_string(), parts[2].trim().to_string())))
            } else {
                None
            }
        })
        .collect();

    let containers: Vec<ContainerInfo> = ps_out.lines()
        .filter(|l| !l.is_empty() && !l.starts_with("NAMES"))
        .filter_map(|l| {
            let parts: Vec<&str> = l.splitn(4, '|').collect();
            if parts.len() < 3 { return None; }
            let name = parts[0].trim().to_string();
            let (cpu, mem) = stats_map.get(&name)
                .cloned()
                .unwrap_or_else(|| ("—".to_string(), "—".to_string()));
            Some(ContainerInfo {
                name: name.clone(),
                image: parts[1].trim().to_string(),
                status: parts[2].trim().to_string(),
                created: parts.get(3).map(|s| s.trim().to_string()).unwrap_or_default(),
                cpu_perc: cpu,
                mem_perc: mem,
            })
        })
        .collect();

    Ok(containers)
}

/// Stream docker logs for a container. Emits `log_line` events.
/// Cancel via stop_log_stream(event_id).
#[tauri::command]
pub async fn stream_container_logs(
    app: AppHandle,
    state: State<'_, LogStreamState>,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    container: String,
    tail: u32,
    event_id: String,
) -> Result<(), String> {
    // Register cancel flag
    let cancel = Arc::new(AtomicBool::new(true));
    {
        let mut map = state.0.lock().unwrap();
        // Stop any existing stream for this event_id
        if let Some(old) = map.get(&event_id) {
            old.store(false, Ordering::SeqCst);
        }
        map.insert(event_id.clone(), cancel.clone());
    }

    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await.map_err(|e| e.to_string())?;

    let cmd = format!("docker logs -f --tail={tail} {container} 2>&1");

    let mut channel = session
        .open_channel()
        .await
        .map_err(|e| e.to_string())?;

    channel.exec(true, cmd.as_str()).await.map_err(|e| e.to_string())?;

    let mut line_buf = String::new();

    loop {
        // Check cancel every 100ms
        match tokio::time::timeout(Duration::from_millis(100), channel.wait()).await {
            Ok(Some(ChannelMsg::Data { ref data })) => {
                let text = String::from_utf8_lossy(data);
                for ch in text.chars() {
                    if ch == '\n' {
                        let _ = app.emit(&event_id, LogLine { line: line_buf.clone(), done: false });
                        line_buf.clear();
                    } else if ch != '\r' {
                        line_buf.push(ch);
                    }
                }
            }
            Ok(Some(ChannelMsg::ExitStatus { .. })) | Ok(None) => break,
            Ok(_) => {}
            Err(_) => {
                // timeout — check cancel flag
                if !cancel.load(Ordering::SeqCst) {
                    break;
                }
            }
        }
    }

    // Flush remaining
    if !line_buf.is_empty() {
        let _ = app.emit(&event_id, LogLine { line: line_buf, done: false });
    }
    let _ = app.emit(&event_id, LogLine { line: String::new(), done: true });

    // Cleanup
    {
        let mut map = state.0.lock().unwrap();
        map.remove(&event_id);
    }

    session.disconnect().await.ok();
    Ok(())
}

/// Cancel an active log stream.
#[tauri::command]
pub fn stop_log_stream(
    state: State<'_, LogStreamState>,
    event_id: String,
) {
    if let Ok(map) = state.0.lock() {
        if let Some(flag) = map.get(&event_id) {
            flag.store(false, Ordering::SeqCst);
        }
    }
}

/// Run a docker action (restart | stop | start) on a container.
#[tauri::command]
pub async fn docker_container_action(
    host: String, port: u16, username: String, auth_type: String, credential: String,
    container: String, action: String,
) -> Result<String, String> {
    // Whitelist allowed actions
    let safe_action = match action.as_str() {
        "restart" | "stop" | "start" => action.as_str(),
        _ => return Err("Invalid action".to_string()),
    };

    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await.map_err(|e| e.to_string())?;

    let output = session
        .execute(&format!("docker {safe_action} {container} 2>&1"))
        .await
        .map_err(|e| e.to_string())?;

    session.disconnect().await.ok();
    Ok(output)
}

/// Persist a metrics snapshot for a server (called from JS after each poll).
#[tauri::command]
pub async fn save_metrics_snapshot(
    server_id: String,
    cpu_percent: u32,
    ram_percent: u32,
    ram_used_mb: u64,
    ram_total_mb: u64,
    disk_percent: u32,
    state: State<'_, DbState>,
) -> Result<(), String> {
    metrics_repo::save_snapshot(&state.0, &server_id, cpu_percent, ram_percent, ram_used_mb, ram_total_mb, disk_percent)
        .await
        .map_err(|e| e.to_string())
}

/// Return stored metrics history for a server (default: last 24h).
#[tauri::command]
pub async fn get_metrics_history(
    server_id: String,
    hours: Option<i64>,
    state: State<'_, DbState>,
) -> Result<Vec<MetricsPoint>, String> {
    metrics_repo::get_history(&state.0, &server_id, hours.unwrap_or(24))
        .await
        .map_err(|e| e.to_string())
}
