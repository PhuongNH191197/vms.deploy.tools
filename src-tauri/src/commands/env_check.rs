use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::error::AppError;
use crate::ssh::SshSession;

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCheckResult {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct InstallLine {
    pub line: String,
    pub done: bool,
    pub error: bool,
}

// Tool name → shell command to check
fn check_command(tool: &str) -> Option<&'static str> {
    match tool {
        "docker"         => Some("docker --version 2>&1"),
        "docker-compose" => Some("docker compose version 2>&1 || docker-compose --version 2>&1"),
        "git"            => Some("git --version 2>&1"),
        "curl"           => Some("curl --version 2>&1 | head -1"),
        "wget"           => Some("wget --version 2>&1 | head -1"),
        "dotnet"         => Some("dotnet --version 2>&1"),
        "ffmpeg"         => Some("ffmpeg -version 2>&1 | head -1"),
        "openssl"        => Some("openssl version 2>&1"),
        "jq"             => Some("jq --version 2>&1"),
        "htop"           => Some("htop --version 2>&1 | head -1"),
        "unzip"          => Some("unzip -v 2>&1 | head -1"),
        _                => None,
    }
}

// Tool name → install command (apt-based Ubuntu)
fn install_command(tool: &str) -> Option<&'static str> {
    match tool {
        "docker" => Some(
            "curl -fsSL https://get.docker.com | sh && systemctl enable --now docker",
        ),
        "docker-compose" => Some(
            "apt-get install -y docker-compose-plugin 2>&1 || pip3 install docker-compose 2>&1",
        ),
        "git"     => Some("apt-get update -y && apt-get install -y git"),
        "curl"    => Some("apt-get update -y && apt-get install -y curl"),
        "wget"    => Some("apt-get update -y && apt-get install -y wget"),
        "dotnet"  => Some("wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O /tmp/ms.deb && dpkg -i /tmp/ms.deb && apt-get update && apt-get install -y dotnet-sdk-8.0"),
        "ffmpeg"  => Some("apt-get update -y && apt-get install -y ffmpeg"),
        "openssl" => Some("apt-get update -y && apt-get install -y openssl"),
        "jq"      => Some("apt-get update -y && apt-get install -y jq"),
        "htop"    => Some("apt-get update -y && apt-get install -y htop"),
        "unzip"   => Some("apt-get update -y && apt-get install -y unzip"),
        _         => None,
    }
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

// ──────────────────────────────────────────
// Commands
// ──────────────────────────────────────────

#[tauri::command]
pub async fn check_env_tools(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    tools: Vec<String>,
) -> Result<Vec<ToolCheckResult>, String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for tool in &tools {
        let cmd = match check_command(tool) {
            Some(c) => c,
            None => {
                results.push(ToolCheckResult { name: tool.clone(), installed: false, version: None });
                continue;
            }
        };

        match session.execute(cmd).await {
            Ok(output) if !output.is_empty() => {
                let version = output.lines().next().map(|l| l.trim().to_string());
                results.push(ToolCheckResult { name: tool.clone(), installed: true, version });
            }
            _ => {
                results.push(ToolCheckResult { name: tool.clone(), installed: false, version: None });
            }
        }
    }

    session.disconnect().await.map_err(|e| e.to_string())?;

    Ok(results)
}

#[tauri::command]
pub async fn install_env_tool(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    tool: String,
    event_id: String,
    app: AppHandle,
) -> Result<(), String> {
    let cmd = install_command(&tool)
        .ok_or_else(|| format!("No install command for {tool}"))?;

    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    // Run with sudo -S (non-interactive) + stream output line by line via events
    let full_cmd = format!("sudo -n {cmd} 2>&1; echo '__DONE__'");

    let output = session.execute(&full_cmd).await.map_err(|e| e.to_string())?;

    for line in output.lines() {
        let done = line == "__DONE__";
        let _ = app.emit(&event_id, InstallLine {
            line: line.to_string(),
            done,
            error: false,
        });
        if done { break; }
    }

    session.disconnect().await.map_err(|e| e.to_string())?;

    Ok(())
}
