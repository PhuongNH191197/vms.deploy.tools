use std::env;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use crate::error::AppError;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn appdata_dir() -> Result<PathBuf, AppError> {
    let appdata = env::var("APPDATA")
        .map_err(|_| AppError::Other("APPDATA env not set".into()))?;
    Ok(PathBuf::from(appdata).join("VMS-Tool"))
}

fn cache_dir() -> Result<PathBuf, AppError> {
    Ok(appdata_dir()?.join("templates").join("git-cache"))
}

fn config_path() -> Result<PathBuf, AppError> {
    Ok(appdata_dir()?.join("template_config.json"))
}

// ── Config ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TemplateConfig {
    pub git_url: String,
    pub git_branch: String,
}

fn load_config() -> TemplateConfig {
    let Ok(path) = config_path() else { return TemplateConfig::default(); };
    let Ok(data) = std::fs::read_to_string(path) else { return TemplateConfig::default(); };
    serde_json::from_str(&data).unwrap_or_default()
}

// ── File listing ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct TemplateFile {
    pub name: String,
    pub relative_path: String,
    pub size_bytes: u64,
}

fn collect_files(base: &Path, dir: &Path, out: &mut Vec<TemplateFile>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return; };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }
        if path.is_dir() {
            collect_files(base, &path, out);
        } else {
            let relative_path = path
                .strip_prefix(base)
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|_| name.clone());
            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            out.push(TemplateFile { name, relative_path, size_bytes });
        }
    }
}

// ── Event payload ─────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
struct SyncLine {
    line: String,
    done: bool,
    error: bool,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_template_config() -> TemplateConfig {
    load_config()
}

#[tauri::command]
pub fn save_template_config(git_url: String, git_branch: String) -> Result<(), String> {
    let path = config_path().map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let config = TemplateConfig { git_url, git_branch };
    let data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_template_files() -> Vec<TemplateFile> {
    let Ok(dir) = cache_dir() else { return vec![]; };
    if !dir.exists() { return vec![]; }
    let mut files = Vec::new();
    collect_files(&dir, &dir, &mut files);
    files
}

/// Clone or pull the git repo into the template cache dir, streaming output as events.
#[tauri::command]
pub async fn sync_git_templates(
    app: AppHandle,
    event_id: String,
) -> Result<(), String> {
    let config = load_config();
    if config.git_url.is_empty() {
        return Err("Git URL chưa được cấu hình.".into());
    }

    let dir = cache_dir().map_err(|e| e.to_string())?;
    tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;

    let emit = |app: &AppHandle, eid: &str, line: &str, done: bool, error: bool| {
        let _ = app.emit(eid, SyncLine {
            line: line.to_string(), done, error,
        });
    };

    let is_git_repo = dir.join(".git").exists();

    let mut cmd = Command::new("git");
    if is_git_repo {
        cmd.args(["pull", "--progress"]).current_dir(&dir);
        emit(&app, &event_id, "$ git pull --progress", false, false);
    } else {
        let mut args = vec!["clone", "--depth", "1", "--progress"];
        if !config.git_branch.is_empty() {
            args.extend(["-b", config.git_branch.as_str()]);
        }
        args.push(config.git_url.as_str());
        args.push(".");
        cmd.args(&args).current_dir(&dir);
        emit(&app, &event_id, &format!("$ git clone {} .", config.git_url), false, false);
    }

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("git not found: {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stream stdout and stderr concurrently to avoid pipe-buffer deadlock
    let app1 = app.clone();
    let eid1 = event_id.clone();
    let stdout_task = tokio::spawn(async move {
        if let Some(out) = stdout {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app1.emit(&eid1, SyncLine { line, done: false, error: false });
            }
        }
    });

    let app2 = app.clone();
    let eid2 = event_id.clone();
    let stderr_task = tokio::spawn(async move {
        if let Some(err) = stderr {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // git writes progress to stderr — not an error
                let _ = app2.emit(&eid2, SyncLine { line, done: false, error: false });
            }
        }
    });

    let _ = tokio::join!(stdout_task, stderr_task);
    let status = child.wait().await.map_err(|e| e.to_string())?;

    if status.success() {
        emit(&app, &event_id, "✓ Sync hoàn thành.", true, false);
        Ok(())
    } else {
        let msg = format!("git exited: code {}", status.code().unwrap_or(-1));
        emit(&app, &event_id, &msg, true, true);
        Err(msg)
    }
}
