use serde::{Deserialize, Serialize};
use crate::error::AppError;
use super::SshSession;

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerInfo {
    pub hostname: String,
    pub os: String,
    pub kernel: String,
    pub cpu_cores: u32,
    pub ram_total_mb: u64,
    pub ram_used_mb: u64,
    pub disk_total_gb: f64,
    pub disk_used_gb: f64,
    pub disk_percent: u32,
    pub uptime_seconds: u64,
}

pub async fn fetch_server_info(session: &mut SshSession) -> Result<ServerInfo, AppError> {
    let hostname = session.execute("hostname").await?;

    let os = session
        .execute("cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'")
        .await
        .unwrap_or_else(|_| "Unknown".into());

    let kernel = session.execute("uname -r").await.unwrap_or_else(|_| "Unknown".into());

    let cpu_cores: u32 = session
        .execute("nproc")
        .await
        .unwrap_or_else(|_| "1".into())
        .trim()
        .parse()
        .unwrap_or(1);

    // free -m output: Mem: total used free ...
    let ram_line = session.execute("free -m | awk 'NR==2{print $2,$3}'").await?;
    let (ram_total_mb, ram_used_mb) = parse_ram(&ram_line);

    // df -h / output: Filesystem Size Used Avail Use%
    let disk_line = session
        .execute("df -BG / | awk 'NR==2{print $2,$3,$5}'")
        .await
        .unwrap_or_default();
    let (disk_total_gb, disk_used_gb, disk_percent) = parse_disk(&disk_line);

    let uptime_seconds: u64 = session
        .execute("cat /proc/uptime | awk '{print int($1)}'")
        .await
        .unwrap_or_else(|_| "0".into())
        .trim()
        .parse()
        .unwrap_or(0);

    Ok(ServerInfo {
        hostname,
        os,
        kernel,
        cpu_cores,
        ram_total_mb,
        ram_used_mb,
        disk_total_gb,
        disk_used_gb,
        disk_percent,
        uptime_seconds,
    })
}

fn parse_ram(line: &str) -> (u64, u64) {
    let parts: Vec<&str> = line.split_whitespace().collect();
    let total = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let used = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    (total, used)
}

fn parse_disk(line: &str) -> (f64, f64, u32) {
    let parts: Vec<&str> = line.split_whitespace().collect();
    let total: f64 = parts
        .first()
        .map(|s| s.trim_end_matches('G'))
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    let used: f64 = parts
        .get(1)
        .map(|s| s.trim_end_matches('G'))
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    let pct: u32 = parts
        .get(2)
        .map(|s| s.trim_end_matches('%'))
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    (total, used, pct)
}
