use serde::{Deserialize, Serialize};
use crate::error::AppError;
use super::SshSession;

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerMetrics {
    pub cpu_percent: u32,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    pub ram_percent: u32,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub disk_percent: u32,
}

pub async fn fetch_metrics(session: &mut SshSession) -> Result<ServerMetrics, AppError> {
    // CPU: vmstat single sample, column 15 = idle%
    let cpu_idle: u32 = session
        .execute("vmstat | tail -1 | awk '{print $15}'")
        .await
        .unwrap_or_else(|_| "0".into())
        .trim()
        .parse()
        .unwrap_or(0);
    let cpu_percent = 100u32.saturating_sub(cpu_idle);

    // RAM: free -m → "total used"
    let ram_raw = session
        .execute("free -m | awk 'NR==2{print $2,$3}'")
        .await
        .unwrap_or_default();
    let (ram_total_mb, ram_used_mb) = parse_ram(&ram_raw);
    let ram_percent = if ram_total_mb > 0 {
        ((ram_used_mb * 100) / ram_total_mb) as u32
    } else {
        0
    };

    // Disk: df -BG / → "total used pct"
    let disk_raw = session
        .execute("df -BG / | awk 'NR==2{print $2,$3,$5}'")
        .await
        .unwrap_or_default();
    let (disk_total_gb, disk_used_gb, disk_percent) = parse_disk(&disk_raw);

    Ok(ServerMetrics {
        cpu_percent,
        ram_used_mb,
        ram_total_mb,
        ram_percent,
        disk_used_gb,
        disk_total_gb,
        disk_percent,
    })
}

fn parse_ram(line: &str) -> (u64, u64) {
    let p: Vec<&str> = line.split_whitespace().collect();
    let total = p.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let used = p.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    (total, used)
}

fn parse_disk(line: &str) -> (f64, f64, u32) {
    let p: Vec<&str> = line.split_whitespace().collect();
    let total: f64 = p.first().map(|s| s.trim_end_matches('G')).and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let used: f64 = p.get(1).map(|s| s.trim_end_matches('G')).and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let pct: u32 = p.get(2).map(|s| s.trim_end_matches('%')).and_then(|s| s.parse().ok()).unwrap_or(0);
    (total, used, pct)
}
