# 绿联 DX4600 Prowlarr 部署与无感接入 SOP

本目录为 PanHub 方案 B（BT/磁力全聚合中枢）专属基础设施蓝图，执行严格的**物理隔离与零破坏门禁**。

---

## 一、 物理资源与端口隔离审计表

| 维度 | 配置值 | 隔离与安全承诺 |
| :--- | :--- | :--- |
| **容器名称** | `prowlarr` | 独立容器沙盒，生命周期自主受控 |
| **对外端口** | `9696` | 独立端口，绝不触碰 AList (`45199`)、qBittorrent (`8085/8080`) |
| **物理存储** | `/volume1/docker/prowlarr/config` | 仅存 Prowlarr 自身几兆的 SQLite 索引库，绝不触碰 UGOS 影视卷 |
| **资源限额** | 内存上限 512MB / CPU 1.0 核 | OOM 熔断只杀自身，绝对不拖垮绿联 NAS 宿主机 |

---

## 二、 部署方式（推荐方式 1）

### 方式 1：绿联云 PC / 手机客户端（一键声明式导入·最推荐）
1. 打开绿联云桌面端或 App ➔ 进入 **「Docker」** ➔ 点击 **「项目 (Compose)」**；
2. 点击 **「创建项目」**，项目名称填 `prowlarr`；
3. 将本目录下的 `docker-compose.yml` 完整内容复制并粘贴到文本框中；
4. 点击 **「立即构建并启动」** 即可。

### 方式 2：NAS SSH 命令行启动
```bash
cd /volume1/docker/prowlarr
docker compose up -d
```

---

## 三、 启动验证与 API 密钥提取

1. 容器启动约 30 秒后，浏览器访问：
   `http://192.168.1.110:9696`（或已穿透的 `https://prowlarr.taogehome.cloud`）
2. 初次打开将自动完成初始化；
3. 进入 **Settings (设置) ➔ General (常规) ➔ API Key**：
   复制该串 32 位的 API Key（该 Key 将用于后续与 PanHub 自动化安全鉴权）。
