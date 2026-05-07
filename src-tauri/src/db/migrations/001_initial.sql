-- VMS Deploy Tool — Initial Schema

CREATE TABLE IF NOT EXISTS servers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    host        TEXT NOT NULL,
    port        INTEGER NOT NULL DEFAULT 22,
    username    TEXT NOT NULL,
    auth_type   TEXT NOT NULL CHECK (auth_type IN ('password', 'key')),
    credential  BLOB NOT NULL,
    group_name  TEXT NOT NULL DEFAULT 'lab',
    last_seen   DATETIME
);

CREATE TABLE IF NOT EXISTS deploy_history (
    id              TEXT PRIMARY KEY,
    server_id       TEXT NOT NULL REFERENCES servers(id),
    module_name     TEXT NOT NULL,
    module_version  TEXT NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('install', 'update', 'rollback', 'remove')),
    status          TEXT NOT NULL CHECK (status IN ('success', 'failed', 'in_progress')),
    operator_ip     TEXT NOT NULL,
    operator_host   TEXT NOT NULL,
    snapshot_path   TEXT,
    log_output      TEXT,
    deployed_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS snapshots (
    id              TEXT PRIMARY KEY,
    deploy_id       TEXT NOT NULL REFERENCES deploy_history(id),
    server_id       TEXT NOT NULL,
    module_name     TEXT NOT NULL,
    compose_backup  TEXT NOT NULL,
    image_tag       TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deploy_history_server ON deploy_history(server_id);
CREATE INDEX IF NOT EXISTS idx_deploy_history_deployed_at ON deploy_history(deployed_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_deploy ON snapshots(deploy_id);
