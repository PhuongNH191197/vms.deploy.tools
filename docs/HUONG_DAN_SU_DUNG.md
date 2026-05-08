# Huong Dan Su Dung VMS Deploy Tools
## (Doc xong la lam duoc - don gian nhu choi Lego)

---

> **Day la gi?**
> VMS Deploy Tools giup ban quan ly va cai dat phan mem tren nhieu may tinh Linux tu xa, ngay tren may tinh Windows cua ban. Khong can biet lenh Linux. Khong can viet code. Chi can bam nut.

---

## MUC LUC

1. [Lan dau mo app](#1-lan-dau-mo-app)
2. [Them may chu vao danh sach](#2-them-may-chu-vao-danh-sach)
3. [Kiem tra ket noi den may chu](#3-kiem-tra-ket-noi)
4. [Setup may chu lan dau (Wizard 7 buoc)](#4-setup-may-chu-lan-dau-wizard-7-buoc)
5. [Xem lich su va Rollback](#5-xem-lich-su-va-rollback)
6. [Theo doi may chu dang chay (Monitor)](#6-theo-doi-may-chu-monitor)
7. [Deploy nhieu may cung luc (Bulk Deploy)](#7-deploy-nhieu-may-cung-luc-bulk-deploy)
8. [Nhat ky hanh dong (Audit Log)](#8-nhat-ky-hanh-dong-audit-log)
9. [Quan ly file mau (Templates)](#9-quan-ly-file-mau-templates)
10. [Cac loi thuong gap va cach xu ly](#10-cac-loi-thuong-gap)

---

## 1. LAN DAU MO APP

Khi mo app lan dau, ban se thay man hinh nay:

```
+--------------------------------------------------+
|  [Server] Server Dashboard                       |
|                                                  |
|  [Setup] [Update] [Monitor] [Audit] [Templates]  |
|  [+ Them Server]                                 |
|                                                  |
|  Chua co server nao. Them server de bat dau.     |
+--------------------------------------------------+
```

**Man hinh chinh co gi?**

| Nut bam | Dung de lam gi |
|---------|----------------|
| **+ Them Server** | Them may chu Linux moi vao danh sach |
| **Setup** | Cai dat phan mem len may chu lan dau |
| **Update** | Xem lich su va quay lai ban cu |
| **Monitor** | Xem may chu dang chay gi, CPU, RAM |
| **Audit** | Xem ai da lam gi, luc nao |
| **Templates** | Quan ly file cau hinh mau tu Git |

---

## 2. THEM MAY CHU VAO DANH SACH

> **Hieu don gian:** May chu giong nhu so dien thoai luu trong danh ba. Phai luu truoc moi goi duoc.

### Buoc 1 — Bam nut "+ Them Server"

Cua so nho hien ra:

```
+--------------------------------+
|  Them Server Moi               |
|                                |
|  Ten server:  [____________]   |
|  Host (IP):   [____________]   |
|  Port SSH:    [22          ]   |
|  Username:    [____________]   |
|  Nhom:        [lab v]          |
|                                |
|  Kieu xac thuc:                |
|  ( ) Mat khau                  |
|  ( ) SSH Key                   |
|                                |
|  Mat khau / Key: [__________]  |
|                                |
|  [Huy]          [Luu Server]   |
+--------------------------------+
```

### Buoc 2 — Dien thong tin

| O nhap | Dien gi | Vi du |
|--------|---------|-------|
| **Ten server** | Ten ban tu dat de nho | `prod-web-01` |
| **Host (IP)** | Dia chi IP cua may chu | `192.168.1.100` |
| **Port SSH** | Thuong la 22, giu nguyen neu khong biet | `22` |
| **Username** | Ten tai khoan tren may chu Linux | `ubuntu` hoac `root` |
| **Nhom** | Phan loai may chu | `production`, `staging`, `lab` |

### Buoc 3 — Chon kieu xac thuc

**Neu dung mat khau:**
- Chon "Mat khau"
- Nhap mat khau SSH cua may chu do vao o "Mat khau"

**Neu dung SSH Key:**
- Chon "SSH Key"
- Dan noi dung file `.pem` hoac private key vao o do

### Buoc 4 — Bam "Luu Server"

Server xuat hien trong danh sach. Cot CPU va RAM hien "—" vi chua ket noi.

---

## 3. KIEM TRA KET NOI

Sau khi them server, hay kiem tra xem app co ket noi duoc khong.

### Cach 1 — Xem trang thai chep (dot mau)

Trong danh sach server, cot dau tien co dot mau nho:

- **Dot xanh la** = May chu dang hoat dong binh thuong
- **Dot vang** = May chu co van de (RAM/CPU qua cao)
- **Dot do** = Khong ket noi duoc
- **Dot xam** = Chua kiem tra bao gio

### Cach 2 — Xem thong tin chi tiet

Bam nut **[i]** (icon thong tin) o cuoi hang server. Panel ben phai mo ra hien thi:
- He dieu hanh
- CPU, RAM, Disk dang su dung
- Uptime (may chay bao lau roi)
- Docker va cac cong cu da cai dat

> **Neu panel hien loi "fetch that bai":** Kiem tra lai mat khau hoac SSH key. Ket noi internet tu may ban den server co hoat dong khong.

---

## 4. SETUP MAY CHU LAN DAU (WIZARD 7 BUOC)

> **Hieu don gian:** Wizard nhu huong dan lap Lego. Cu theo tung buoc, xong buoc nay moi sang buoc tiep.

Bam nut **Setup** tren man hinh chinh.

```
+-----------------------------------------------+
|  Deploy Wizard                                |
|                                               |
|  [1] [2] [3] [4] [5] [6] [7]                 |
|   ^                                           |
|  Buoc 1: Ket noi may chu                      |
+-----------------------------------------------+
```

---

### BUOC 1 — Chon may chu va ket noi

1. Chon may chu tu danh sach (da them o phan 2)
2. Chon kieu xac thuc: **Mat khau** hoac **SSH Key**
3. Nhap mat khau / key
4. Chon moi truong: `production`, `staging`, hoac `lab`
5. Nhap **Thu muc goc** tren server (thuong la `/opt/vms`)
6. Bam **[Kiem tra ket noi]**
   - Neu hien "Ket noi thanh cong" (mau xanh): bam **[Tiep theo]**
   - Neu hien loi do: kiem tra lai mat khau / IP

---

### BUOC 2 — Kiem tra cong cu moi truong

App tu dong kiem tra cac phan mem can thiet tren may chu:

```
docker          [OK]  v24.0.5
docker-compose  [OK]  v2.21.0
git             [OK]  v2.40.0
curl            [OK]  v7.88.1
wget            [CHUA CAI]  [Cai ngay]
openssl         [OK]  v3.0.8
```

- **[OK]** = Da co, khong can lam gi
- **[CHUA CAI]** = Bam nut **[Cai ngay]** de cai tu dong
- Doi cai xong, bam **[Kiem tra lai]** cho den khi tat ca la [OK]
- Bam **[Tiep theo]**

> **Luu y:** Neu may chu khong co internet, viec cai dat co the that bai. Can kiem tra ket noi mang tren may chu truoc.

---

### BUOC 3 — Tao Docker Network

Docker network nhu "duong truyen noi bo" giua cac container.

1. App de san mot so network mac dinh (vi du: `vms-network`)
2. Bam **[+ Them]** neu muon them network
3. Bam **[Tao tat ca network]**
4. Doi cot trang thai hien mau xanh het
5. Bam **[Tiep theo]**

---

### BUOC 4 — Upload file cau hinh ngoai (Externals)

Day la buoc upload cac file can thiet (docker-compose, config) tu may Windows cua ban len may chu Linux.

1. Chon dich vu can cai (MinIO, RabbitMQ, Keycloak, Redis, v.v.)
2. Voi moi dich vu, chon **nguon file**:
   - **Thu muc local**: chon folder tren may Windows cua ban
   - **Git URL**: nhap link repository Git

> **Neu dung Git:** Nhap URL va branch, app tu dong clone ve.

3. Bam **[Upload tat ca]**
4. Doi thanh cong (mau xanh)
5. Bam **[Tiep theo]**

---

### BUOC 5 — Cau hinh bien moi truong (.env)

Buoc nay nhap cac gia tri cau hinh cho tung dich vu (mat khau, port, host, v.v.).

```
+------------------------------------------+
|  MinIO  |  RabbitMQ  |  Keycloak  | ...  |
|                                          |
|  MINIO_ROOT_USER:     [minioadmin    ]   |
|  MINIO_ROOT_PASSWORD: [______________]   |
|  MINIO_HOST:          [192.168.1.100 ]   |
|  MINIO_PORT:          [9000          ]   |
|  MINIO_CONSOLE_PORT:  [9001          ]   |
|                                          |
|  [+ Them bien]   [Xoa bien da chon]      |
+------------------------------------------+
```

**Quy tac:**
- O mau do = bat buoc phai dien (mat khau con trong)
- Host tu dong dien IP cua server
- Doi voi mat khau: dien mat khau manh, it nhat 12 ky tu

Sau khi dien xong, bam **[Tiep theo]**.

---

### BUOC 6 — Cau hinh ung dung chinh (Apps)

Them cac ung dung ban muon deploy (API, Web, Worker, v.v.).

1. Bam **[+ Them ung dung]**
2. Nhap ten ung dung (vi du: `my-api`)
3. Chon nguon: **Git URL** hoac **file .tar tren server**
4. Neu dung Git: nhap URL repository va branch
5. Lap lai cho moi ung dung
6. Bam **[Tiep theo]**

---

### BUOC 7 — Bat dau Deploy

Man hinh hien danh sach cac buoc se chay:

```
  [Dang cho] Upload file cau hinh minio
  [Dang cho] Tao mang Docker
  [Dang cho] Chay docker-compose up minio
  [Dang cho] Clone repo my-api
  [Dang cho] Chay docker-compose up my-api
```

Bam **[Bat dau Deploy]**. Moi buoc se tu dong chay:

```
  [Xong]      Upload file cau hinh minio
  [Dang chay] Tao mang Docker
  [Dang cho]  Chay docker-compose up minio
  ...
```

- **Xanh la** = Thanh cong
- **Do** = That bai (bam de xem log loi)
- **Xoay tron** = Dang chay

Khi tat ca xanh la: **deploy thanh cong!** Bam **[Hoan tat]** de ve Home.

> **Neu mot buoc that bai:** Xem log loi hien thi ben duoi ten buoc do. Sua loi roi bam **[Chay lai buoc nay]**.

---

## 5. XEM LICH SU VA ROLLBACK

> **Hieu don gian:** Rollback giong nhu Ctrl+Z trong Word — quay lai truoc khi lam hong.

Bam nut **Update** tren man hinh chinh.

### Xem lich su deploy

Man hinh hien tung may chu theo tab. Chon ten may chu.

```
+-----------------------------------------------+
|  prod-web-01  |  prod-db-01  |  staging-01    |
+-----------------------------------------------+
|                                               |
|  [success] nginx    update   v1.2.3           |
|            by devbox  -  2024-05-01 10:30     |
|                                               |
|  [failed]  my-api   install  v1.0.0           |
|            by devbox  -  2024-05-01 09:15     |
|  [Rollback nginx@nginx:1.1.0]                 |
|                                               |
+-----------------------------------------------+
```

**Y nghia cac mau:**
- **Xanh (success)** = Deploy thanh cong
- **Do (failed)** = Deploy that bai
- **Xanh duong (in_progress)** = Dang chay

### Cach Rollback ve ban cu

1. Tim dong co nut **[Rollback ten-app@phien-ban]**
2. Bam vao do — cua so xac nhan hien ra
3. Nhap mat khau SSH (de bao ve: phai xac nhan moi rollback)
4. Bam **[Rollback]**
5. Doi log hien "Rollback hoan thanh" mau xanh

> **Rollback se lam gi?**
> 1. Tat container hien tai (`docker-compose down`)
> 2. Khoi phuc file docker-compose.yml ban cu
> 3. Khoi dong lai container cu (`docker-compose up`)

---

## 6. THEO DOI MAY CHU (MONITOR)

Bam nut **Monitor** tren man hinh chinh.

### Xem tong quan may chu

```
+--------------------------------------------------+
|  prod-web-01   [Nhap mat khau]  [Load]           |
+--------------------------------------------------+
|  CPU    [=====>       ] 45%                      |
|  RAM    [========>    ] 67%  (10.7 GB / 16 GB)   |
|  Disk   [=>           ] 23%                      |
|                                                  |
|  v Lich su metrics  (1h | 6h | 24h)              |
+--------------------------------------------------+
```

**Cac buoc:**
1. Chon may chu tu tab ben tren
2. Nhap mat khau SSH
3. Bam **[Load]**
4. App hien CPU, RAM, Disk theo thoi gian thuc

### Xem bieu do lich su (Metrics Chart)

1. Bam vao dong **"v Lich su metrics"** de mo ra
2. Chon khoang thoi gian: **1h**, **6h**, hoac **24h**
3. Bieu do hien 3 duong:
   - Duong xanh = CPU (%)
   - Duong cam = RAM (%)
   - Duong tim = Disk (%)

> Bieu do tu luu du lieu 48 gio. Qua 48 gio se tu dong xoa de khong chiem o dia.

### Xem danh sach container dang chay

Cuon xuong phan **Container**:

```
+------------------------------------------+
|  TEN          IMAGE     TRANG THAI  CPU  RAM  |
|  nginx-prod   nginx:1   Up 3 days   1%   2%   |
|  my-api       myapp:2   Up 5 hours  5%   12%  |
|  postgres     pg:14     Up 3 days   0%   8%   |
+------------------------------------------+
```

Voi moi container, co 3 nut hanh dong:

| Nut | Lam gi |
|-----|--------|
| **[Restart]** | Khoi dong lai container (dung -> chay) |
| **[Stop]** | Tat container |
| **[Start]** | Bat container dang tat |

> **Luon hoi truoc khi Stop!** Tat container dang phuc vu nguoi dung se gay gian doan.

### Xem log cua container

1. Bam ten container de mo panel log
2. Log hien thi theo thoi gian thuc (tuong tu nhu `docker logs -f`)
3. Bam **[Dung]** de ngung stream log
4. Log tu dong cuon xuong cuoi

---

## 7. DEPLOY NHIEU MAY CUNG LUC (BULK DEPLOY)

> **Dung khi:** Ban muon deploy cung mot lenh SSH len nhieu may chu mot luc. Vi du: restart nginx tren 10 may production cung luc.

### Buoc 1 — Chon nhieu may chu

Tren man hinh Home, tick checkbox o dau moi hang:

```
[v] prod-web-01   192.168.1.100   production
[v] prod-web-02   192.168.1.101   production
[ ] staging-01    192.168.1.200   staging
[v] prod-web-03   192.168.1.102   production
```

Hoac tick **checkbox dau tieu de** de chon tat ca may trong nhom hien tai.

### Buoc 2 — Bam [Bulk Deploy (3)]

So trong ngoac la so may dang chon.

### Buoc 3 — Cau hinh trong dialog

```
+----------------------------------------------+
|  Bulk Deploy (3 may chu)                     |
|                                              |
|  Kieu xac thuc:  ( ) Mat khau  ( ) SSH Key  |
|  Mat khau/Key:   [________________________]  |
|                                              |
|  Lenh SSH se chay:                           |
|  +------------------------------------------+|
|  |docker-compose -f /opt/vms/nginx/          ||
|  |docker-compose.yml restart                 ||
|  +------------------------------------------+|
|                                              |
|  May chu se deploy:                          |
|  [v] prod-web-01                             |
|  [v] prod-web-02                             |
|  [v] prod-web-03                             |
|                                              |
|  [Huy]            [Bat dau Deploy]           |
+----------------------------------------------+
```

1. Chon **kieu xac thuc** (mat khau hoac SSH key)
2. Nhap mat khau hoac key
3. Nhap **lenh SSH** muon chay tren tat ca may
4. Kiem tra lai danh sach may chu
5. Bam **[Bat dau Deploy]**

### Buoc 4 — Theo doi tien do

App chay toi da 5 may cung luc (de khong qua tai):

```
  prod-web-01  [Dang chay]  [ xem log v ]
  prod-web-02  [Dang chay]  [ xem log v ]
  prod-web-03  [Dang cho]
```

Bam **[xem log v]** de xem chi tiet tung may.

Khi xong:
```
  prod-web-01  [Thanh cong]
  prod-web-02  [Thanh cong]
  prod-web-03  [That bai]   [ xem log v ]  <- xem log de biet loi
```

---

## 8. NHAT KY HANH DONG (AUDIT LOG)

> **Dung de:** Biet ai da lam gi, tren may nao, luc may gio. Rat huu ich khi co su co.

Bam nut **Audit** tren man hinh chinh.

### Xem toan bo lich su

```
+--------------------------------------------------------+
|  Audit Log                                [Xuat CSV] [Xuat PDF]  |
+--------------------------------------------------------+
|  May chu: [Tat ca v]  Hanh dong: [Tat ca v]           |
|  Trang thai: [Tat ca v]   [Tim kiem: ___]  [Tim]      |
+--------------------------------------------------------+
|  success  nginx   update   v1.2.3   prod-web-01        |
|           by devbox (192.168.1.1)   2024-05-01 10:30   |
|                                                        |
|  failed   my-api  install  v1.0.0   prod-web-01        |
|           by devbox (192.168.1.1)   2024-05-01 09:15   |
|           [> Xem log chi tiet]                         |
+--------------------------------------------------------+
```

### Loc theo tieu chi

| Bo loc | Chon gi |
|--------|---------|
| **May chu** | Chon ten may cu the, hoac "Tat ca" |
| **Hanh dong** | `install`, `update`, `rollback`, `remove` |
| **Trang thai** | `success`, `failed`, `in_progress` |
| **Tim kiem** | Nhap ten module (vi du: `nginx`) |

### Xem log chi tiet

Bam **[> Xem log chi tiet]** tren moi dong de mo log day du.

### Xuat bao cao

| Nut | Ket qua |
|-----|---------|
| **[Xuat CSV]** | Tai file `.csv` mo duoc bang Excel |
| **[Xuat PDF]** | In / luu file PDF bao cao dep |

> **Meo:** Dung bo loc truoc khi xuat. Vi du: loc "failed" roi xuat PDF -> bao cao cac lan loi.

---

## 9. QUAN LY FILE MAU (TEMPLATES)

> **Day la gi?** Luu cac file docker-compose.yml mau tren Git. Khi setup may moi, chi can Sync ve va dung lien — khong can goi qua email.

Bam nut **Templates** tren man hinh chinh.

### Cau hinh nguon Git

```
+------------------------------------------+
|  Git URL:    [__________________________] |
|  Branch:     [main                     ] |
|              [Luu cau hinh]              |
+------------------------------------------+
```

1. Dan URL repository Git (vi du: `https://github.com/cty/vms-templates`)
2. Nhap ten branch (mac dinh: `main`)
3. Bam **[Luu cau hinh]**

### Dong bo file mau

Bam **[Dong bo Git]**. App chay `git clone` hoac `git pull`:

```
$ git clone https://github.com/cty/vms-templates .
Cloning into '.'...
remote: Enumerating objects: 45, done.
remote: Counting objects: 45, done.
Receiving objects: 100% (45/45), done.
✓ Sync hoan thanh.
```

### Xem file da dong bo

Sau khi sync, danh sach file hien thi ben duoi:

```
nginx/docker-compose.yml          2.1 KB
postgres/docker-compose.yml       1.8 KB
rabbitmq/docker-compose.yml       3.2 KB
minio/docker-compose.yml          2.5 KB
```

> Cac file nay duoc luu tai: `%APPDATA%\VMS-Tool\templates\git-cache\`

---

## 10. CAC LOI THUONG GAP

### Loi: "Connection refused" hoac "Timeout"

**Nguyen nhan:** May chu khong chap nhan ket noi.

**Cach xu ly:**
1. Kiem tra IP: `ping 192.168.x.x` tren may Windows
2. Kiem tra SSH port: thu dung PuTTY ket noi tay
3. Kiem tra tuong lua (firewall) tren may chu co block port 22 khong

---

### Loi: "Authentication failed"

**Nguyen nhan:** Mat khau sai hoac SSH key sai.

**Cach xu ly:**
1. Thu dang nhap bang PuTTY voi cung thong tin do
2. Kiem tra username (phan biet chu hoa chu thuong: `root` != `Root`)
3. Neu dung SSH key: dam bao dan dung **private key** (khong phai public key)

---

### Loi: "docker: command not found" trong buoc 2

**Nguyen nhan:** Docker chua duoc cai tren may chu.

**Cach xu ly:**
- Bam nut **[Cai ngay]** ben canh "docker"
- Doi it nhat 2-3 phut de cai xong
- Bam **[Kiem tra lai]**

---

### Loi: "git not found" khi Sync Templates

**Nguyen nhan:** May Windows chua cai Git.

**Cach xu ly:**
1. Tai Git tai: https://git-scm.com/download/win
2. Cai dat, khoi dong lai app

---

### Bieu do Metrics trong Monitor khong co du lieu

**Nguyen nhan:** Chua load may chu lan nao (chua co du lieu luu).

**Cach xu ly:**
1. Vao Monitor
2. Nhap mat khau va bam [Load] it nhat mot lan
3. Du lieu se duoc luu vao DB local
4. Mo lai bieu do sau 5-10 phut de thay duong do thi

---

## PHU LUC — GIAI THICH THUAT NGU

| Thuat ngu | Hieu nhu la |
|-----------|-------------|
| **Server / May chu** | May tinh Linux o xa, chay 24/7 |
| **SSH** | Chiec "chia khoa" de vao may chu tu xa |
| **Docker** | "Hop" chua ung dung, chay doc lap, khong anh huong nhau |
| **Container** | Mot ung dung dang chay trong hop Docker |
| **docker-compose** | Huong dan mo nhieu hop Docker cung luc |
| **Deploy** | Cai dat / cap nhat ung dung len may chu |
| **Rollback** | Quay lai ban phan mem truoc do (Ctrl+Z cho server) |
| **Image tag** | Ten phien ban cua mot container (vi du: `nginx:1.24`) |
| **.env file** | File chua mat khau, cau hinh bi mat (khong nen chia se) |
| **Audit log** | Nhat ky ghi lai ai da lam gi, luc nao |
| **Network Docker** | "Duong cap" noi cac container lai voi nhau |
| **Root path** | Thu muc goc luu tat ca du lieu VMS (thuong `/opt/vms`) |
| **Credential** | Mat khau hoac chung chi xac thuc |
| **Production** | Moi truong that — nguoi dung thuc te dang dung |
| **Staging** | Moi truong thu nghiem — gong het Production nhung khong that |
| **Lab** | Moi truong phat trien — thu nghiem tinh nang moi |

---

## LUU DO TONG QUAN QUY TRINH

```
LAN DAU
=======
Them Server  -->  Setup Wizard (7 buoc)  -->  Deploy thanh cong
                  |
                  Buoc 1: Chon may chu & ket noi
                  Buoc 2: Kiem tra / cai cong cu
                  Buoc 3: Tao Docker network
                  Buoc 4: Upload file cau hinh
                  Buoc 5: Nhap bien moi truong
                  Buoc 6: Them ung dung chinh
                  Buoc 7: Bat dau deploy


LAN SAU (cap nhat, xu ly su co)
================================
Monitor  -->  Phat hien van de
     |
     +--> Rollback (quay lai ban cu)
     +--> Restart container
     +--> Xem log de tim nguyen nhan


HANG NGAY
=========
Monitor  -->  Kiem tra CPU/RAM/Disk
Audit   -->  Xem ai da lam gi hom nay
Bulk    -->  Deploy cung luc nhieu may khi release moi
```

---

*Phien ban tai lieu: 1.0 | Cap nhat: 2026-05-07*
*Danh cho: VMS Deploy Tools v0.1.0 (Tauri 2.0 + Rust + React)*
