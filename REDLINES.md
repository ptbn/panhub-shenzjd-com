# PanHub 边缘搜索服务 · 架构红线卡 (REDLINES.md)

1. **边缘计算零 C++ 原生依赖**：所有依赖库必须为纯 JS/TS，保证 100% 兼容 Cloudflare Workers 边缘运行，严禁引入 Node.js 本地 C++ 编译模块。
2. **网盘 Canonical Share ID 物理去重**：链接去重必须使用基于各大网盘真实 Share ID 的规范化提取（`getCanonicalDriveInfo`），消除短链变体与参数刷屏，严禁回退为纯 URL 字符串比对。
3. **BM25 概率相关度检索与打分**：关键词匹配与排序必须使用 `MiniSearch` (BM25) 与 `Intl.Segmenter` 分词，严禁使用粗暴脆弱的 `.some()` 正则误召回。
4. **正文载荷与元数据透传**：服务端必须保留并透传帖子详情正文 `content`（作为 `description`），保证影视体积、编码、音轨与字幕的提取。
5. **黄金测试用例不可篡改**：任何提交前必须通过全量单元测试与 `build:cf` 打包，严禁为了强行通过测试而弱化既有测试用例断言。
6. **NAS 与 AList 动态路径与能力严格对齐**：网盘挂载必须按驱动特性区分动态挂载与转存同步，路径须结合实机存储列表动态推导，严禁静态硬编码子路径或裸露底层堆栈。
7. **qBittorrent 状态监控作为单一事实来源 (SSOT)**：BT/磁力离线任务的即时进度、做种数、上下行速率与控制指令必须直连 qBittorrent Web API，严禁依赖 AList 的 `undone/done` 接口作为监控面板数据源（防止因 qB v5.x 契约漂移导致的误报与指标缺失）。
8. **NAS 离线下载临时路径与目标路径必须同卷物理对齐**：AList 调度 qBittorrent 离线下载时，临时目录（`temp_dir`）必须与落地存储挂载在同一物理卷（如 `/volume2/影音资源`），并通过容器内软链接统一路径命名，保证下载完成后的转存为底层文件系统 inode 重命名的“零拷贝原子瞬移”，杜绝跨卷复制阻塞。
9. **Cloudflare D1 物理绑定与 SaaS 多租户严格隔离**：`wrangler.toml` 必须显式声明 D1 `[[d1_databases]]` 物理绑定（`panhub-db`，ID: `7299e484-6c0f-4719-94a1-bb59d8a9a0dd`）；NAS 与 AList 配置强制执行 SaaS 级账号绝对隔离，严禁无专属配置的用户越权降级窃用管理员或其他用户的私有节点；前端必须在用户登录与会话恢复时主动从 D1 回水，彻底杜绝冷重启配置丢失。
10. **边缘部署预设严禁裸跑 node-server**：发布 Cloudflare 边缘前必须使用 `$env:NITRO_PRESET="cloudflare_module"; npx nuxt build` 构建打包，确保 ESM 依赖自包含闭包，严禁直接发布导致 runtime module 缺失。
