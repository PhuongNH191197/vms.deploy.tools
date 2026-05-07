## Task-07: Server info fetch via SSH

STATUS: DONE
DATE: 2026-05-07

FILES_MODIFIED:
  - src-tauri/src/ssh/server_info.rs — ServerInfo struct + fetch_server_info()

NOTES:
  - Commands run: hostname, /etc/os-release, uname -r, nproc, free -m, df -BG /, /proc/uptime
  - Parse helpers: parse_ram(), parse_disk() — handle missing/malformed output gracefully
  - All execute() calls use unwrap_or for non-critical fields (kernel, os, uptime)
  - cargo check: PASS

NEXT_TASK: T08 — Tauri IPC commands
