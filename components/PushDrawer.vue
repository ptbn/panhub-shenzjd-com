<template>
  <div v-if="visible" class="drawer-backdrop" @click.self="$emit('close')">
    <div class="drawer-panel">
      <!-- 头部 -->
      <div class="drawer-header">
        <div class="header-left">
          <div class="nas-icon-badge">
            <svg v-if="isCloud" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <div>
            <h2 class="drawer-title">{{ isCloud ? '转存至网盘 · 芝杜秒播' : '推送到 NAS 离线下载' }}</h2>
            <p class="drawer-subtitle">{{ isCloud ? '云端免下载 · AList 302 聚合 · 芝杜 Z9X 海报墙直映' : '智能分类 · 目录自动分流 · 联动绿联云影院' }}</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- 反馈消息 -->
      <div v-if="feedback" :class="['feedback-card', feedback.success ? 'feedback-ok' : 'feedback-err']">
        <div class="feedback-title">{{ feedback.success ? '🎉 操作成功！' : '❌ 提示' }}</div>
        <div class="feedback-msg">{{ feedback.message }}</div>
      </div>

      <!-- 内容区 -->
      <div class="drawer-body">
        <!-- 资源卡片预览 -->
        <div class="resource-preview">
          <div class="res-title">{{ item?.note || item?.url }}</div>
          <div class="res-meta">
            <span class="meta-pill font-mono">{{ isCloud ? '网盘分享资源' : 'BT磁力/种子直链' }}</span>
            <span v-if="item?.password" class="meta-pill highlight">提取码: {{ item.password }}</span>
            <span v-if="inferredMediaType" class="meta-pill">{{ inferredMediaType }}</span>
          </div>
        </div>

        <!-- 玩法一：网盘类极速转存与芝杜联动面板 -->
        <div v-if="isCloud" class="z9x-card">
          <div class="z9x-header">
            <span class="z9x-badge">📺 芝杜 Z9X 播放流</span>
            <span class="z9x-tag">4K 原画免下载</span>
          </div>
          <div class="z9x-steps">
            <div class="step-item">
              <span class="step-num">1</span>
              <div class="step-text">点击下方<b>「一键转存」</b>，自动复制提取码并直达网盘保存影片；</div>
            </div>
            <div class="step-item">
              <span class="step-num">2</span>
              <div class="step-text">保存后，片源立即通过 AList 呈现在芝杜 Z9X 海报墙中；</div>
            </div>
            <div class="step-item">
              <span class="step-num">3</span>
              <div class="step-text">芝杜以 302 原画直链输出杜比视界，<b>零占用 NAS 硬盘与性能</b>。</div>
            </div>
          </div>

          <div class="quick-links">
            <a href="https://alist.taogehome.cloud" target="_blank" class="alist-link">
              <span>在 AList 媒体库中查看</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          </div>
        </div>

        <!-- 磁力类资源：下载器调度面板 -->
        <template v-else>
          <!-- 智能分类预设 -->
          <div class="form-group">
            <label class="group-label">影视媒体分类 (智能识别)</label>
            <div class="category-chips">
              <button
                type="button"
                :class="['chip', { active: form.category === 'movie' }]"
                @click="setCategory('movie')">
                🎬 电影 (Movies)
              </button>
              <button
                type="button"
                :class="['chip', { active: form.category === 'tv' }]"
                @click="setCategory('tv')">
                📺 电视剧 (TV)
              </button>
              <button
                type="button"
                :class="['chip', { active: form.category === 'anime' }]"
                @click="setCategory('anime')">
                🌸 动漫 (Anime)
              </button>
              <button
                type="button"
                :class="['chip', { active: form.category === 'other' }]"
                @click="setCategory('other')">
                📁 其他文件
              </button>
            </div>
          </div>

          <!-- 下载器选择 -->
          <div class="form-group">
            <label class="group-label">调度下载器驱动</label>
            <div class="engine-selector">
              <label class="engine-option">
                <input v-model="form.preferredClient" type="radio" value="aria2" />
                <span>Aria2 下载</span>
              </label>
              <label class="engine-option">
                <input v-model="form.preferredClient" type="radio" value="qbittorrent" />
                <span>qBittorrent (推荐)</span>
              </label>
            </div>
          </div>

          <!-- 目标落盘目录 -->
          <div class="form-group">
            <div class="flex-between">
              <label class="group-label">目标存储目录 (NAS 影视盘)</label>
              <button type="button" class="reset-link" @click="resetDefaultPath">恢复默认</button>
            </div>
            <input
              v-model="form.targetDir"
              type="text"
              class="input-box"
              placeholder="/Media/Movies" />
            <p class="hint-text">
              💡 适配绿联 DX4600：下载至对应目录后，绿联云影院将自动触发文件监控并自动生成海报墙。
            </p>
          </div>
        </template>
      </div>

      <!-- 底部操作栏 -->
      <div class="drawer-footer">
        <button class="cancel-btn" @click="$emit('close')">关闭</button>
        <button v-if="isCloud" class="push-btn primary-glow" @click="executeCloudTransfer">
          <span>🚀 复制提取码并前往网盘转存</span>
        </button>
        <button v-else class="push-btn" :disabled="pushing" @click="executePush">
          <span v-if="pushing" class="spinner"></span>
          <span>{{ pushing ? '正在向 NAS 下发指令...' : '📥 立即推送到 NAS' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { parseResourceMeta } from "~/composables/useResourceParser";

const props = defineProps<{
  visible: boolean;
  item: any;
}>();
const emit = defineEmits(["close", "success"]);

const pushing = ref(false);
const feedback = ref<{ success: boolean; message: string } | null>(null);

const form = reactive({
  category: "movie" as "movie" | "tv" | "anime" | "other",
  preferredClient: "auto" as "auto" | "alist" | "aria2" | "qbittorrent",
  targetDir: "/Media/Movies",
});

const isCloud = computed(() => {
  const url = props.item?.url || "";
  return /quark\.cn|aliyundrive\.com|alipan\.com|pan\.baidu\.com|123pan\.com|115\.com|pan\.xunlei\.com|drive\.uc\.cn/i.test(
    url
  );
});

const inferredMediaType = computed(() => {
  if (!props.item) return "";
  const meta = parseResourceMeta(props.item.note || props.item.url || "");
  if (meta.mediaType === "tv") return "识别为剧集";
  if (meta.mediaType === "anime") return "识别为动漫";
  if (meta.mediaType === "movie") return "识别为电影";
  return "";
});

watch(
  () => props.item,
  (newItem) => {
    if (!newItem) return;
    feedback.value = null;
    const text = `${newItem.note || ""} ${newItem.url || ""}`;
    const meta = parseResourceMeta(text);

    if (meta.mediaType === "tv" || /第[0-9一二三四五六七八九十]+季|[sS][0-9]{1,2}|集全|连载/i.test(text)) {
      form.category = "tv";
      form.targetDir = isCloud.value ? "/我的网盘/电视剧" : "/Media/TV";
    } else if (meta.mediaType === "anime" || /番剧|新番|动漫|动画/i.test(text)) {
      form.category = "anime";
      form.targetDir = isCloud.value ? "/我的网盘/动漫" : "/Media/Anime";
    } else {
      form.category = "movie";
      form.targetDir = isCloud.value ? "/我的网盘/电影" : "/Media/Movies";
    }
  },
  { immediate: true }
);

function setCategory(cat: "movie" | "tv" | "anime" | "other") {
  form.category = cat;
  if (cat === "movie") {
    form.targetDir = isCloud.value ? "/我的网盘/电影" : "/Media/Movies";
  } else if (cat === "tv") {
    form.targetDir = isCloud.value ? "/我的网盘/电视剧" : "/Media/TV";
  } else if (cat === "anime") {
    form.targetDir = isCloud.value ? "/我的网盘/动漫" : "/Media/Anime";
  } else {
    form.targetDir = isCloud.value ? "/我的网盘/其他" : "/Media/Downloads";
  }
}

function resetDefaultPath() {
  setCategory(form.category);
}

async function executeCloudTransfer() {
  if (!props.item?.url) return;
  feedback.value = null;

  // 1. 复制提取码到剪贴板
  if (props.item.password) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(props.item.password);
      } else {
        const ta = document.createElement("textarea");
        ta.value = props.item.password;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch (e) {
      console.warn("Clipboard copy failed", e);
    }
  }

  // 2. 在新标签页唤起网盘分享页
  window.open(props.item.url, "_blank", "noopener,noreferrer");

  // 3. 给出清晰的芝杜联动反馈
  feedback.value = {
    success: true,
    message: props.item.password
      ? `提取码 [${props.item.password}] 已自动复制！网盘页面已打开。存入网盘后，芝杜 Z9X 海报墙即可免下载 4K 秒播！`
      : "网盘分享页面已打开。存入网盘后，芝杜 Z9X 播放器即可免下载 4K 秒播！",
  };
}

async function executePush() {
  if (!props.item) return;
  pushing.value = true;
  feedback.value = null;

  try {
    const res = await $fetch<{ success: boolean; message: string; targetPath: string; protocol: string }>(
      "/api/nas/push",
      {
        method: "POST",
        body: {
          title: props.item.note || props.item.url,
          url: props.item.url,
          password: props.item.password,
          category: form.category,
          targetDir: form.targetDir,
          preferredClient: form.preferredClient,
        },
      }
    );

    feedback.value = {
      success: true,
      message: `${res.message} (落盘目录: ${res.targetPath})`,
    };

    setTimeout(() => {
      emit("success");
      emit("close");
    }, 2000);
  } catch (err: any) {
    feedback.value = {
      success: false,
      message: err.data?.message || err.message || "推送失败，请检查 NAS 配置与连通性",
    };
  } finally {
    pushing.value = false;
  }
}
</script>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 100%;
  max-width: 480px;
  height: 100%;
  background: #18181b;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
  animation: slideLeft 0.25s ease-out;
}

@keyframes slideLeft {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nas-icon-badge {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.drawer-title {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 3px;
}

.drawer-subtitle {
  font-size: 11px;
  color: #9ca3af;
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
}

.feedback-card {
  margin: 16px 20px 0;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 13px;
}

.feedback-ok {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
}

.feedback-err {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.feedback-title {
  font-weight: 600;
  margin-bottom: 3px;
}

.drawer-body {
  padding: 20px 22px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.resource-preview {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px;
}

.res-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  line-height: 1.4;
  margin-bottom: 10px;
  word-break: break-all;
}

.res-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #d1d5db;
}

.meta-pill.highlight {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  font-weight: 500;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-label {
  font-size: 13px;
  font-weight: 600;
  color: #e5e7eb;
}

.reset-link {
  background: transparent;
  border: none;
  color: #10b981;
  font-size: 12px;
  cursor: pointer;
}

.category-chips {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.chip {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.chip.active {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
  color: #34d399;
  font-weight: 600;
}

.engine-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
}

.engine-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #d1d5db;
  cursor: pointer;
}

.input-box {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-family: monospace;
  outline: none;
}

.input-box:focus {
  border-color: #10b981;
}

.hint-text {
  font-size: 11px;
  color: #9ca3af;
  margin: 2px 0 0;
  line-height: 1.4;
}

.drawer-footer {
  padding: 16px 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  padding: 10px 16px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.push-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  color: #fff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.push-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.primary-glow {
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
}

.z9x-card {
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.z9x-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.z9x-badge {
  font-size: 13px;
  font-weight: 700;
  color: #34d399;
}

.z9x-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
  font-weight: 500;
}

.z9x-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.step-num {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.25);
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

.step-text {
  font-size: 12px;
  color: #d1d5db;
  line-height: 1.5;
}

.step-text b {
  color: #34d399;
}

.quick-links {
  margin-top: 4px;
  display: flex;
  justify-content: flex-end;
}

.alist-link {
  font-size: 12px;
  color: #9ca3af;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color 0.2s;
}

.alist-link:hover {
  color: #34d399;
}
</style>
