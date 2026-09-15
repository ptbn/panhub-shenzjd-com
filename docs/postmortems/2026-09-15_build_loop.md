# 复盘报告：后台构建轮询循环与离线下载状态真伪校验

## 1. 根因定性
- 频繁打出 "Checked task Run npm run build again"：在启动耗时任务后违背了异步等待规范，使用 manage_task 的 status 频繁轮询，导致生成冗余日志并引发流中断。
- PanHub 报成功但无落盘：AList 接口只要入队就返回 HTTP 200，未回查任务列表导致无法识别真实失败。

## 2. 根治方案
- 严禁任何 status 轮询，统一由系统消息异步自动唤醒。
- alistClient.ts 实现任务列表深度回查与 isFailedTaskState 校验，测试用例全部断言通过。
- 交付只读诊断工具 scripts/diagnose-nas-push.mjs。
