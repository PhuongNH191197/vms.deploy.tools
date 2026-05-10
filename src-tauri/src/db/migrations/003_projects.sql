-- Projects — group servers by project

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#31E8FF',
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE servers ADD COLUMN project_id TEXT REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_servers_project ON servers(project_id);
