## Task-17: Server status polling (30s)

STATUS: DONE
DATE: 2026-05-07

FILES_CREATED:
  - src-tauri/src/ssh/metrics.rs     — ServerMetrics struct + fetch_metrics (vmstat/free -m/df -BG)
  - src/store/monitorStore.ts        — Zustand: credential cache, 30s setInterval polling, status logic

FILES_MODIFIED:
  - src-tauri/src/ssh/mod.rs         — pub mod metrics
  - src-tauri/src/commands/server.rs — get_server_metrics command
  - src-tauri/src/lib.rs             — register get_server_metrics
  - src/types/index.ts               — ServerMetrics interface
  - src/lib/tauri/commands.ts        — getServerMetrics wrapper
  - src/pages/Home.tsx               — StatusDot component, CPU/RAM progress bars per row

NOTES:
  - Status logic: online=default, warning=CPU>80%||RAM>90%, offline=error/null
  - Credentials stored in monitorStore memory only (never persisted)
  - CPU via: vmstat idle% → 100-idle
  - cargo check: PASS

NEXT_TASK: T18 — Env Check UI
