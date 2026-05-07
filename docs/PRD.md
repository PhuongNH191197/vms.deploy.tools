# VMS Deployment Tool — PRD v1.0

> **CONFIDENTIAL** | Platform: Windows Desktop (Tauri 2.0 + React 18) | Status: Draft

---

## 1. TỔNG QUAN

### Mục tiêu
Desktop app Windows cho DevOps/Admin triển khai, quản lý, giám sát toàn bộ microservice trên 20+ Linux server qua SSH — không cần PuTTY/WinSCP thủ công.

### Vấn đề cần giải quyết
- Triển khai thủ công tốn thời gian, dễ sai sót với 20+ server
- Không có tool thống nhất cho lifecycle: cài đặt → deploy → monitor → rollback
- ENV rải rác, không chuẩn hóa
- Thiếu audit trail (ai deploy gì, lúc nào)
- Không có rollback nhanh khi production sự cố

### Người dùng
| Vai trò | Quyền hạn |
|---------|-----------|
| DevOps Engineer | Full access |
| System Admin | Setup + Monitor + Logs + Audit |
| Developer | Monitor + View Logs (read-only) |

### Phạm vi v1.0
- 10 External services: MinIO, RabbitMQ, Keycloak, Redis, Elasticsearch, Grafana, Prometheus + 3 custom
- 10 Application modules: microservice .NET based
- 20+ Linux server (Ubuntu 20.04/22.04 LTS)
- Windows 10/11 64-bit — file cài .msi

---

## 2. TECH STACK

| Layer | Công nghệ | Lý do |
|-------|-----------|-------|
| Desktop Shell | Tauri 2.0 | ~8MB bundle, Rust core, Windows native |
| Frontend | React 18 + TypeScript | Component-based, dễ vibe code |
| Styling | TailwindCSS + shadcn/ui | Rapid UI, dark mode |
| Terminal | xterm.js | ANSI colors, realtime streaming |
| Charts | Recharts | Declarative, nhẹ, polling data |
| Rust Backend | Tauri commands + events | SSH/SCP native, async tokio |
| SSH/SCP | russh crate | Pure Rust SSH2, async |
| Database | SQLite via sqlx | Zero config, ACID |
| Credentials | AES-256 + Windows DPAPI | Gắn Windows user account |
| Packaging | .msi via Tauri bundler | Single installer |

---

## 3. CẤU TRÚC THƯ MỤC

```
src-tauri/src/
  ssh/          — SSH connection pool, session manager, keepalive
  scp/          — File transfer engine, progress events, resume
  db/           — SQLite models, migrations, query helpers
    migrations/
      001_initial.sql
  commands/     — Tauri command handlers (IPC bridge)

src/
  pages/        — Home, Setup, Update, Monitor, Audit
  components/   — Terminal, Charts, StepWizard, ServerCard, Tables
  store/        — Zustand slices: servers, wizard, monitor
  lib/tauri/    — Typed TypeScript wrappers cho Rust commands
  types/        — Shared TypeScript interfaces

templates/
  builtin/      — 10 external + 10 app templates (compile vào binary)

docs/           — PRD, DB_SCHEMA, ENV_VARS, SPRINTS

%APPDATA%/VMS-Tool/
  db/                       — servers.db (SQLite runtime)
  templates/git-cache/      — Templates sync từ Git
  templates/local/          — User custom templates (priority cao nhất)
```

---

## 4. DATABASE SCHEMA

### Bảng: servers
| Column | Type | Mô tả |
|--------|------|-------|
| id | TEXT PK | UUID v4 |
| name | TEXT | Tên hiển thị (vd: Prod-01) |
| host | TEXT | IP hoặc hostname |
| port | INTEGER | SSH port, default 22 |
| username | TEXT | SSH username |
| auth_type | TEXT | 'password' hoặc 'key' |
| credential | BLOB | AES-256 encrypted |
| group_name | TEXT | 'production' / 'staging' / 'lab' / custom |
| last_seen | DATETIME | Lần kết nối thành công gần nhất |

### Bảng: deploy_history (Audit Log)
| Column | Type | Mô tả |
|--------|------|-------|
| id | TEXT PK | UUID v4 |
| server_id | TEXT FK | → servers.id |
| module_name | TEXT | Tên module/external |
| module_version | TEXT | Version được deploy |
| action | TEXT | 'install' / 'update' / 'rollback' / 'remove' |
| status | TEXT | 'success' / 'failed' / 'in_progress' |
| operator_ip | TEXT | IP máy Windows (auto detected) |
| operator_host | TEXT | Hostname máy Windows (auto detected) |
| snapshot_path | TEXT | Path backup compose file để rollback |
| log_output | TEXT | Full terminal output |
| deployed_at | DATETIME | Timestamp |

### Bảng: snapshots (Rollback Data)
| Column | Type | Mô tả |
|--------|------|-------|
| id | TEXT PK | UUID v4 |
| deploy_id | TEXT FK | → deploy_history.id |
| server_id | TEXT | Server target |
| module_name | TEXT | Module name |
| compose_backup | TEXT | Nội dung docker-compose.yml cũ |
| image_tag | TEXT | Docker image tag cũ |
| created_at | DATETIME | Thời điểm tạo snapshot |

---

## 5. FEATURES CHI TIẾT

### FR-01 — Quản lý Server

**FR-01.1 Thêm & Kết nối Server**
- Input: Host/IP, Port (default 22), Username, Auth type (Password / SSH Key)
- Password: toggle show/hide, lưu AES-256 vào SQLite
- SSH Key: browse .pem/.ppk, passphrase optional
- [Test Connection]: SSH timeout 10s → fetch server info
- Server info: OS version, kernel, CPU cores, RAM total/used, Disk partitions, Network interfaces
- Gán nhóm: Production / Staging / Lab / Custom

**FR-01.2 Server Dashboard**
- Tabs: [Production (N)] [Staging (N)] [Lab (N)] [All (N)]
- Mỗi row: Status dot (🟢/🟡/🔴), Name, Host, CPU%, RAM bar, Disk%, Actions
- 🟡 Warning: CPU > 80% hoặc RAM > 90%
- 🔴 Disconnected: ping/SSH fail
- Polling mỗi 30s: SSH run `vmstat`, `free -m`, `df -h`
- Multi-select checkbox → Bulk: Deploy Selected, Monitor Selected

---

### FR-02 — Setup Wizard (7 Bước)

**Bước 1 — Kết nối & Thông tin**
- Chọn server đã lưu hoặc kết nối mới
- Chọn môi trường: Lab (relaxed) / Production (strict validation)
- Hiển thị full server report sau khi connect

**Bước 2 — Kiểm tra & Cài đặt Môi trường**
- Checklist: Docker Engine, Docker Compose Plugin, Git, curl, wget
- .NET SDK 6/7/8/9, FFmpeg, OpenSSL, jq, htop, unzip
- [Check All]: chạy parallel, spinner per item, hiện version hoặc ❌
- [Install All Missing]: cài tuần tự với streaming log
- [Install] đơn lẻ từng item

**Bước 3 — Docker Networks**
- Dynamic input list: mỗi field = 1 tên network
- [+ Add] thêm field, [×] xóa
- [Create All]: tạo networks chưa tồn tại, skip nếu đã có
- Validate: lowercase letters, numbers, dấu gạch ngang only

**Bước 4 — External Services**
- Layout 2 cột: trái = available list, phải = selected + config
- Config per service: Source radio (Online pull / Offline .tar)
- Online: version picker từ manifest
- Offline: browse .tar + browse folder docker-compose.yml
- SCP upload folder lên: `{root}/external/{service_name}/`
- Root default: `/opt/vms/` — có thể override

**Bước 5 — ENV Configuration**
- Tab bar per external service đã chọn
- Auto-fill nếu service đã cài ở Bước 4: IP=server_host, PORT=default
- Form nhập tay nếu dùng service external bên ngoài
- [+ Add Variable]: custom ENV key-value
- [Preview vms.env]: modal xem trước toàn bộ file
- File lưu: `{root}/vms.env` — tất cả module trỏ `env_file` vào đây

**Bước 6 — Applications**
- Source: Online (Docker Registry) / Offline (.tar) / Git (pull + build)
- Git option: URL, branch, access token (encrypted)
- Mỗi module: template docker-compose.yml dùng `${ENV_VAR}`
- [Generate Combined Compose]: tạo 1 file tổng hợp tất cả modules
- App subfolder: `{root}/apps/{module_name}/`

**Bước 7 — Deploy Execution**
- Deployment Plan: ordered steps với badge [Pending → Running → Done/Failed]
- Thứ tự: SCP files → Tạo thư mục → Ghi vms.env → Install externals → Healthcheck externals → Deploy apps → Healthcheck apps
- Terminal xterm.js realtime streaming SSH output
- [Pause] / [Cancel] + cleanup
- Thành công: link browser đến URL từng service
- Thất bại: highlight step lỗi, [Retry from step N]

---

### FR-03 — Update & Redeploy
- Multi-tab: mỗi server = 1 tab, song song nhiều server
- Mỗi module: container name, status, image tag, uptime, restart count
- Update .tar: SCP upload với progress bar + chunked + resume
- Deploy flow: `docker load` → `compose down` → `compose up -d`
- [View Config]: editor inline application.production.json, [Save & Restart]
- [View Compose]: xem/sửa docker-compose.yml, [Apply Changes]
- [Rollback to vX.X.X]: dropdown 5 phiên bản gần nhất

---

### FR-04 — Monitor & Logs Realtime
- Server group tabs + server sub-tabs
- Metrics per server: CPU gauge, RAM progress bar, Disk per partition
- Auto-refresh mỗi 5s: SSH `vmstat` / `free` / `df` / `docker stats --no-stream`
- Container table: Name, Image, Status badge, CPU%, RAM, Uptime, [Logs][Restart][Stop]
- [Logs]: xterm.js panel — `docker logs -f --tail=200 {container}`
- Controls: [Pause/Resume] [Clear] [Download .log] [Tail: 100/200/500/1000]
- Text search inline, highlight matching lines

---

### FR-05 — Rollback
- Mỗi deploy thành công → auto tạo snapshot (compose + image tag cũ)
- Lưu tối đa 5 snapshots / module (auto xóa cũ hơn)
- Dropdown: hiện deployed_at + operator_ip
- Flow: `compose down` → `docker pull old-tag` (hoặc load .tar) → restore compose → `compose up -d`
- Ghi audit: action = rollback, from_version + to_version

---

### FR-06 — Template System (3 Lớp)
| Layer | Vị trí | Priority |
|-------|--------|----------|
| Built-in | Compile vào binary | Thấp nhất |
| Git cache | `%APPDATA%/VMS-Tool/templates/git-cache/` | Trung bình |
| Local | `%APPDATA%/VMS-Tool/templates/local/` | Cao nhất |

**manifest.json fields:**
| Field | Type | Mô tả |
|-------|------|-------|
| name | string | Tên service |
| version | string | Semver |
| type | string | 'external' / 'application' |
| required_envs | string[] | ENV keys bắt buộc |
| optional_envs | string[] | ENV keys không bắt buộc |
| depends_on | string[] | Services phải chạy trước |
| healthcheck_cmd | string | SSH command verify sau install |
| default_ports | object | Map port_name → số port |
| docker_compose_template | string | Path đến template file |

---

### FR-07 — Audit Log
- Log mọi action: install, update, rollback, remove, config change, env change
- Auto capture: operator_ip (non-loopback IPv4), operator_hostname (COMPUTERNAME)
- Không cần user nhập, không thể giả mạo
- Filter: server, operator IP, date range, action type, status
- Full-text search trong log_output
- Export CSV với filter hiện tại

---

## 6. ENV VARIABLES — External Services

| Service | Default Ports | ENV Variables bắt buộc |
|---------|---------------|----------------------|
| MinIO | 9000, 9001 | MINIO_IP, MINIO_PORT, MINIO_CONSOLE_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY |
| RabbitMQ | 5672, 15672 | RB_MQ_IP, RB_MQ_PORT, RB_MQ_HTTP_PORT, RB_MQ_USER, RB_MQ_PASS, RB_MQ_VHOST |
| Keycloak | 8080 | KC_IP, KC_PORT, KC_REALM, KC_CLIENT_ID, KC_CLIENT_SECRET |
| Redis | 6379 | REDIS_IP, REDIS_PORT, REDIS_PASS |
| Elasticsearch | 9200, 9300 | ES_IP, ES_PORT, ES_USER, ES_PASS |
| Grafana | 3000 | GRAFANA_IP, GRAFANA_PORT, GRAFANA_ADMIN_PASS |
| Prometheus | 9090 | PROM_IP, PROM_PORT |
| Custom 1-3 | Tùy chỉnh | Định nghĩa trong manifest.json |

---

## 7. YÊU CẦU PHI CHỨC NĂNG

| Tiêu chí | Yêu cầu |
|----------|---------|
| Khởi động app | < 3 giây |
| SSH connect | < 5 giây (timeout 10s) |
| SCP upload 1GB .tar | Progress bar, không block UI, chunked 1MB |
| Metrics refresh | Polling 5-30s, UI không lag |
| Log streaming latency | < 500ms từ server |
| Max parallel servers | 20+ servers, 5 deploy đồng thời |
| Credentials security | AES-256 + Windows DPAPI |
| SQLite DB size | < 500MB sau 1 năm (purge log > 90 ngày) |
| App bundle | < 20MB installer .msi |
| Memory | < 200MB RAM khi chạy |

---

## 8. LỘ TRÌNH PHÁT TRIỂN

| Phase | Timeline | Nội dung | Milestone |
|-------|----------|----------|-----------|
| P1 | 6-8 tuần | SSH connect, Server info, Env check, Docker networks, External deploy basic, Monitor cơ bản | MVP: Deploy 1 server end-to-end |
| P2 | 8-10 tuần | App module deploy, ENV + vms.env, SCP upload, Multi-tab, Rollback, Audit log | Full workflow 10 externals + 10 apps |
| P3 | 6 tuần | Git template sync, Bulk deploy 20+ servers, Metrics history, Export reports, Auto-update | Production ready |

### Sprint Plan
| Sprint | Tuần | Focus | Milestone |
|--------|------|-------|-----------|
| S1 | 1-2 | SSH core Rust | App chạy, kết nối SSH, hiện server info |
| S2 | 3-4 | Server Dashboard + Env Check UI | Home screen, check env |
| S3 | 5-6 | Wizard bước 3-4: Networks + Externals | Deploy được MinIO + RabbitMQ |
| S4 | 7-8 | ENV Config + vms.env generation | File vms.env sinh đúng |
| S5 | 9-11 | App module deploy + Rollback | Deploy 1 app, rollback OK |
| S6 | 12-14 | Monitor + Logs xterm.js | Live logs, metrics realtime |
| S7 | 15-16 | Audit log + Multi-tab + Polish | v1.0 production ready |

---

## 9. ACCEPTANCE CRITERIA

| ID | Feature | Tiêu chí |
|----|---------|----------|
| AC-01 | SSH Connect | < 5s, hiện đủ server info. Fail: error rõ, không crash |
| AC-02 | Env Check | Check 10 components parallel, nút Install live output |
| AC-03 | External Deploy | MinIO + RabbitMQ running, healthcheck pass, vms.env đúng |
| AC-04 | App Deploy | Container running, ENV inject đúng, access endpoint OK |
| AC-05 | Rollback | Xong < 60s, chạy image cũ, audit log đầy đủ |
| AC-06 | Monitor | Metrics 5s, logs < 500ms latency, không lag 5 tabs |
| AC-07 | Audit Log | Mọi action có log, operator_ip auto, export CSV OK |
| AC-08 | Security | Password không có trong log/terminal, credentials encrypted |
| AC-09 | SCP Upload | Upload 2GB với progress bar, resume khi drop connection |
| AC-10 | Multi-server | 5 tabs đồng thời, 3 parallel deploys, không deadlock/leak |

---

## 10. ARCHITECTURE RULES (cho AI coding)

```
RUST xử lý:         SSH, SCP, SQLite, file I/O, encryption, process exec
REACT xử lý:        TẤT CẢ UI, state (Zustand), routing, display
IPC bridge:         Tauri commands (invoke) + events (emit/listen)
KHÔNG BAO GIỜ:      Làm SSH/file ops trong React — luôn qua Tauri commands
```

### Rust Standards
- Tauri commands: luôn `Result<T, String>`, không `unwrap()`
- Error handling: dùng `thiserror` crate
- Async: tokio runtime, không blocking call trong async
- Logging: `tracing` crate, **KHÔNG BAO GIỜ log password/secret/token**
- DB: sqlx prepared statements, **không string concat SQL**
- Credentials: luôn encrypt AES-256-GCM trước khi lưu DB

### React/TypeScript Standards
- Functional components + hooks only
- shadcn/ui cho components, TailwindCSS cho custom styles
- Zustand cho global state
- Tất cả `invoke()` wrapped trong `src/lib/tauri/` với TypeScript types
- Error boundaries ở mọi page-level component
- Loading states cho tất cả async operations

### Security Rules
- Password/secret fields: luôn toggle show/hide
- Không lưu credentials trong React state lâu hơn cần
- Confirm dialog bắt buộc: delete, rollback, stop container, remove service
- Audit log: auto capture operator IP/hostname

---

*VMS Tool Team — v1.0 — 06/05/2026*
