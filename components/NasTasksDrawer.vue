<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="visible" class="tasks-drawer-overlay" @click.self="emit('close')">
        <div class="tasks-drawer" role="dialog" aria-label="NAS 下载监控看板">
          <!-- 抽屉头部 -->
          <div class="drawer-header">
            <div class="header-title-group">
              <div class="header-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </div>
              <div>
                <h3 class="drawer-title">NAS 下载看板</h3>
                <p class="drawer-subtitle">
                  qBittorrent 实机直连单一事实来源
                  <span v-if="serverState.qbUrl" class="node-tag">{{ serverState.qbUrl }}</span>
                </p>
              </div>
            </div>
            <div class="header-actions">
              <button
                type="button"
                class="refresh-btn"
                :class="{ spinning: loading }"
                title="刷新任务状态"
                @click="fetchTasks">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </button>
              <button type="button" class="close-btn" @click="emit('close')" title="关闭">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- 任务统计横条 -->
          <div class="stats-bar">
            <div class="stat-item">
              <span class="stat-label">正在下载</span>
              <span class="stat-val active">{{ serverState.downloadingCount || 0 }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">已完成落盘</span>
              <span class="stat-val completed">{{ serverState.completedCount || 0 }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">总任务数</span>
              <span class="stat-val">{{ tasks.length }}</span>
            </div>
          </div>

          <!-- 任务内容区 -->
          <div class="drawer-body">
            <div v-if="loading && tasks.length === 0" class="empty-state">
              <div class="spinner"></div>
              <p>正在穿透连接 qBittorrent 节点...</p>
            </div>

            <div v-else-if="errorMessage" class="error-banner">
              <span class="error-icon">⚠️</span>
              <div class="error-content">
                <div class="font-medium text-amber-200">连接提示</div>
                <div class="text-xs text-amber-300/90 mt-1">{{ errorMessage }}</div>
              </div>
            </div>

            <div v-else-if="tasks.length === 0" class="empty-state">
              <div class="empty-icon">📂</div>
              <p class="text-sm text-gray-400">当前暂无活跃下载任务</p>
              <p class="text-xs text-gray-500 mt-1">在 PanHub 搜索 BT 资源后点击【推送到 NAS】即可在此实时监控</p>
            </div>

            <div v-else class="task-list">
              <div
                v-for="task in tasks"
                :key="task.hash"
                class="task-card"
                :class="{ completed: task.isCompleted }">
                <!-- 任务头部 -->
                <div class="task-card-header">
                  <div class="task-name" :title="task.name">
                    {{ cleanTorrentName(task.name) }}
                  </div>
                  <span class="status-badge" :class="task.badgeType">
                    {{ task.stateText }}
                  </span>
                </div>

                <!-- 进度条 -->
                <div class="progress-bar-wrapper">
                  <div
                    class="progress-bar-fill"
                    :class="{ active: !task.isCompleted && task.state === 'downloading' }"
                    :style="{ width: `${task.progress}%` }">
                  </div>
                </div>

                <!-- 核心指标指标网格 -->
                <div class="task-metrics-grid">
                  <div class="metric-col">
                    <span class="metric-label">进度</span>
                    <span class="metric-val text-emerald-400 font-semibold">{{ task.progress }}%</span>
                  </div>
                  <div class="metric-col">
                    <span class="metric-label">下载速率</span>
                    <span class="metric-val font-mono" :class="{ 'text-emerald-400': task.speedText !== '0 B/s' }">
                      {{ task.speedText }}
                    </span>
                  </div>
                  <div class="metric-col">
                    <span class="metric-label">已下 / 总计</span>
                    <span class="metric-val font-mono text-gray-300">
                      {{ task.downloadedText }} / {{ task.sizeText }}
                    </span>
                  </div>
                  <div class="metric-col">
                    <span class="metric-label">剩余时间</span>
                    <span class="metric-val font-mono text-gray-300">{{ task.etaText }}</span>
                  </div>
                </div>

                <!-- 底部辅助信息与操作按钮 -->
                <div class="task-card-footer">
                  <div class="seeds-info">
                    <span title="做种节点数">👥 做种: {{ task.seedsText }}</span>
                    <span class="ml-2" title="下载节点数">📥 下载: {{ task.leechsText }}</span>
                  </div>
                  <div class="action-buttons">
                    <button
                      v-if="task.state === 'pausedDL'"
                      type="button"
                      class="card-btn resume"
                      title="继续任务"
                      @click="handleControl('resume', task.hash)">
                      ▶️ 继续
                    </button>
                    <button
                      v-else-if="!task.isCompleted"
                      type="button"
                      class="card-btn pause"
                      title="暂停任务"
                      @click="handleControl('pause', task.hash)">
                      ⏸️ 暂停
                    </button>
                    <button
                      type="button"
                      class="card-btn delete"
                      title="删除任务"
                      @click="handleControl('delete', task.hash)">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 抽屉底部快捷链接 -->
          <div class="drawer-footer">
            <a
              v-if="serverState.qbUrl"
              :href="serverState.qbUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="footer-link-btn">
              🌐 打开 qBittorrent 完整控制台
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

interface TaskItem {
  id: string;
  hash: string;
  name: string;
  state: string;
  stateText: string;
  badgeType: "primary" | "warning" | "success" | "neutral" | "danger";
  isCompleted: boolean;
  progress: number;
  speedText: string;
  upSpeedText: string;
  sizeText: string;
  downloadedText: string;
  etaText: string;
  seedsText: string;
  leechsText: string;
  savePath: string;
  addedAt: string;
}

const tasks = ref<TaskItem[]>([]);
const loading = ref(false);
const errorMessage = ref("");
const serverState = ref<{
  downloadingCount?: number;
  completedCount?: number;
  qbUrl?: string;
}>({});

let pollTimer: ReturnType<typeof setInterval> | null = null;

function cleanTorrentName(name: string): string {
  if (!name) return "";
  return name.replace(/^magnet:\?xt=urn:btih:[a-zA-Z0-9]+&dn=/i, "").replace(/&tr=.*$/i, "");
}

async function fetchTasks() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await $fetch<any>("/api/nas/tasks");
    if (res.code === 0) {
      if (res.success === false) {
        errorMessage.value = res.message || "未能连接到 qBittorrent 节点";
        tasks.value = [];
      } else {
        tasks.value = res.data.tasks || [];
        serverState.value = {
          downloadingCount: res.data.downloadingCount,
          completedCount: res.data.completedCount,
          qbUrl: res.data.qbUrl,
        };
      }
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || "获取任务状态失败";
  } finally {
    loading.value = false;
  }
}

async function handleControl(action: "pause" | "resume" | "delete", hash: string) {
  if (action === "delete" && !confirm("确定要从 qBittorrent 队列中移除此任务吗？")) {
    return;
  }
  try {
    const res = await $fetch<any>("/api/nas/tasks/action", {
      method: "POST",
      body: {
        action,
        hashes: [hash],
        deleteFiles: false,
      },
    });
    if (res.success) {
      await fetchTasks();
    } else {
      alert(res.message || "操作失败");
    }
  } catch (err: any) {
    alert(err?.data?.message || err?.message || "操作执行异常");
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      fetchTasks();
      // 打开抽屉时启动静默轮询 (每 3.5 秒一次)
      if (!pollTimer) {
        pollTimer = setInterval(() => {
          fetchTasks();
        }, 3500);
      }
    } else {
      // 关闭抽屉时销毁轮询定时器，零浪费
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<style scoped>
.tasks-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.tasks-drawer {
  width: 100%;
  max-width: 460px;
  height: 100%;
  background: #12141a;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(15, 118, 110, 0.3) 100%);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.drawer-title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.drawer-subtitle {
  font-size: 11px;
  color: #94a3b8;
  margin: 2px 0 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-tag {
  font-size: 10px;
  font-family: monospace;
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  color: #cbd5e1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.refresh-btn,
.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover,
.close-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.refresh-btn.spinning svg {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.stats-bar {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 11px;
  color: #64748b;
}

.stat-val {
  font-size: 15px;
  font-weight: 700;
  color: #e2e8f0;
  margin-top: 1px;
}

.stat-val.active {
  color: #34d399;
}

.stat-val.completed {
  color: #60a5fa;
}

.stat-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.08);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: #94a3b8;
}

.empty-icon {
  font-size: 38px;
  margin-bottom: 12px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 14px;
}

.error-banner {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 10px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 14px;
  transition: border-color 0.2s;
}

.task-card:hover {
  border-color: rgba(255, 255, 255, 0.16);
}

.task-card.completed {
  background: rgba(16, 185, 129, 0.03);
  border-color: rgba(16, 185, 129, 0.15);
}

.task-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.task-name {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
}

.status-badge.primary {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-badge.warning {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-badge.success {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.status-badge.neutral {
  background: rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}

.status-badge.danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.progress-bar-wrapper {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.progress-bar-fill.active {
  background: linear-gradient(90deg, #10b981 0%, #06b6d4 100%);
}

.task-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 12px;
}

.metric-col {
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 10px;
  color: #64748b;
  margin-bottom: 2px;
}

.metric-val {
  font-size: 11px;
  color: #cbd5e1;
}

.task-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.seeds-info {
  font-size: 11px;
  color: #64748b;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.card-btn {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.15s;
}

.card-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.card-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.drawer-footer {
  padding: 14px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
}

.footer-link-btn {
  display: block;
  text-align: center;
  padding: 9px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.2s;
}

.footer-link-btn:hover {
  background: rgba(16, 185, 129, 0.22);
}

/* 抽屉进出动效 */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.25s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-fade-enter-active .tasks-drawer,
.drawer-fade-leave-active .tasks-drawer {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-fade-enter-from .tasks-drawer,
.drawer-fade-leave-to .tasks-drawer {
  transform: translateX(100%);
}
</style>
