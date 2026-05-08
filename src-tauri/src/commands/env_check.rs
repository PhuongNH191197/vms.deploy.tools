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

/// Metadata for a supported environment tool.
#[derive(Debug, Serialize, Clone)]
pub struct ToolMeta {
    pub name: String,
    pub description: String,
}

/// Return all tools this app knows how to check and install.
#[tauri::command]
pub fn list_supported_tools() -> Vec<ToolMeta> {
    vec![
        ToolMeta { name: "docker".into(),         description: "Container runtime — bắt buộc".into() },
        ToolMeta { name: "docker-compose".into(),  description: "Orchestrate multi-container apps".into() },
        ToolMeta { name: "git".into(),             description: "Clone repo & template sync".into() },
        ToolMeta { name: "curl".into(),            description: "HTTP client — dùng bởi installer".into() },
        ToolMeta { name: "wget".into(),            description: "File download".into() },
        ToolMeta { name: "openssl".into(),         description: "TLS / certificate".into() },
        ToolMeta { name: "jq".into(),              description: "Parse JSON trên server".into() },
        ToolMeta { name: "unzip".into(),           description: "Giải nén file .zip".into() },
        ToolMeta { name: "dotnet".into(),          description: ".NET runtime (nếu dùng .NET app)".into() },
        ToolMeta { name: "ffmpeg".into(),          description: "Video/audio processing".into() },
        ToolMeta { name: "htop".into(),            description: "Interactive process monitor".into() },
    ]
}

// Tool name → shell command to check.
// Pattern: `command -v <tool> >/dev/null 2>&1 && <version-cmd>`
// When tool is absent: command -v exits 1, && short-circuits → empty output → installed=false.
// When tool is present: version-cmd runs → non-empty output → installed=true.
fn check_command(tool: &str) -> Option<&'static str> {
    match tool {
        "docker"         => Some("command -v docker >/dev/null 2>&1 && docker --version 2>&1"),
        "docker-compose" => Some("command -v docker >/dev/null 2>&1 && { docker compose version 2>&1 || docker-compose --version 2>&1; }"),
        "git"            => Some("command -v git >/dev/null 2>&1 && git --version 2>&1"),
        "curl"           => Some("command -v curl >/dev/null 2>&1 && curl --version 2>&1 | head -1"),
        "wget"           => Some("command -v wget >/dev/null 2>&1 && wget --version 2>&1 | head -1"),
        "dotnet"         => Some("command -v dotnet >/dev/null 2>&1 && dotnet --version 2>&1"),
        "ffmpeg"         => Some("command -v ffmpeg >/dev/null 2>&1 && ffmpeg -version 2>&1 | head -1"),
        "openssl"        => Some("command -v openssl >/dev/null 2>&1 && openssl version 2>&1"),
        "jq"             => Some("command -v jq >/dev/null 2>&1 && jq --version 2>&1"),
        "htop"           => Some("command -v htop >/dev/null 2>&1 && htop --version 2>&1 | head -1"),
        "unzip"          => Some("command -v unzip >/dev/null 2>&1 && unzip -v 2>&1 | head -1"),
        _                => None,
    }
}

// Wait until dpkg lock is not held by any process (lsof check, no TOCTOU race).
// Uses double-quoted inner sh -c so it is safe when embedded in outer sh -c '...'.
const WAIT_DPKG: &str = r#"timeout 120 sh -c "while lsof /var/lib/dpkg/lock 2>/dev/null | grep -q . || lsof /var/cache/apt/archives/lock 2>/dev/null | grep -q .; do echo waiting_dpkg_lock; sleep 3; done" 2>/dev/null || true"#;

// Install a single package. apt-get update must be run separately before calling this.
fn apt_retry(package: &str) -> String {
    format!(
        "{WAIT_DPKG}; \
         DEBIAN_FRONTEND=noninteractive apt-get install -y {package} 2>&1"
    )
}

// One-time apt-get update to run before a batch install session.
fn apt_update_cmd() -> String {
    format!("{WAIT_DPKG}; apt-get update -y 2>&1")
}

// Tool name → install command (apt-based Ubuntu)
fn install_command(tool: &str) -> Option<String> {
    let cmd = match tool {
        "docker" => "curl -fsSL https://get.docker.com | sh && systemctl enable --now docker 2>&1".to_string(),
        "docker-compose" => apt_retry("docker-compose-plugin"),
        "git"     => apt_retry("git"),
        "curl"    => apt_retry("curl"),
        "wget"    => apt_retry("wget"),
        "dotnet"  => format!(
            "wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O /tmp/ms.deb 2>&1 && \
             ok=0; for i in 1 2 3; do DEBIAN_FRONTEND=noninteractive dpkg -i /tmp/ms.deb 2>&1 && {{ ok=1; break; }}; [ $i -lt 3 ] && sleep 15; done; [ $ok -eq 1 ] && \
             {}",
            apt_retry("dotnet-sdk-8.0")
        ),
        "ffmpeg"  => apt_retry("ffmpeg"),
        "openssl" => apt_retry("openssl"),
        "jq"      => apt_retry("jq"),
        "htop"    => apt_retry("htop"),
        "unzip"   => apt_retry("unzip"),
        _         => return None,
    };
    Some(cmd)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL_TOOLS: &[&str] = &[
        "docker", "docker-compose", "git", "curl", "wget",
        "dotnet", "ffmpeg", "openssl", "jq", "htop", "unzip",
    ];

    // ── check_command ─────────────────────────────────────────────────────────

    #[test]
    fn test_check_command_known_tools_all_return_some() {
        for tool in ALL_TOOLS {
            assert!(
                check_command(tool).is_some(),
                "check_command({tool}) should return Some"
            );
        }
    }

    #[test]
    fn test_check_command_unknown_tool_returns_none() {
        assert!(check_command("nonexistent-tool").is_none());
        assert!(check_command("").is_none());
        assert!(check_command("DOCKER").is_none()); // case-sensitive
    }

    #[test]
    fn test_check_command_docker_uses_version_flag() {
        let cmd = check_command("docker").unwrap();
        assert!(cmd.contains("--version") || cmd.contains("version"));
    }

    #[test]
    fn test_check_command_docker_compose_has_fallback() {
        let cmd = check_command("docker-compose").unwrap();
        // Must handle both "docker compose" (v2) and "docker-compose" (v1)
        assert!(cmd.contains("docker compose") || cmd.contains("docker-compose"));
        assert!(cmd.contains("||"), "should have fallback for v1 vs v2");
    }

    #[test]
    fn test_check_command_uses_command_v_gate() {
        // All check commands must use `command -v` gate so absent tools produce empty output
        for tool in ALL_TOOLS {
            let cmd = check_command(tool).unwrap();
            assert!(
                cmd.contains("command -v"),
                "check_command({tool}) must use 'command -v' gate: got `{cmd}`"
            );
        }
    }

    #[test]
    fn test_check_command_output_redirects_stderr() {
        // All check commands must capture stderr somewhere
        for tool in ALL_TOOLS {
            let cmd = check_command(tool).unwrap();
            assert!(
                cmd.contains("2>&1") || cmd.contains(">/dev/null"),
                "check_command({tool}) must redirect stderr: got `{cmd}`"
            );
        }
    }

    #[test]
    fn test_check_command_returns_static_str() {
        // Verify no heap allocation — result is &'static str
        let _: &'static str = check_command("git").unwrap();
    }

    // ── install_command ───────────────────────────────────────────────────────

    #[test]
    fn test_install_command_known_tools_all_return_some() {
        for tool in ALL_TOOLS {
            assert!(
                install_command(tool).is_some(),
                "install_command({tool}) should return Some"
            );
        }
    }

    #[test]
    fn test_install_command_unknown_tool_returns_none() {
        assert!(install_command("mystery-bin").is_none());
        assert!(install_command("").is_none());
    }

    #[test]
    fn test_install_command_docker_uses_official_script() {
        let cmd = install_command("docker").unwrap();
        // Must use get.docker.com official installer, not apt (Docker != apt docker.io)
        assert!(cmd.contains("get.docker.com"), "docker install should use official script");
    }

    #[test]
    fn test_install_command_docker_enables_service() {
        let cmd = install_command("docker").unwrap();
        assert!(cmd.contains("systemctl"), "docker install must enable systemd service");
    }

    #[test]
    fn test_install_command_apt_tools_use_apt_get() {
        // Standard apt tools should use apt-get install
        let apt_tools = ["git", "curl", "wget", "ffmpeg", "openssl", "jq", "htop", "unzip"];
        for tool in apt_tools {
            let cmd = install_command(tool).unwrap();
            assert!(
                cmd.contains("apt-get install"),
                "install_command({tool}) should use apt-get install"
            );
        }
    }

    // ── Consistency: every check tool has an install command ──────────────────

    #[test]
    fn test_every_checkable_tool_has_install_command() {
        for tool in ALL_TOOLS {
            assert!(
                check_command(tool).is_some() && install_command(tool).is_some(),
                "tool '{tool}' has check_command but no install_command — inconsistency"
            );
        }
    }

    // ── ToolCheckResult serde ─────────────────────────────────────────────────

    #[test]
    fn test_tool_check_result_serde_installed_with_version() {
        let r = ToolCheckResult {
            name: "docker".to_string(),
            installed: true,
            version: Some("Docker version 24.0.5".to_string()),
        };
        let json = serde_json::to_string(&r).unwrap();
        let back: ToolCheckResult = serde_json::from_str(&json).unwrap();
        assert_eq!(back.name, "docker");
        assert!(back.installed);
        assert_eq!(back.version.as_deref(), Some("Docker version 24.0.5"));
    }

    #[test]
    fn test_tool_check_result_serde_not_installed() {
        let r = ToolCheckResult {
            name: "ffmpeg".to_string(),
            installed: false,
            version: None,
        };
        let json = serde_json::to_string(&r).unwrap();
        let back: ToolCheckResult = serde_json::from_str(&json).unwrap();
        assert!(!back.installed);
        assert!(back.version.is_none());
    }

    #[test]
    fn test_tool_check_result_version_none_serializes_as_null() {
        let r = ToolCheckResult { name: "x".into(), installed: false, version: None };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("null"), "None version should serialize as null");
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

/// Run apt-get update once before a batch install session. Streams output via event_id.
#[tauri::command]
pub async fn run_apt_update(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential: String,
    event_id: String,
    app: AppHandle,
) -> Result<(), String> {
    let mut session = open_session(&host, port, &username, &auth_type, &credential)
        .await
        .map_err(|e| e.to_string())?;

    let privilege = if username == "root" { "" } else { "sudo -n " };
    let full_cmd = format!(
        "{privilege}sh -c '{}' 2>&1 && echo '__DONE__' || echo '__ERROR__'",
        apt_update_cmd()
    );

    let output = session.execute(&full_cmd).await.map_err(|e| e.to_string())?;

    let mut ok = false;
    for line in output.lines() {
        let done = line == "__DONE__";
        let error = line == "__ERROR__";
        if done || error {
            ok = done;
            let _ = app.emit(&event_id, InstallLine { line: String::new(), done: true, error });
            break;
        }
        let _ = app.emit(&event_id, InstallLine { line: line.to_string(), done: false, error: false });
    }

    session.disconnect().await.map_err(|e| e.to_string())?;

    if ok { Ok(()) } else { Err("apt-get update failed".into()) }
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

    // Root: run directly. Non-root: prepend sudo -n.
    // DEBIAN_FRONTEND is already set inside apt_retry commands.
    // __DONE__ fires on success, __ERROR__ on failure.
    let privilege = if username == "root" { "" } else { "sudo -n " };
    let full_cmd = format!(
        "{privilege}sh -c '{cmd}' 2>&1 && echo '__DONE__' || echo '__ERROR__'"
    );

    let output = session.execute(&full_cmd).await.map_err(|e| e.to_string())?;

    let mut install_ok = false;
    for line in output.lines() {
        let done  = line == "__DONE__";
        let error = line == "__ERROR__";
        if done || error {
            install_ok = done;
            let _ = app.emit(&event_id, InstallLine { line: String::new(), done: true, error });
            break;
        }
        let _ = app.emit(&event_id, InstallLine { line: line.to_string(), done: false, error: false });
    }

    session.disconnect().await.map_err(|e| e.to_string())?;

    if install_ok {
        Ok(())
    } else {
        Err(format!("Install {tool} failed — dpkg lock or package not found. Check log."))
    }
}
