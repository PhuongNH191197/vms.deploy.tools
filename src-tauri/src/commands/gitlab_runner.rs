use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Semaphore;
use std::sync::Arc;

use crate::commands::server::DbState;
use crate::crypto;
use crate::db::{gitlab_runner as db, server_repo};
use crate::error::AppError;
use crate::ssh::SshSession;

// ── Helpers ───────────────────────────────────────────────────────────────────

async fn open_session_for_server(
    pool: &sqlx::SqlitePool,
    server_id: &str,
) -> Result<SshSession, AppError> {
    let row = server_repo::get_server_by_id(pool, server_id).await?;
    let credential = crypto::decrypt(&row.credential)?;
    match row.auth_type.as_str() {
        "password" => SshSession::connect_password(&row.host, row.port as u16, &row.username, &credential).await,
        "key"      => SshSession::connect_key(&row.host, row.port as u16, &row.username, &credential, None).await,
        _          => Err(AppError::InvalidInput("Invalid auth_type".into())),
    }
}

fn mask_token(token: &str) -> String {
    let len = token.len();
    if len <= 8 {
        return "****".to_string();
    }
    format!("{}****{}", &token[..4], &token[len - 4..])
}

#[derive(Clone, Serialize)]
struct InstallEvent {
    line: String,
    done: bool,
    error: bool,
}

fn emit_install(app: &AppHandle, event_id: &str, line: &str, done: bool, error: bool) {
    let _ = app.emit(event_id, InstallEvent {
        line: line.to_string(),
        done,
        error,
    });
}

/// Run SSH command and stream output line-by-line to an event.
/// Returns (stdout, exit_ok).
async fn ssh_exec_emit(
    session: &mut SshSession,
    app: &AppHandle,
    event_id: &str,
    cmd: &str,
) -> Result<String, AppError> {
    let output = session.execute(cmd).await?;
    for line in output.lines() {
        emit_install(app, event_id, line, false, false);
    }
    Ok(output)
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CheckInstallResult {
    pub installed: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRunnerInput {
    pub server_id: String,
    pub gitlab_url: String,
    pub registration_token: String,
    pub runner_name: String,
    pub tags: String,
    pub maintenance_note: String,
    pub project_name: String,
}

#[derive(Debug, Serialize)]
pub struct RegisterRunnerResult {
    pub success: bool,
    pub runner_id_local: i64,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct SetupGitAuthInput {
    pub server_id: String,
    pub gitlab_url: String,
    pub git_username: String,
    pub git_password: String,
    pub test_repo_url: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ScannedRunner {
    pub runner_name: String,
    pub tags: String,
    pub executor: String,
    pub gitlab_url: String,
    pub token_masked: String,
}

#[derive(Debug, Deserialize, Default)]
pub struct ListRunnersFilterInput {
    pub server_id: Option<String>,
    pub project_name: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GitLabRunnerDto {
    pub id: i64,
    pub server_id: String,
    pub server_name: String,
    pub project_name: String,
    pub runner_name: String,
    pub tags: String,
    pub executor: String,
    pub gitlab_url: String,
    pub token_masked: String,
    pub status: String,
    pub last_job_status: String,
    pub last_checked_at: Option<String>,
    pub created_at: String,
}

impl From<db::GitLabRunnerRowWithServer> for GitLabRunnerDto {
    fn from(r: db::GitLabRunnerRowWithServer) -> Self {
        GitLabRunnerDto {
            id: r.id, server_id: r.server_id, server_name: r.server_name,
            project_name: r.project_name, runner_name: r.runner_name,
            tags: r.tags, executor: r.executor, gitlab_url: r.gitlab_url,
            token_masked: r.token_masked, status: r.status,
            last_job_status: r.last_job_status, last_checked_at: r.last_checked_at,
            created_at: r.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RunnerStatusResult {
    pub runner_id_local: i64,
    pub status: String,
    pub active_jobs: Vec<JobInfo>,
}

#[derive(Debug, Serialize)]
pub struct JobInfo {
    pub job_id: i64,
    pub job_name: String,
    pub pipeline_id: i64,
    pub branch: String,
    pub started_at: String,
    pub duration_secs: Option<i64>,
    pub web_url: String,
}

#[derive(Debug, Deserialize)]
pub struct GitLabApiSettingsInput {
    pub gitlab_url: String,
    pub api_token: String,
    pub description: String,
}

#[derive(Debug, Serialize)]
pub struct GitLabApiSettingsDto {
    pub id: i64,
    pub gitlab_url: String,
    pub description: String,
    pub has_token: bool,
    pub created_at: String,
    pub updated_at: String,
}

// Batch types
#[derive(Debug, Serialize, Clone)]
pub struct BatchInstallResult {
    pub server_id: String,
    pub server_name: String,
    pub success: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SingleRunnerConfig {
    pub server_id: String,
    pub runner_name: String,
    pub tags: String,
    pub maintenance_note: String,
}

#[derive(Debug, Deserialize)]
pub struct BatchRegisterInput {
    pub gitlab_url: String,
    pub registration_token: String,
    pub project_name: String,
    pub runners: Vec<SingleRunnerConfig>,
}

#[derive(Debug, Serialize, Clone)]
pub struct BatchRegisterResult {
    pub server_id: String,
    pub server_name: String,
    pub success: bool,
    pub runner_id_local: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SingleGitAuthConfig {
    pub server_id: String,
    pub gitlab_url: String,
    pub test_repo_url: String,
}

#[derive(Debug, Deserialize)]
pub struct BatchGitAuthInput {
    pub git_username: String,
    pub git_password: String,
    pub setups: Vec<SingleGitAuthConfig>,
}

#[derive(Debug, Serialize, Clone)]
pub struct BatchGitAuthResult {
    pub server_id: String,
    pub server_name: String,
    pub success: bool,
    pub error: Option<String>,
}

// ── Command 1: check_gitlab_runner_installed ──────────────────────────────────

#[tauri::command]
pub async fn check_gitlab_runner_installed(
    server_id: String,
    state: State<'_, DbState>,
) -> Result<CheckInstallResult, String> {
    let mut session = open_session_for_server(&state.0, &server_id)
        .await
        .map_err(|e| e.to_string())?;

    let output = session
        .execute("gitlab-runner --version 2>/dev/null | head -1")
        .await
        .unwrap_or_default();

    session.disconnect().await.ok();

    if output.is_empty() || output.contains("command not found") {
        return Ok(CheckInstallResult { installed: false, version: None, error: None });
    }

    // First line: "gitlab-runner version 16.11.0, ..."
    let version = output.lines().next().map(|l| l.to_string());
    Ok(CheckInstallResult { installed: true, version, error: None })
}

// ── Command 2: install_gitlab_runner ─────────────────────────────────────────

#[tauri::command]
pub async fn install_gitlab_runner(
    app: AppHandle,
    server_id: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let event_id = format!("gitlab_runner_install_{server_id}");

    let mut session = open_session_for_server(&state.0, &server_id)
        .await
        .map_err(|e| {
            emit_install(&app, &event_id, &format!("SSH error: {e}"), true, true);
            e.to_string()
        })?;

    // Step 1
    emit_install(&app, &event_id, "[STEP 1/5] Thêm GitLab repository...", false, false);
    let out = session.execute(
        r#"curl -fsSL "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash 2>&1"#
    ).await.map_err(|e| {
        emit_install(&app, &event_id, &format!("FAILED: {e}"), true, true);
        e.to_string()
    })?;
    for line in out.lines() { emit_install(&app, &event_id, line, false, false); }
    if out.contains("error") && out.contains("curl") {
        let msg = "Không thể tải GitLab repo. Kiểm tra internet server.";
        emit_install(&app, &event_id, msg, true, true);
        session.disconnect().await.ok();
        return Err(msg.into());
    }

    // Step 2
    emit_install(&app, &event_id, "[STEP 2/5] Cài đặt gitlab-runner...", false, false);
    let out = session.execute(
        "DEBIAN_FRONTEND=noninteractive apt-get install -y gitlab-runner 2>&1"
    ).await.map_err(|e| {
        emit_install(&app, &event_id, &format!("FAILED: {e}"), true, true);
        e.to_string()
    })?;
    for line in out.lines() { emit_install(&app, &event_id, line, false, false); }
    if out.to_lowercase().contains("e: unable") || out.to_lowercase().contains("error:") {
        let msg = "apt-get install thất bại. Kiểm tra internet server.";
        emit_install(&app, &event_id, msg, true, true);
        session.disconnect().await.ok();
        return Err(msg.into());
    }

    // Step 3: register + start daemon (systemd or fallback)
    emit_install(&app, &event_id, "[STEP 3/5] Đăng ký daemon...", false, false);
    let svc_out = session.execute(concat!(
        "if systemctl is-system-running 2>/dev/null | grep -qE '^(running|degraded)'; then ",
            "sudo systemctl enable gitlab-runner 2>&1 && sudo systemctl start gitlab-runner 2>&1; ",
        "else ",
            "sudo gitlab-runner install --user gitlab-runner --working-directory /home/gitlab-runner 2>&1 && ",
            "sudo gitlab-runner start 2>&1; ",
        "fi"
    )).await.unwrap_or_default();
    for line in svc_out.lines() { emit_install(&app, &event_id, line, false, false); }

    // Step 4: verify daemon running
    emit_install(&app, &event_id, "[STEP 4/5] Kiểm tra daemon...", false, false);
    let status_out = session.execute("sudo gitlab-runner status 2>&1").await.unwrap_or_default();
    for line in status_out.lines() { emit_install(&app, &event_id, line, false, false); }
    if status_out.to_lowercase().contains("stopped") || status_out.to_lowercase().contains("not running") {
        let msg = "Daemon khởi động thất bại. Kiểm tra log: sudo journalctl -u gitlab-runner";
        emit_install(&app, &event_id, msg, true, true);
        session.disconnect().await.ok();
        return Err(msg.into());
    }

    // Step 5: verify binary
    emit_install(&app, &event_id, "[STEP 5/5] Verify installation...", false, false);
    let ver = session.execute("gitlab-runner --version 2>&1 | head -1").await.map_err(|e| e.to_string())?;
    if ver.is_empty() || ver.contains("command not found") {
        let msg = "Install xong nhưng gitlab-runner không tìm thấy.";
        emit_install(&app, &event_id, msg, true, true);
        session.disconnect().await.ok();
        return Err(msg.into());
    }

    emit_install(&app, &event_id, &format!("OK: {ver}"), false, false);
    emit_install(&app, &event_id, "INSTALL_DONE", true, false);
    session.disconnect().await.ok();
    Ok(())
}

// ── Command 3: register_gitlab_runner ────────────────────────────────────────

#[tauri::command]
pub async fn register_gitlab_runner(
    app: AppHandle,
    payload: RegisterRunnerInput,
    state: State<'_, DbState>,
) -> Result<RegisterRunnerResult, String> {
    let event_id = format!("gitlab_runner_register_{}", payload.server_id);
    let token_masked = mask_token(&payload.registration_token);

    emit_install(&app, &event_id, &format!("Đăng ký runner cho server {}...", payload.server_id), false, false);

    let mut session = open_session_for_server(&state.0, &payload.server_id)
        .await
        .map_err(|e| e.to_string())?;

    let cmd = format!(
        "sudo gitlab-runner register \
         --non-interactive \
         --url '{}' \
         --registration-token '{}' \
         --description '{}' \
         --tag-list '{}' \
         --maintenance-note '{}' \
         --executor 'shell' 2>&1",
        payload.gitlab_url,
        payload.registration_token,
        payload.runner_name,
        payload.tags,
        payload.maintenance_note,
    );

    // Emit masked version only
    emit_install(&app, &event_id,
        &format!("$ sudo gitlab-runner register --url '{}' --token '{}' ...", payload.gitlab_url, token_masked),
        false, false);

    let output = session.execute(&cmd).await.map_err(|e| e.to_string())?;

    // Stream output with token masked
    for line in output.lines() {
        let safe_line = line.replace(&payload.registration_token, &token_masked);
        emit_install(&app, &event_id, &safe_line, false, false);
    }

    let success = output.contains("Runner registered successfully")
        || output.contains("Configuration (with the authentication token) was saved");

    if !success {
        session.disconnect().await.ok();
        let err = format!("Registration failed. Output: {}", &output[..output.len().min(200)]);
        emit_install(&app, &event_id, &err, true, true);
        return Ok(RegisterRunnerResult {
            success: false,
            runner_id_local: 0,
            message: err,
        });
    }

    // Restart daemon to pick up new runner config
    emit_install(&app, &event_id, "Khởi động lại daemon...", false, false);
    let restart_out = session.execute(concat!(
        "if systemctl is-system-running 2>/dev/null | grep -qE '^(running|degraded)'; then ",
            "sudo systemctl restart gitlab-runner 2>&1; ",
        "else ",
            "sudo gitlab-runner restart 2>&1; ",
        "fi"
    )).await.unwrap_or_default();
    for line in restart_out.lines() { emit_install(&app, &event_id, line, false, false); }

    session.disconnect().await.ok();

    // Save to DB
    let input = db::InsertRunnerInput {
        server_id: payload.server_id.clone(),
        project_name: payload.project_name.clone(),
        runner_name: payload.runner_name.clone(),
        tags: payload.tags.clone(),
        executor: "shell".to_string(),
        gitlab_url: payload.gitlab_url.clone(),
        token_masked: token_masked.clone(),
    };
    let runner_id = db::insert_runner(&state.0, &input).await.map_err(|e| e.to_string())?;

    emit_install(&app, &event_id, "REGISTER_DONE", true, false);

    Ok(RegisterRunnerResult {
        success: true,
        runner_id_local: runner_id,
        message: "Runner registered successfully".to_string(),
    })
}

// ── Command 4: setup_git_auth ─────────────────────────────────────────────────

#[tauri::command]
pub async fn setup_git_auth(
    app: AppHandle,
    payload: SetupGitAuthInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let event_id = format!("gitlab_git_auth_{}", payload.server_id);

    let gitlab_host = payload.gitlab_url
        .trim_end_matches('/')
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .to_string();

    let mut session = open_session_for_server(&state.0, &payload.server_id)
        .await
        .map_err(|e| {
            emit_install(&app, &event_id, &format!("SSH error: {e}"), true, true);
            e.to_string()
        })?;

    // Step 1: write .gitconfig directly (avoid HOME resolution issue)
    emit_install(&app, &event_id, "[STEP 1/3] Cấu hình credential helper...", false, false);
    let out = session.execute(
        "sudo git config --file /home/gitlab-runner/.gitconfig credential.helper store 2>&1 && \
         sudo chown gitlab-runner:gitlab-runner /home/gitlab-runner/.gitconfig 2>/dev/null; \
         echo OK"
    ).await.unwrap_or_default();
    emit_install(&app, &event_id, if out.contains("OK") { "credential.helper = store" } else { &out }, false, false);

    // Step 2: write .git-credentials with explicit path — DO NOT emit actual command
    emit_install(&app, &event_id, "[STEP 2/3] Lưu credentials...", false, false);
    let cred_cmd = format!(
        "printf 'https://{}:{}@{}\\n' | sudo tee /home/gitlab-runner/.git-credentials > /dev/null && \
         sudo chmod 600 /home/gitlab-runner/.git-credentials && \
         sudo chown gitlab-runner:gitlab-runner /home/gitlab-runner/.git-credentials",
        payload.git_username,
        payload.git_password,
        gitlab_host,
    );
    let _ = session.execute(&cred_cmd).await;
    emit_install(&app, &event_id, &format!("[credentials saved for {}@{}]", payload.git_username, gitlab_host), false, false);

    // Step 3: test clone (skip if no test_repo_url provided)
    if payload.test_repo_url.trim().is_empty() {
        emit_install(&app, &event_id, "[STEP 3/3] Bỏ qua test clone.", false, false);
        emit_install(&app, &event_id, "GIT_AUTH_DONE", true, false);
        session.disconnect().await.ok();
        return Ok(());
    }

    emit_install(&app, &event_id, "[STEP 3/3] Test clone...", false, false);
    // Use GIT_CONFIG_GLOBAL + HOME explicitly so credential store is found
    let test_cmd = format!(
        "sudo -u gitlab-runner env HOME=/home/gitlab-runner GIT_CONFIG_GLOBAL=/home/gitlab-runner/.gitconfig \
         git clone '{}' /tmp/vms_runner_test_$$ 2>&1; \
         sudo rm -rf /tmp/vms_runner_test_$$ 2>/dev/null; echo CLONE_DONE",
        payload.test_repo_url,
    );
    let out = session.execute(&test_cmd).await.unwrap_or_default();

    let safe_out = out.replace(&payload.git_password, "****");
    if out.to_lowercase().contains("fatal") || out.to_lowercase().contains("error:") {
        for line in safe_out.lines() { emit_install(&app, &event_id, line, false, false); }
        let msg = "Clone thất bại. Kiểm tra username/password và URL repo.";
        emit_install(&app, &event_id, msg, true, true);
        session.disconnect().await.ok();
        return Err(msg.into());
    }

    emit_install(&app, &event_id, "Clone thành công.", false, false);
    emit_install(&app, &event_id, "GIT_AUTH_DONE", true, false);
    session.disconnect().await.ok();
    Ok(())
}

// ── Command 5: scan_runners_from_server ──────────────────────────────────────

#[tauri::command]
pub async fn scan_runners_from_server(
    server_id: String,
    state: State<'_, DbState>,
) -> Result<Vec<ScannedRunner>, String> {
    let mut session = open_session_for_server(&state.0, &server_id)
        .await
        .map_err(|e| e.to_string())?;

    let config_content = session
        .execute("sudo cat /etc/gitlab-runner/config.toml 2>/dev/null")
        .await
        .unwrap_or_default();

    session.disconnect().await.ok();

    if config_content.is_empty() {
        return Ok(vec![]);
    }

    let runners = parse_config_toml(&config_content);

    // Upsert each runner into DB
    for r in &runners {
        let input = db::InsertRunnerInput {
            server_id: server_id.clone(),
            project_name: String::new(),
            runner_name: r.runner_name.clone(),
            tags: r.tags.clone(),
            executor: r.executor.clone(),
            gitlab_url: r.gitlab_url.clone(),
            token_masked: r.token_masked.clone(),
        };
        let _ = db::upsert_runner(&state.0, &input).await;
    }

    Ok(runners)
}

/// Parse [[runners]] blocks from /etc/gitlab-runner/config.toml
fn parse_config_toml(content: &str) -> Vec<ScannedRunner> {
    let mut runners = vec![];
    let mut in_runner = false;
    let mut name = String::new();
    let mut url = String::new();
    let mut token = String::new();
    let mut executor = String::new();
    let mut tags = String::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed == "[[runners]]" {
            if in_runner && !name.is_empty() {
                runners.push(ScannedRunner {
                    runner_name: name.clone(),
                    gitlab_url: url.clone(),
                    token_masked: mask_token(&token),
                    executor: if executor.is_empty() { "shell".to_string() } else { executor.clone() },
                    tags: tags.clone(),
                });
            }
            in_runner = true;
            name.clear(); url.clear(); token.clear(); executor.clear(); tags.clear();
            continue;
        }

        if in_runner {
            if let Some(v) = extract_toml_str(trimmed, "name") { name = v; }
            if let Some(v) = extract_toml_str(trimmed, "url") { url = v; }
            if let Some(v) = extract_toml_str(trimmed, "token") { token = v; }
            if let Some(v) = extract_toml_str(trimmed, "executor") { executor = v; }
            if let Some(v) = extract_toml_str(trimmed, "tag_list") { tags = v; }
        }
    }

    // Last runner
    if in_runner && !name.is_empty() {
        runners.push(ScannedRunner {
            runner_name: name,
            gitlab_url: url,
            token_masked: mask_token(&token),
            executor: if executor.is_empty() { "shell".to_string() } else { executor },
            tags,
        });
    }

    runners
}

fn extract_toml_str(line: &str, key: &str) -> Option<String> {
    let prefix = format!("{key} = \"");
    if line.starts_with(&prefix) {
        let rest = &line[prefix.len()..];
        let val = rest.trim_end_matches('"').to_string();
        return Some(val);
    }
    // Also handle: key = '...'
    let prefix2 = format!("{key} = '");
    if line.starts_with(&prefix2) {
        let rest = &line[prefix2.len()..];
        let val = rest.trim_end_matches('\'').to_string();
        return Some(val);
    }
    None
}

// ── Command 6: list_gitlab_runners ───────────────────────────────────────────

#[tauri::command]
pub async fn list_gitlab_runners(
    filter: Option<ListRunnersFilterInput>,
    state: State<'_, DbState>,
) -> Result<Vec<GitLabRunnerDto>, String> {
    let f = filter.unwrap_or_default();
    let db_filter = db::ListRunnersFilter {
        server_id: f.server_id,
        project_name: f.project_name,
        status: f.status,
        search: f.search,
    };
    db::list_runners(&state.0, &db_filter)
        .await
        .map(|rows| rows.into_iter().map(GitLabRunnerDto::from).collect())
        .map_err(|e| e.to_string())
}

// ── Command 7: check_runner_status (SSH-primary + API-secondary) ─────────────

#[tauri::command]
pub async fn check_runner_status(
    runner_id_local: i64,
    state: State<'_, DbState>,
) -> Result<RunnerStatusResult, String> {
    let runner = db::get_runner_by_id(&state.0, runner_id_local)
        .await
        .map_err(|e| e.to_string())?;

    // ── Primary: SSH-based check ─────────────────────────────────────────────
    let mut session = open_session_for_server(&state.0, &runner.server_id)
        .await
        .map_err(|e| format!("SSH error: {e}"))?;

    // Daemon check via pgrep (gitlab-runner status panics on v18.x without correct working dir)
    let proc_out = session.execute(
        "pgrep -f 'gitlab-runner run' > /dev/null 2>&1 && echo PROC_OK \
         || (systemctl is-active gitlab-runner 2>/dev/null | grep -q '^active' && echo PROC_OK || echo PROC_STOPPED)"
    ).await.unwrap_or_default();
    let daemon_running = proc_out.contains("PROC_OK");

    // Runner config exists check
    let cfg_out = session.execute(&format!(
        "sudo grep -c 'name = \"{}\"' /etc/gitlab-runner/config.toml 2>/dev/null || echo 0",
        runner.runner_name.replace('"', "\\\"")
    )).await.unwrap_or_default();
    let runner_configured = cfg_out.trim().parse::<u32>().unwrap_or(0) > 0;

    // Verify connectivity — run as gitlab-runner user so spec.json panic is avoided
    let verify_out = session.execute(&format!(
        "sudo -u gitlab-runner bash -c 'cd /home/gitlab-runner && timeout 15 gitlab-runner verify --name \"{}\" 2>&1' || echo VERIFY_TIMEOUT",
        runner.runner_name.replace('"', "\\\"")
    )).await.unwrap_or_default();

    session.disconnect().await.ok();

    let is_alive   = verify_out.contains("is alive");
    let is_removed = verify_out.contains("is removed") || verify_out.contains("not found");
    let verify_inconclusive = !is_alive && !is_removed; // panic / timeout / older output

    let mut status = if !daemon_running {
        "offline"
    } else if is_alive {
        "online"
    } else if is_removed {
        "removed"
    } else if verify_inconclusive && runner_configured {
        // Daemon running + config exists but verify output unclear → assume online
        "online"
    } else {
        "offline"
    }.to_string();

    // ── Secondary: GitLab API for active jobs (best-effort, never fail) ──────
    let mut active_jobs: Vec<JobInfo> = vec![];

    if status == "online" {
        if let Ok(Some(settings)) = db::get_api_settings(&state.0, &runner.gitlab_url).await {
            if let Ok(api_token) = crypto::decrypt(&settings.api_token_enc) {
                let base = runner.gitlab_url.trim_end_matches('/');
                let client = reqwest::Client::new();

                // Find runner id via API (best-effort)
                let encoded_name: String = runner.runner_name.chars().map(|c| {
                    if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c.to_string() }
                    else { format!("%{:02X}", c as u32) }
                }).collect();

                let target = runner.runner_name.trim().to_lowercase();
                let mut gitlab_runner_id: Option<i64> = None;

                'search: for endpoint in &[
                    format!("{base}/api/v4/runners?search={encoded_name}&per_page=100"),
                    format!("{base}/api/v4/runners/all?search={encoded_name}&per_page=100"),
                    format!("{base}/api/v4/runners?per_page=100"),
                    format!("{base}/api/v4/runners/all?per_page=100"),
                ] {
                    if let Ok(resp) = client.get(endpoint)
                        .header("PRIVATE-TOKEN", &api_token)
                        .send().await
                    {
                        if let Ok(v) = resp.json::<serde_json::Value>().await {
                            if let Some(arr) = v.as_array() {
                                for r in arr {
                                    let desc = r["description"].as_str().unwrap_or("").trim().to_lowercase();
                                    let name = r["name"].as_str().unwrap_or("").trim().to_lowercase();
                                    if desc == target || name == target {
                                        gitlab_runner_id = r["id"].as_i64();
                                        break 'search;
                                    }
                                }
                            }
                        }
                    }
                }

                if let Some(gid) = gitlab_runner_id {
                    let jobs_url = format!("{base}/api/v4/runners/{gid}/jobs?status=running&per_page=20");
                    if let Ok(resp) = client.get(&jobs_url)
                        .header("PRIVATE-TOKEN", &api_token)
                        .send().await
                    {
                        if let Ok(jobs_val) = resp.json::<serde_json::Value>().await {
                            if let Some(jobs) = jobs_val.as_array() {
                                if !jobs.is_empty() { status = "running".to_string(); }
                                for job in jobs {
                                    active_jobs.push(JobInfo {
                                        job_id: job["id"].as_i64().unwrap_or(0),
                                        job_name: job["name"].as_str().unwrap_or("").to_string(),
                                        pipeline_id: job["pipeline"]["id"].as_i64().unwrap_or(0),
                                        branch: job["ref"].as_str().unwrap_or("").to_string(),
                                        started_at: job["started_at"].as_str().unwrap_or("").to_string(),
                                        duration_secs: job["duration"].as_f64().map(|d| d as i64),
                                        web_url: job["web_url"].as_str().unwrap_or("").to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Update DB
    let last_job = active_jobs.first().map(|j| j.job_name.as_str()).unwrap_or("");
    db::update_runner_status(&state.0, runner_id_local, &status, last_job)
        .await
        .map_err(|e| e.to_string())?;

    Ok(RunnerStatusResult { runner_id_local, status, active_jobs })
}

// ── Command 8: save_gitlab_api_settings ──────────────────────────────────────

#[tauri::command]
pub async fn save_gitlab_api_settings(
    payload: GitLabApiSettingsInput,
    state: State<'_, DbState>,
) -> Result<i64, String> {
    let encrypted = crypto::encrypt(&payload.api_token).map_err(|e| e.to_string())?;
    db::save_api_settings(&state.0, &payload.gitlab_url, encrypted, &payload.description)
        .await
        .map_err(|e| e.to_string())
}

// ── Command 9: get_gitlab_api_settings ───────────────────────────────────────

#[tauri::command]
pub async fn get_gitlab_api_settings(
    gitlab_url: String,
    state: State<'_, DbState>,
) -> Result<Option<GitLabApiSettingsDto>, String> {
    let row = db::get_api_settings(&state.0, &gitlab_url)
        .await
        .map_err(|e| e.to_string())?;

    Ok(row.map(|r| GitLabApiSettingsDto {
        id: r.id,
        gitlab_url: r.gitlab_url,
        description: r.description,
        has_token: !r.api_token_enc.is_empty(),
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}

// ── Command 10: batch_install_gitlab_runner ───────────────────────────────────

#[tauri::command]
pub async fn batch_install_gitlab_runner(
    app: AppHandle,
    server_ids: Vec<String>,
    state: State<'_, DbState>,
) -> Result<Vec<BatchInstallResult>, String> {
    let semaphore = Arc::new(Semaphore::new(4)); // max 4 parallel installs
    let pool = state.0.clone();

    let mut handles = vec![];
    for sid in server_ids {
        let app_clone = app.clone();
        let pool_clone = pool.clone();
        let sem_clone = semaphore.clone();

        let handle = tokio::spawn(async move {
            let _permit = sem_clone.acquire().await.ok();
            let event_id = format!("gitlab_runner_install_{sid}");

            // Get server name for result
            let server_name = match server_repo::get_server_by_id(&pool_clone, &sid).await {
                Ok(row) => row.name.clone(),
                Err(_) => sid.clone(),
            };

            // Check first
            let check_result = {
                match open_session_for_server(&pool_clone, &sid).await {
                    Ok(mut session) => {
                        let out = session.execute("gitlab-runner --version 2>/dev/null | head -1").await.unwrap_or_default();
                        let _ = session.disconnect().await;
                        out
                    }
                    Err(e) => {
                        emit_install(&app_clone, &event_id,
                            &format!("SSH error: {e}"), true, true);
                        return BatchInstallResult {
                            server_id: sid,
                            server_name,
                            success: false,
                            version: None,
                            error: Some(e.to_string()),
                        };
                    }
                }
            };

            if !check_result.is_empty() && !check_result.contains("command not found") {
                // Already installed
                emit_install(&app_clone, &event_id,
                    &format!("Đã cài: {check_result}"), false, false);
                emit_install(&app_clone, &event_id, "INSTALL_DONE", true, false);
                return BatchInstallResult {
                    server_id: sid,
                    server_name,
                    success: true,
                    version: Some(check_result),
                    error: None,
                };
            }

            // Install
            let mut session = match open_session_for_server(&pool_clone, &sid).await {
                Ok(s) => s,
                Err(e) => {
                    emit_install(&app_clone, &event_id, &format!("SSH error: {e}"), true, true);
                    return BatchInstallResult {
                        server_id: sid,
                        server_name,
                        success: false,
                        version: None,
                        error: Some(e.to_string()),
                    };
                }
            };

            emit_install(&app_clone, &event_id, "[STEP 1/5] Thêm GitLab repository...", false, false);
            if let Err(e) = session.execute(
                r#"curl -fsSL "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash 2>&1"#
            ).await {
                emit_install(&app_clone, &event_id, &format!("FAILED: {e}"), true, true);
                let _ = session.disconnect().await;
                return BatchInstallResult {
                    server_id: sid, server_name, success: false, version: None,
                    error: Some(e.to_string()),
                };
            }

            emit_install(&app_clone, &event_id, "[STEP 2/5] Cài đặt gitlab-runner...", false, false);
            let install_out = match session.execute(
                "DEBIAN_FRONTEND=noninteractive apt-get install -y gitlab-runner 2>&1"
            ).await {
                Ok(o) => o,
                Err(e) => {
                    emit_install(&app_clone, &event_id, &format!("FAILED: {e}"), true, true);
                    let _ = session.disconnect().await;
                    return BatchInstallResult {
                        server_id: sid, server_name, success: false, version: None,
                        error: Some(e.to_string()),
                    };
                }
            };
            for line in install_out.lines() {
                emit_install(&app_clone, &event_id, line, false, false);
            }

            emit_install(&app_clone, &event_id, "[STEP 3/5] Đăng ký daemon...", false, false);
            let svc_out = session.execute(concat!(
                "if systemctl is-system-running 2>/dev/null | grep -qE '^(running|degraded)'; then ",
                    "sudo systemctl enable gitlab-runner 2>&1 && sudo systemctl start gitlab-runner 2>&1; ",
                "else ",
                    "sudo gitlab-runner install --user gitlab-runner --working-directory /home/gitlab-runner 2>&1 && ",
                    "sudo gitlab-runner start 2>&1; ",
                "fi"
            )).await.unwrap_or_default();
            for line in svc_out.lines() { emit_install(&app_clone, &event_id, line, false, false); }

            emit_install(&app_clone, &event_id, "[STEP 4/5] Kiểm tra daemon...", false, false);
            let status_out = session.execute("sudo gitlab-runner status 2>&1").await.unwrap_or_default();
            for line in status_out.lines() { emit_install(&app_clone, &event_id, line, false, false); }

            emit_install(&app_clone, &event_id, "[STEP 5/5] Verify...", false, false);

            let ver = session.execute("gitlab-runner --version 2>&1 | head -1").await.unwrap_or_default();
            let _ = session.disconnect().await;

            if ver.is_empty() || ver.contains("command not found") {
                let msg = "Install xong nhưng verify thất bại.";
                emit_install(&app_clone, &event_id, msg, true, true);
                BatchInstallResult {
                    server_id: sid, server_name, success: false,
                    version: None, error: Some(msg.into()),
                }
            } else {
                emit_install(&app_clone, &event_id, &format!("OK: {ver}"), false, false);
                emit_install(&app_clone, &event_id, "INSTALL_DONE", true, false);
                BatchInstallResult {
                    server_id: sid, server_name, success: true,
                    version: Some(ver), error: None,
                }
            }
        });

        handles.push(handle);
    }

    let mut results = vec![];
    for h in handles {
        match h.await {
            Ok(r) => results.push(r),
            Err(e) => tracing::error!("Batch install task panicked: {e}"),
        }
    }
    Ok(results)
}

// ── Command 11: batch_register_gitlab_runner ──────────────────────────────────

#[tauri::command]
pub async fn batch_register_gitlab_runner(
    app: AppHandle,
    payload: BatchRegisterInput,
    state: State<'_, DbState>,
) -> Result<Vec<BatchRegisterResult>, String> {
    let semaphore = Arc::new(Semaphore::new(4));
    let pool = state.0.clone();
    let gitlab_url = Arc::new(payload.gitlab_url.clone());
    let reg_token = Arc::new(payload.registration_token.clone());
    let project_name = Arc::new(payload.project_name.clone());

    let mut handles = vec![];
    for cfg in payload.runners {
        let app_clone = app.clone();
        let pool_clone = pool.clone();
        let sem_clone = semaphore.clone();
        let url = gitlab_url.clone();
        let token = reg_token.clone();
        let proj = project_name.clone();

        let handle = tokio::spawn(async move {
            let _permit = sem_clone.acquire().await.ok();
            let event_id = format!("gitlab_runner_register_{}", cfg.server_id);
            let token_masked = mask_token(&token);

            let server_name = match server_repo::get_server_by_id(&pool_clone, &cfg.server_id).await {
                Ok(row) => row.name,
                Err(_) => cfg.server_id.clone(),
            };

            let mut session = match open_session_for_server(&pool_clone, &cfg.server_id).await {
                Ok(s) => s,
                Err(e) => {
                    emit_install(&app_clone, &event_id, &format!("SSH error: {e}"), true, true);
                    return BatchRegisterResult {
                        server_id: cfg.server_id, server_name,
                        success: false, runner_id_local: None,
                        error: Some(e.to_string()),
                    };
                }
            };

            let cmd = format!(
                "sudo gitlab-runner register \
                 --non-interactive \
                 --url '{}' \
                 --registration-token '{}' \
                 --description '{}' \
                 --tag-list '{}' \
                 --maintenance-note '{}' \
                 --executor 'shell' 2>&1",
                url, *token, cfg.runner_name, cfg.tags, cfg.maintenance_note,
            );

            emit_install(&app_clone, &event_id,
                &format!("$ sudo gitlab-runner register --url '{}' --token '{}' ...", url, token_masked),
                false, false);

            let output = match session.execute(&cmd).await {
                Ok(o) => o,
                Err(e) => {
                    let _ = session.disconnect().await;
                    emit_install(&app_clone, &event_id, &format!("FAILED: {e}"), true, true);
                    return BatchRegisterResult {
                        server_id: cfg.server_id, server_name,
                        success: false, runner_id_local: None,
                        error: Some(e.to_string()),
                    };
                }
            };

            for line in output.lines() {
                let safe = line.replace(token.as_str(), &token_masked);
                emit_install(&app_clone, &event_id, &safe, false, false);
            }

            let success = output.contains("Runner registered successfully")
                || output.contains("Configuration (with the authentication token) was saved");

            if !success {
                let _ = session.disconnect().await;
                let err = format!("Registration failed: {}", &output[..output.len().min(200)]);
                emit_install(&app_clone, &event_id, &err, true, true);
                return BatchRegisterResult {
                    server_id: cfg.server_id, server_name,
                    success: false, runner_id_local: None,
                    error: Some(err),
                };
            }

            // Restart daemon to pick up new runner
            emit_install(&app_clone, &event_id, "Khởi động lại daemon...", false, false);
            let _ = session.execute(concat!(
                "if systemctl is-system-running 2>/dev/null | grep -qE '^(running|degraded)'; then ",
                    "sudo systemctl restart gitlab-runner 2>&1; ",
                "else ",
                    "sudo gitlab-runner restart 2>&1; ",
                "fi"
            )).await;
            let _ = session.disconnect().await;

            let input = db::InsertRunnerInput {
                server_id: cfg.server_id.clone(),
                project_name: (*proj).clone(),
                runner_name: cfg.runner_name.clone(),
                tags: cfg.tags.clone(),
                executor: "shell".to_string(),
                gitlab_url: (*url).clone(),
                token_masked: token_masked.clone(),
            };
            let runner_id = match db::insert_runner(&pool_clone, &input).await {
                Ok(id) => id,
                Err(e) => {
                    tracing::error!("DB insert runner failed: {e}");
                    0
                }
            };

            emit_install(&app_clone, &event_id, "REGISTER_DONE", true, false);
            BatchRegisterResult {
                server_id: cfg.server_id,
                server_name,
                success: true,
                runner_id_local: Some(runner_id),
                error: None,
            }
        });

        handles.push(handle);
    }

    let mut results = vec![];
    for h in handles {
        match h.await {
            Ok(r) => results.push(r),
            Err(e) => tracing::error!("Batch register task panicked: {e}"),
        }
    }
    Ok(results)
}

// ── Command 12: batch_setup_git_auth ─────────────────────────────────────────

#[tauri::command]
pub async fn batch_setup_git_auth(
    app: AppHandle,
    payload: BatchGitAuthInput,
    state: State<'_, DbState>,
) -> Result<Vec<BatchGitAuthResult>, String> {
    let semaphore = Arc::new(Semaphore::new(4));
    let pool = state.0.clone();
    let username = Arc::new(payload.git_username.clone());
    let password = Arc::new(payload.git_password.clone());

    let mut handles = vec![];
    for setup in payload.setups {
        let app_clone = app.clone();
        let pool_clone = pool.clone();
        let sem_clone = semaphore.clone();
        let username = username.clone();
        let password = password.clone();

        let handle = tokio::spawn(async move {
            let _permit = sem_clone.acquire().await.ok();
            let event_id = format!("gitlab_git_auth_{}", setup.server_id);

            let server_name = match server_repo::get_server_by_id(&pool_clone, &setup.server_id).await {
                Ok(row) => row.name,
                Err(_) => setup.server_id.clone(),
            };

            let gitlab_host = setup.gitlab_url
                .trim_end_matches('/')
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .to_string();

            let mut session = match open_session_for_server(&pool_clone, &setup.server_id).await {
                Ok(s) => s,
                Err(e) => {
                    emit_install(&app_clone, &event_id, &format!("SSH error: {e}"), true, true);
                    return BatchGitAuthResult {
                        server_id: setup.server_id, server_name,
                        success: false, error: Some(e.to_string()),
                    };
                }
            };

            emit_install(&app_clone, &event_id, "[STEP 1/3] Credential helper...", false, false);
            let _ = session.execute(
                "sudo git config --file /home/gitlab-runner/.gitconfig credential.helper store 2>&1 && \
                 sudo chown gitlab-runner:gitlab-runner /home/gitlab-runner/.gitconfig 2>/dev/null; echo OK"
            ).await;

            emit_install(&app_clone, &event_id, "[STEP 2/3] Lưu credentials...", false, false);
            let cred_cmd = format!(
                "printf 'https://{}:{}@{}\\n' | sudo tee /home/gitlab-runner/.git-credentials > /dev/null && \
                 sudo chmod 600 /home/gitlab-runner/.git-credentials && \
                 sudo chown gitlab-runner:gitlab-runner /home/gitlab-runner/.git-credentials",
                *username, *password, gitlab_host,
            );
            let _ = session.execute(&cred_cmd).await;
            emit_install(&app_clone, &event_id, &format!("[credentials saved for {}@{}]", *username, gitlab_host), false, false);

            if setup.test_repo_url.trim().is_empty() {
                emit_install(&app_clone, &event_id, "[STEP 3/3] Bỏ qua test clone.", false, false);
                let _ = session.disconnect().await;
                emit_install(&app_clone, &event_id, "GIT_AUTH_DONE", true, false);
                return BatchGitAuthResult { server_id: setup.server_id, server_name, success: true, error: None };
            }

            emit_install(&app_clone, &event_id, "[STEP 3/3] Test clone...", false, false);
            let test_cmd = format!(
                "sudo -u gitlab-runner env HOME=/home/gitlab-runner GIT_CONFIG_GLOBAL=/home/gitlab-runner/.gitconfig \
                 git clone '{}' /tmp/vms_runner_test_$$ 2>&1; \
                 sudo rm -rf /tmp/vms_runner_test_$$ 2>/dev/null; echo CLONE_DONE",
                setup.test_repo_url,
            );
            let out = session.execute(&test_cmd).await.unwrap_or_default();
            let _ = session.disconnect().await;

            let safe_out = out.replace(password.as_str(), "****");
            if out.to_lowercase().contains("fatal") || out.to_lowercase().contains("error:") {
                for line in safe_out.lines() {
                    emit_install(&app_clone, &event_id, line, false, false);
                }
                let msg = "Clone thất bại. Kiểm tra username/password và URL repo.";
                emit_install(&app_clone, &event_id, msg, true, true);
                return BatchGitAuthResult {
                    server_id: setup.server_id, server_name,
                    success: false, error: Some(msg.into()),
                };
            }

            emit_install(&app_clone, &event_id, "Clone thành công.", false, false);
            emit_install(&app_clone, &event_id, "GIT_AUTH_DONE", true, false);
            BatchGitAuthResult {
                server_id: setup.server_id, server_name,
                success: true, error: None,
            }
        });

        handles.push(handle);
    }

    let mut results = vec![];
    for h in handles {
        match h.await {
            Ok(r) => results.push(r),
            Err(e) => tracing::error!("Batch git auth task panicked: {e}"),
        }
    }
    Ok(results)
}

// ── Command 13: delete_gitlab_runner ─────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct DeleteRunnerResult {
    pub unregistered_on_server: bool,
    pub unregister_error: Option<String>,
}

#[tauri::command]
pub async fn delete_gitlab_runner(
    runner_id_local: i64,
    state: State<'_, DbState>,
) -> Result<DeleteRunnerResult, String> {
    let runner = db::get_runner_by_id(&state.0, runner_id_local)
        .await
        .map_err(|e| e.to_string())?;

    // Unregister from server (SSH) — best-effort, don't fail delete if SSH fails
    let (unregistered_on_server, unregister_error) =
        match open_session_for_server(&state.0, &runner.server_id).await {
            Err(e) => (false, Some(format!("SSH error: {e}"))),
            Ok(mut session) => {
                let cmd = format!(
                    "sudo -u gitlab-runner bash -c 'cd /home/gitlab-runner && gitlab-runner unregister --name \"{}\" 2>&1'",
                    runner.runner_name.replace('"', "\\\"")
                );
                let out = session.execute(&cmd).await.unwrap_or_default();
                let _ = session.disconnect().await;

                let ok = out.contains("Unregistering runner from GitLab")
                    || out.contains("Runner unregistered successfully")
                    || out.contains("has been successfully unregistered");
                let err = if !ok && !out.is_empty() {
                    Some(out.lines().last().unwrap_or("").to_string())
                } else {
                    None
                };
                (ok, err)
            }
        };

    // Always delete from local DB regardless of SSH result
    db::delete_runner(&state.0, runner_id_local)
        .await
        .map_err(|e| e.to_string())?;

    Ok(DeleteRunnerResult { unregistered_on_server, unregister_error })
}

// ── Command 14: get_gitlab_project_names ─────────────────────────────────────

#[tauri::command]
pub async fn get_gitlab_project_names(
    state: State<'_, DbState>,
) -> Result<Vec<String>, String> {
    db::get_distinct_project_names(&state.0)
        .await
        .map_err(|e| e.to_string())
}
