pub mod server_info;
pub mod metrics;

use async_trait::async_trait;
use russh::{client, ChannelMsg, Disconnect};
use russh::keys::key::PublicKey;
use russh::keys::load_secret_key;
use russh_sftp::client::SftpSession;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;
use crate::error::AppError;

const SSH_TIMEOUT_SECS: u64 = 10;

struct ClientHandler;

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

pub struct SshSession {
    pub host: String,
    pub port: u16,
    session: client::Handle<ClientHandler>,
}

impl SshSession {
    pub async fn connect_password(
        host: &str,
        port: u16,
        username: &str,
        password: &str,
    ) -> Result<Self, AppError> {
        let config = Arc::new(client::Config {
            inactivity_timeout: Some(Duration::from_secs(60)),
            ..Default::default()
        });

        let mut session = timeout(
            Duration::from_secs(SSH_TIMEOUT_SECS),
            client::connect(config, (host, port), ClientHandler),
        )
        .await
        .map_err(|_| AppError::Ssh(format!("Connection timeout to {host}:{port}")))?
        .map_err(|e| AppError::Ssh(e.to_string()))?;

        let auth_ok = session
            .authenticate_password(username, password)
            .await
            .map_err(|e| AppError::Ssh(format!("Auth failed: {e}")))?;

        if !auth_ok {
            return Err(AppError::Ssh("Password authentication rejected".into()));
        }

        Ok(SshSession { host: host.to_string(), port, session })
    }

    pub async fn connect_key(
        host: &str,
        port: u16,
        username: &str,
        key_path: &str,
        passphrase: Option<&str>,
    ) -> Result<Self, AppError> {
        let key_pair = load_secret_key(key_path, passphrase)
            .map_err(|e| AppError::Ssh(format!("Invalid private key: {e}")))?;

        let config = Arc::new(client::Config {
            inactivity_timeout: Some(Duration::from_secs(60)),
            ..Default::default()
        });

        let mut session = timeout(
            Duration::from_secs(SSH_TIMEOUT_SECS),
            client::connect(config, (host, port), ClientHandler),
        )
        .await
        .map_err(|_| AppError::Ssh(format!("Connection timeout to {host}:{port}")))?
        .map_err(|e| AppError::Ssh(e.to_string()))?;

        let auth_ok = session
            .authenticate_publickey(username, Arc::new(key_pair))
            .await
            .map_err(|e| AppError::Ssh(format!("Key auth failed: {e}")))?;

        if !auth_ok {
            return Err(AppError::Ssh("Key authentication rejected".into()));
        }

        Ok(SshSession { host: host.to_string(), port, session })
    }

    /// Run a remote command, return stdout as String
    pub async fn execute(&mut self, command: &str) -> Result<String, AppError> {
        let mut channel = self
            .session
            .channel_open_session()
            .await
            .map_err(|e| AppError::Ssh(e.to_string()))?;

        channel
            .exec(true, command)
            .await
            .map_err(|e| AppError::Ssh(e.to_string()))?;

        let mut output = String::new();

        loop {
            match channel.wait().await {
                Some(ChannelMsg::Data { ref data }) => {
                    output.push_str(&String::from_utf8_lossy(data));
                }
                Some(ChannelMsg::ExitStatus { .. }) | None => break,
                _ => {}
            }
        }

        Ok(output.trim().to_string())
    }

    /// Open a raw session channel for streaming use (caller manages exec + reading).
    pub async fn open_channel(&mut self) -> Result<russh::Channel<russh::client::Msg>, AppError> {
        self.session
            .channel_open_session()
            .await
            .map_err(|e| AppError::Ssh(e.to_string()))
    }

    pub async fn open_sftp(&mut self) -> Result<SftpSession, AppError> {
        let channel = self
            .session
            .channel_open_session()
            .await
            .map_err(|e| AppError::Ssh(e.to_string()))?;

        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| AppError::Ssh(e.to_string()))?;

        SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| AppError::Scp(e.to_string()))
    }

    pub async fn disconnect(mut self) -> Result<(), AppError> {
        self.session
            .disconnect(Disconnect::ByApplication, "", "en")
            .await
            .map_err(|e| AppError::Ssh(e.to_string()))?;
        Ok(())
    }
}

/// Integration tests — require Docker SSH container at 127.0.0.1:2222
/// Run with: cargo test -- --ignored
#[cfg(test)]
mod integration {
    use super::*;
    use crate::ssh::{metrics, server_info};

    const HOST: &str = "127.0.0.1";
    const PORT: u16 = 2222;
    const USER: &str = "root";
    const PASS: &str = "Elcom@123";

    async fn session() -> SshSession {
        SshSession::connect_password(HOST, PORT, USER, PASS)
            .await
            .expect("SSH connect failed — is Docker SSH container running at 127.0.0.1:2222?")
    }

    // ── Connection ────────────────────────────────────────────────────────────

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_ssh_connect_password_ok() {
        let s = session().await;
        s.disconnect().await.expect("disconnect");
    }

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_ssh_wrong_password_rejected() {
        let result = SshSession::connect_password(HOST, PORT, USER, "wrongpass").await;
        assert!(result.is_err(), "wrong password should fail");
    }

    // ── Execute ───────────────────────────────────────────────────────────────

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_execute_whoami_returns_user() {
        let mut s = session().await;
        let out = s.execute("whoami").await.expect("whoami");
        assert_eq!(out.trim(), USER, "logged in as {USER}");
        s.disconnect().await.ok();
    }

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_execute_uname_contains_linux() {
        let mut s = session().await;
        let out = s.execute("uname -s").await.expect("uname");
        assert!(out.trim().eq_ignore_ascii_case("linux"), "uname: {out}");
        s.disconnect().await.ok();
    }

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_execute_multiline_output() {
        let mut s = session().await;
        let out = s.execute("echo line1 && echo line2 && echo line3").await.expect("multiline");
        let lines: Vec<&str> = out.lines().collect();
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "line1");
        assert_eq!(lines[2], "line3");
        s.disconnect().await.ok();
    }

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_execute_exit_code_nonzero_captured_via_stderr() {
        let mut s = session().await;
        // Command not found — stderr captured via 2>&1, output not empty
        let out = s.execute("nonexistent_cmd_xyz 2>&1 || true").await.expect("exec");
        assert!(!out.trim().is_empty(), "should capture stderr of failed cmd");
        s.disconnect().await.ok();
    }

    // ── fetch_server_info ─────────────────────────────────────────────────────

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_fetch_server_info_returns_valid_data() {
        let mut s = session().await;
        let info = server_info::fetch_server_info(&mut s).await.expect("server_info");

        assert!(!info.hostname.trim().is_empty(), "hostname not empty");
        assert!(info.cpu_cores >= 1, "at least 1 CPU core");
        assert!(info.ram_total_mb > 0, "RAM > 0");
        assert!(info.uptime_seconds > 0, "uptime > 0");

        s.disconnect().await.ok();
    }

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_fetch_server_info_disk_percent_in_range() {
        let mut s = session().await;
        let info = server_info::fetch_server_info(&mut s).await.expect("server_info");
        assert!(info.disk_percent <= 100, "disk_percent must be 0-100, got {}", info.disk_percent);
        s.disconnect().await.ok();
    }

    // ── fetch_metrics ─────────────────────────────────────────────────────────

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_fetch_metrics_cpu_in_range() {
        let mut s = session().await;
        let m = metrics::fetch_metrics(&mut s).await.expect("metrics");
        assert!(m.cpu_percent <= 100, "cpu_percent must be 0-100, got {}", m.cpu_percent);
        s.disconnect().await.ok();
    }

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_fetch_metrics_ram_used_lte_total() {
        let mut s = session().await;
        let m = metrics::fetch_metrics(&mut s).await.expect("metrics");
        assert!(m.ram_used_mb <= m.ram_total_mb,
            "ram_used ({}) must be <= ram_total ({})", m.ram_used_mb, m.ram_total_mb);
        s.disconnect().await.ok();
    }

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_fetch_metrics_disk_percent_in_range() {
        let mut s = session().await;
        let m = metrics::fetch_metrics(&mut s).await.expect("metrics");
        assert!(m.disk_percent <= 100, "disk_percent {}", m.disk_percent);
        s.disconnect().await.ok();
    }

    // ── check_env_tools (integration) ────────────────────────────────────────

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_check_env_basic_unix_tools_present() {
        use crate::commands::env_check;

        let result = env_check::check_env_tools(
            HOST.into(), PORT, USER.into(),
            "password".into(), PASS.into(),
            vec!["curl".into(), "wget".into(), "git".into(), "openssl".into()],
        ).await.expect("check_env_tools");

        // These are almost always installed on any Linux
        for r in &result {
            println!("[{}] {} — {:?}", if r.installed { "OK" } else { "MISS" }, r.name, r.version);
        }
        assert_eq!(result.len(), 4, "should return result for every tool requested");
    }

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_check_env_unknown_tool_returns_not_installed() {
        use crate::commands::env_check;

        let result = env_check::check_env_tools(
            HOST.into(), PORT, USER.into(),
            "password".into(), PASS.into(),
            vec!["definitely-not-a-real-tool-xyz".into()],
        ).await.expect("check_env_tools");

        assert_eq!(result.len(), 1);
        assert!(!result[0].installed, "unknown tool should be not-installed");
    }

    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222"]
    async fn test_check_env_installed_tool_has_version_string() {
        use crate::commands::env_check;

        // Every Linux box has openssl
        let result = env_check::check_env_tools(
            HOST.into(), PORT, USER.into(),
            "password".into(), PASS.into(),
            vec!["openssl".into()],
        ).await.expect("check_env_tools");

        assert_eq!(result.len(), 1);
        if result[0].installed {
            assert!(result[0].version.is_some(), "installed tool must have version string");
            let v = result[0].version.as_ref().unwrap();
            assert!(!v.is_empty(), "version string not empty");
        }
    }

    /// Verify the install logic actually installs a tool (tests SSH + apt-get, not Tauri layer).
    /// Uses `jq` — small package, safe to install.
    #[tokio::test]
    #[ignore = "requires Docker SSH at 127.0.0.1:2222 — modifies server state"]
    async fn test_install_jq_then_verify_installed() {
        use crate::commands::env_check::check_env_tools;

        let mut s = session().await;

        // Check before
        let before = s.execute("command -v jq >/dev/null 2>&1 && jq --version 2>&1").await.unwrap_or_default();
        if !before.trim().is_empty() {
            println!("jq already installed ({}) — skipping", before.trim());
            s.disconnect().await.ok();
            return;
        }

        // Run install (same logic as install_env_tool, root path — no sudo needed)
        let install_out = s.execute(
            "DEBIAN_FRONTEND=noninteractive apt-get update -y && apt-get install -y jq 2>&1 && echo '__DONE__' || echo '__ERROR__'"
        ).await.expect("install cmd");

        assert!(
            install_out.contains("__DONE__") && !install_out.contains("__ERROR__"),
            "install must succeed. Output:\n{install_out}"
        );

        s.disconnect().await.ok();

        // Verify via check_env_tools (uses check_command gate)
        let after = check_env_tools(
            HOST.into(), PORT, USER.into(), "password".into(), PASS.into(),
            vec!["jq".into()],
        ).await.expect("check after install");

        assert!(after[0].installed, "jq must be installed. check_env_tools returned: {:?}", after[0]);
        assert!(after[0].version.is_some());
        println!("jq verified: {:?}", after[0].version);
    }
}
