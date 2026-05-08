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
    #[serde(default)]
    pub git_url: String,
    #[serde(default)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn unique_tmp() -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "vms-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ))
    }

    // ── TemplateConfig serde ──────────────────────────────────────────────────

    #[test]
    fn test_config_serde_roundtrip() {
        let cfg = TemplateConfig {
            git_url: "https://github.com/org/templates".into(),
            git_branch: "main".into(),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let back: TemplateConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back.git_url, cfg.git_url);
        assert_eq!(back.git_branch, cfg.git_branch);
    }

    #[test]
    fn test_config_default_is_empty() {
        let cfg = TemplateConfig::default();
        assert!(cfg.git_url.is_empty());
        assert!(cfg.git_branch.is_empty());
    }

    #[test]
    fn test_config_deserialize_missing_fields_uses_default() {
        let json = r#"{"git_url": "https://example.com/repo"}"#;
        let cfg: TemplateConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.git_url, "https://example.com/repo");
        assert!(cfg.git_branch.is_empty());
    }

    // ── collect_files ─────────────────────────────────────────────────────────

    #[test]
    fn test_collect_files_excludes_dotfiles_and_dotdirs() {
        let base = unique_tmp();
        fs::create_dir_all(&base).unwrap();
        fs::write(base.join("docker-compose.yml"), "version: '3'").unwrap();
        fs::write(base.join("README.md"), "# templates").unwrap();
        fs::write(base.join(".gitignore"), "*.log").unwrap();
        fs::create_dir(base.join(".git")).unwrap();
        fs::write(base.join(".git").join("config"), "[core]").unwrap();

        let mut files = Vec::new();
        collect_files(&base, &base, &mut files);

        let names: Vec<&str> = files.iter().map(|f| f.name.as_str()).collect();
        assert!(names.contains(&"docker-compose.yml"), "yml should be included");
        assert!(names.contains(&"README.md"), "md should be included");
        assert!(!names.contains(&".gitignore"), ".gitignore excluded");
        assert!(!names.contains(&"config"), ".git dir contents excluded");

        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn test_collect_files_recurses_subdirs() {
        let base = unique_tmp();
        fs::create_dir_all(base.join("nginx")).unwrap();
        fs::create_dir_all(base.join("postgres")).unwrap();
        fs::write(base.join("nginx").join("docker-compose.yml"), "").unwrap();
        fs::write(base.join("postgres").join("docker-compose.yml"), "").unwrap();
        fs::write(base.join("root.yml"), "").unwrap();

        let mut files = Vec::new();
        collect_files(&base, &base, &mut files);

        assert_eq!(files.len(), 3, "root + 2 subdirs");
        let paths: Vec<&str> = files.iter().map(|f| f.relative_path.as_str()).collect();
        assert!(paths.iter().any(|p| p.contains("nginx")));
        assert!(paths.iter().any(|p| p.contains("postgres")));

        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn test_collect_files_uses_forward_slashes() {
        let base = unique_tmp();
        fs::create_dir_all(base.join("sub")).unwrap();
        fs::write(base.join("sub").join("file.yml"), "").unwrap();

        let mut files = Vec::new();
        collect_files(&base, &base, &mut files);

        assert_eq!(files.len(), 1);
        assert!(!files[0].relative_path.contains('\\'), "no backslash in path");
        assert!(files[0].relative_path.contains('/'), "uses forward slash");

        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn test_collect_files_empty_dir() {
        let base = unique_tmp();
        fs::create_dir_all(&base).unwrap();

        let mut files = Vec::new();
        collect_files(&base, &base, &mut files);
        assert!(files.is_empty());

        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn test_collect_files_sorted_alphabetically() {
        let base = unique_tmp();
        fs::create_dir_all(&base).unwrap();
        fs::write(base.join("z.yml"), "").unwrap();
        fs::write(base.join("a.yml"), "").unwrap();
        fs::write(base.join("m.yml"), "").unwrap();

        let mut files = Vec::new();
        collect_files(&base, &base, &mut files);

        assert_eq!(files.len(), 3);
        assert_eq!(files[0].name, "a.yml");
        assert_eq!(files[1].name, "m.yml");
        assert_eq!(files[2].name, "z.yml");

        fs::remove_dir_all(&base).unwrap();
    }
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
