# PanHub 边缘搜索服务 · 架构红线卡 (REDLINES.md)

1. **边缘计算零 C++ 原生依赖**：所有依赖库必须为纯 JS/TS，保证 100% 兼容 Cloudflare Workers 边缘运行，严禁引入 Node.js 本地 C++ 编译模块。
2. **网盘 Canonical Share ID 物理去重**：链接去重必须使用基于各大网盘真实 Share ID 的规范化提取（`getCanonicalDriveInfo`），消除短链变体与参数刷屏，严禁回退为纯 URL 字符串比对。
3. **BM25 概率相关度检索与打分**：关键词匹配与排序必须使用 `MiniSearch` (BM25) 与 `Intl.Segmenter` 分词，严禁使用粗暴脆弱的 `.some()` 正则误召回。
4. **正文载荷与元数据透传**：服务端必须保留并透传帖子详情正文 `content`（作为 `description`），保证影视体积、编码、音轨与字幕的提取。
5. **黄金测试用例不可篡改**：任何提交前必须通过全量单元测试与 `build:cf` 打包，严禁为了强行通过测试而弱化既有测试用例断言。
