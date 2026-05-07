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
