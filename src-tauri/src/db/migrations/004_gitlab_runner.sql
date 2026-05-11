-- GitLab Runner Management

CREATE TABLE IF NOT EXISTS gitlab_runners (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id       TEXT    NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    project_name    TEXT    NOT NULL DEFAULT '',
    runner_name     TEXT    NOT NULL,
    tags            TEXT    NOT NULL DEFAULT '',
    executor        TEXT    NOT NULL DEFAULT 'shell',
    gitlab_url      TEXT    NOT NULL,
    token_masked    TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'unknown',
    last_job_status TEXT    NOT NULL DEFAULT '',
    last_checked_at TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gitlab_runners_server  ON gitlab_runners(server_id);
CREATE INDEX IF NOT EXISTS idx_gitlab_runners_project ON gitlab_runners(project_name);

CREATE TABLE IF NOT EXISTS gitlab_api_settings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    gitlab_url    TEXT NOT NULL UNIQUE,
    api_token_enc BLOB NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
