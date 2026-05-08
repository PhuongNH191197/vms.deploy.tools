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
    pub uptime_seconds: u64,
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

    // Uptime: cat /proc/uptime (first value is seconds)
    let uptime_raw = session
        .execute("cat /proc/uptime | awk '{print $1}'")
        .await
        .unwrap_or_else(|_| "0".into());
    let uptime_seconds: u64 = uptime_raw.trim().split('.').next().unwrap_or("0").parse().unwrap_or(0);

    Ok(ServerMetrics {
        cpu_percent,
        ram_used_mb,
        ram_total_mb,
        ram_percent,
        disk_used_gb,
        disk_total_gb,
        disk_percent,
        uptime_seconds,
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── parse_ram ─────────────────────────────────────────────────────────────

    #[test]
    fn test_parse_ram_normal() {
        // free -m output: "16384 10240"  (total=16GB, used=10GB)
        let (total, used) = parse_ram("16384 10240");
        assert_eq!(total, 16384);
        assert_eq!(used, 10240);
    }

    #[test]
    fn test_parse_ram_zero_used() {
        let (total, used) = parse_ram("8192 0");
        assert_eq!(total, 8192);
        assert_eq!(used, 0);
    }

    #[test]
    fn test_parse_ram_empty_returns_zeros() {
        let (total, used) = parse_ram("");
        assert_eq!(total, 0);
        assert_eq!(used, 0);
    }

    #[test]
    fn test_parse_ram_extra_whitespace() {
        let (total, used) = parse_ram("  4096  2048  ");
        assert_eq!(total, 4096);
        assert_eq!(used, 2048);
    }

    #[test]
    fn test_parse_ram_garbage_input_returns_zeros() {
        let (total, used) = parse_ram("not a number");
        assert_eq!(total, 0);
        assert_eq!(used, 0);
    }

    // ── parse_disk ────────────────────────────────────────────────────────────

    #[test]
    fn test_parse_disk_normal() {
        // df -BG output: "100G 23G 23%"
        let (total, used, pct) = parse_disk("100G 23G 23%");
        assert!((total - 100.0).abs() < f64::EPSILON);
        assert!((used - 23.0).abs() < f64::EPSILON);
        assert_eq!(pct, 23);
    }

    #[test]
    fn test_parse_disk_full_disk() {
        let (total, _used, pct) = parse_disk("50G 50G 100%");
        assert!((total - 50.0).abs() < f64::EPSILON);
        assert_eq!(pct, 100);
    }

    #[test]
    fn test_parse_disk_empty_returns_zero() {
        let (total, used, pct) = parse_disk("");
        assert_eq!(total, 0.0);
        assert_eq!(used, 0.0);
        assert_eq!(pct, 0);
    }

    #[test]
    fn test_parse_disk_strips_g_suffix() {
        let (total, _, _) = parse_disk("512G 100G 20%");
        assert!((total - 512.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_parse_disk_strips_percent_suffix() {
        let (_, _, pct) = parse_disk("10G 5G 50%");
        assert_eq!(pct, 50);
    }
}
