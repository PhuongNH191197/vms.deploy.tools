-- Metrics history: stores polled CPU/RAM/Disk snapshots per server

CREATE TABLE IF NOT EXISTS metrics_history (
    id           TEXT PRIMARY KEY,
    server_id    TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    cpu_percent  INTEGER NOT NULL,
    ram_percent  INTEGER NOT NULL,
    ram_used_mb  INTEGER NOT NULL,
    ram_total_mb INTEGER NOT NULL,
    disk_percent INTEGER NOT NULL,
    recorded_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_metrics_history_server_time
    ON metrics_history(server_id, recorded_at);
