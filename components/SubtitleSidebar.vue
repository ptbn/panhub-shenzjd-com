<template>
  <div class="subtitle-sidebar" data-theme-part="subtitle-sidebar">
    <!-- 侧边栏头部 -->
    <div class="sidebar-header">
      <div class="header-left">
        <span class="header-icon" aria-hidden="true">💬</span>
        <div class="title-group">
          <h3 class="header-title">SubHD 字幕</h3>
          <span v-if="subtitles.length > 0" class="sub-count-badge">
            {{ subtitles.length }} 条
          </span>
        </div>
      </div>
      <a
        v-if="subhdUrl"
        :href="subhdUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="subhd-ext-link"
        title="在 SubHD 网站中打开查看">
        <span>在 SubHD 查看</span>
        <svg
          class="ext-icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    </div>

    <!-- 快捷分类筛选 (仅当有字幕时展示) -->
    <div v-if="subtitles.length > 0" class="sub-filter-row">
      <button
        type="button"
        :class="['filter-pill', { active: activeFilter === 'all' }]"
        @click="activeFilter = 'all'">
        全部 ({{ subtitles.length }})
      </button>
      <button
        v-if="bilingualCount > 0"
        type="button"
        :class="['filter-pill', { active: activeFilter === 'bilingual' }]"
        @click="activeFilter = 'bilingual'">
        双语 ({{ bilingualCount }})
      </button>
      <button
        v-if="assCount > 0"
        type="button"
        :class="['filter-pill', { active: activeFilter === 'ass' }]"
        @click="activeFilter = 'ass'">
        ASS/特效 ({{ assCount }})
      </button>
      <button
        v-if="officialCount > 0"
        type="button"
        :class="['filter-pill', { active: activeFilter === 'official' }]"
        @click="activeFilter = 'official'">
        官方/精选 ({{ officialCount }})
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="sidebar-content">
      <!-- 骨架屏加载状态 -->
      <div v-if="loading" class="sub-skeleton-list">
        <div v-for="i in 4" :key="`sub-skel-${i}`" class="sub-skeleton-card">
          <div class="skeleton-line line-title"></div>
          <div class="skeleton-line line-tags"></div>
        </div>
      </div>

      <!-- 字幕卡片列表 -->
      <div v-else-if="filteredSubtitles.length > 0" class="sub-card-list">
        <div
          v-for="sub in filteredSubtitles"
          :key="sub.id"
          class="sub-card">
          <div class="sub-card-main">
            <!-- 字幕标题 / 压制版本名 -->
            <a
              :href="sub.url"
              target="_blank"
              rel="noopener noreferrer"
              class="sub-title-link"
              :title="sub.title">
              {{ sub.title }}
            </a>

            <!-- 字幕组徽章 -->
            <div v-if="sub.group" class="sub-group-wrap">
              <span class="group-badge">
                <span class="group-dot"></span>
                {{ sub.group }}
              </span>
            </div>

            <!-- 属性标签栏 -->
            <div class="sub-tags-row">
              <!-- 语言标签 -->
              <span
                v-for="lang in sub.languages"
                :key="lang"
                class="tag tag-lang">
                {{ lang }}
              </span>

              <!-- 格式标签 -->
              <span
                v-for="fmt in sub.formats"
                :key="fmt"
                class="tag tag-fmt">
                {{ fmt }}
              </span>

              <!-- 推荐与质量标签 -->
              <span
                v-for="tag in sub.tags"
                :key="tag"
                class="tag tag-special">
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- 卡片底部动作栏 -->
          <div class="sub-card-footer">
            <span v-if="sub.downloads" class="download-count">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>{{ sub.downloads }} 次下载</span>
            </span>
            <span v-else></span>

            <a
              :href="sub.url"
              target="_blank"
              rel="noopener noreferrer"
              class="download-btn">
              <span>直达下载</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </a>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="sub-empty-state">
        <div class="empty-icon">📭</div>
        <p class="empty-text">
          {{ activeFilter !== 'all' ? '未找到符合当前分类的字幕' : '未自动匹配到 SubHD 对应字幕' }}
        </p>
        <a
          v-if="subhdUrl"
          :href="subhdUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="subhd-search-btn">
          前往 SubHD 手动搜索 ↗
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import type { SubItem, SubhdResult } from "~/server/core/services/subhdService";

interface Props {
  keyword?: string;
  doubanId?: string;
  isSearching?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  keyword: "",
  doubanId: "",
  isSearching: false,
});

const loading = ref(false);
const subtitles = ref<SubItem[]>([]);
const subhdUrl = ref("https://subhd.cc");
const activeFilter = ref("all");
let requestSeq = 0;

// 统计各类标签数量
const bilingualCount = computed(() => {
  return subtitles.value.filter((s) =>
    s.languages.some((l) => l.includes("双语") || l.includes("中英"))
  ).length;
});

const assCount = computed(() => {
  return subtitles.value.filter(
    (s) => s.formats.includes("ASS") || s.tags.includes("特效")
  ).length;
});

const officialCount = computed(() => {
  return subtitles.value.filter(
    (s) => s.tags.includes("官方字幕") || s.tags.includes("精选推荐")
  ).length;
});

// 筛选后展示的字幕列表
const filteredSubtitles = computed(() => {
  if (activeFilter.value === "bilingual") {
    return subtitles.value.filter((s) =>
      s.languages.some((l) => l.includes("双语") || l.includes("中英"))
    );
  }
  if (activeFilter.value === "ass") {
    return subtitles.value.filter(
      (s) => s.formats.includes("ASS") || s.tags.includes("特效")
    );
  }
  if (activeFilter.value === "official") {
    return subtitles.value.filter(
      (s) => s.tags.includes("官方字幕") || s.tags.includes("精选推荐")
    );
  }
  return subtitles.value;
});

async function loadSubtitles() {
  const kw = (props.keyword || "").trim();
  const dId = (props.doubanId || "").trim();

  if (!kw && !dId) {
    subtitles.value = [];
    subhdUrl.value = "https://subhd.cc";
    loading.value = false;
    return;
  }

  const seq = ++requestSeq;
  loading.value = true;
  activeFilter.value = "all";

  try {
    const params = new URLSearchParams();
    if (dId) params.set("doubanId", dId);
    if (kw) params.set("keyword", kw);

    const res = await $fetch<{ code: number; data?: SubhdResult }>(
      `/api/subtitles?${params.toString()}`
    );

    if (seq !== requestSeq) return; // 规避过时响应

    if (res && res.code === 0 && res.data) {
      subtitles.value = res.data.items || [];
      subhdUrl.value = res.data.subhdUrl || "https://subhd.cc";
    } else {
      subtitles.value = [];
      subhdUrl.value = dId
        ? `https://subhd.cc/d/${dId}`
        : `https://subhd.cc/search/${encodeURIComponent(kw)}`;
    }
  } catch (err) {
    console.warn("[SubtitleSidebar] 加载字幕失败:", err);
    if (seq === requestSeq) {
      subtitles.value = [];
    }
  } finally {
    if (seq === requestSeq) {
      loading.value = false;
    }
  }
}

watch(
  () => [props.keyword, props.doubanId],
  () => {
    loadSubtitles();
  },
  { immediate: true }
);

onMounted(() => {
  if (props.keyword || props.doubanId) {
    loadSubtitles();
  }
});
</script>

<style scoped>
.subtitle-sidebar {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}

.subtitle-sidebar:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-md);
}

/* 侧边栏头部 */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 18px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.sub-count-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.12);
  color: var(--primary);
}

.subhd-ext-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  text-decoration: none;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.subhd-ext-link:hover {
  color: var(--primary);
  background: var(--bg-secondary);
}

.ext-icon {
  stroke-width: 2.2;
}

/* 筛选药丸栏 */
.sub-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.filter-pill:hover {
  background: var(--bg-primary);
  border-color: var(--border-medium);
  color: var(--text-primary);
}

.filter-pill.active {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 6px rgba(15, 118, 110, 0.25);
}

/* 内容区域 */
.sidebar-content {
  display: flex;
  flex-direction: column;
}

/* 骨架屏 */
.sub-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sub-skeleton-card {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.05) 25%, rgba(0, 0, 0, 0.1) 50%, rgba(0, 0, 0, 0.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.line-title {
  height: 14px;
  width: 80%;
}

.line-tags {
  height: 12px;
  width: 50%;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 字幕卡片列表 */
.sub-card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 540px;
  overflow-y: auto;
  padding-right: 4px;
}

/* 自定义纤细滚动条 */
.sub-card-list::-webkit-scrollbar {
  width: 4px;
}

.sub-card-list::-webkit-scrollbar-thumb {
  background: var(--border-medium);
  border-radius: 4px;
}

.sub-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all var(--transition-fast);
}

.sub-card:hover {
  background: var(--bg-primary);
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.sub-card-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-title-link {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  text-decoration: none;
  line-height: 1.4;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color var(--transition-fast);
}

.sub-title-link:hover {
  color: var(--primary);
}

.sub-group-wrap {
  display: flex;
  align-items: center;
}

.group-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #0284c7;
  background: rgba(2, 132, 199, 0.1);
  padding: 2px 7px;
  border-radius: 4px;
}

.group-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #0284c7;
}

/* 标签栏 */
.sub-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.tag-lang {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.tag-fmt {
  background: rgba(139, 92, 246, 0.1);
  color: #7c3aed;
}

.tag-special {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

/* 卡片底部动作栏 */
.sub-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px dashed var(--border-light);
  font-size: 11px;
}

.download-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
}

.download-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 500;
  color: var(--primary);
  text-decoration: none;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(15, 118, 110, 0.08);
  transition: all var(--transition-fast);
}

.download-btn:hover {
  background: var(--primary);
  color: #fff;
}

/* 空状态 */
.sub-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  gap: 8px;
}

.empty-icon {
  font-size: 32px;
  opacity: 0.8;
}

.empty-text {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.subhd-search-btn {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--primary);
  text-decoration: none;
  padding: 6px 12px;
  background: rgba(15, 118, 110, 0.08);
  border-radius: var(--radius-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.subhd-search-btn:hover {
  background: var(--primary);
  color: #fff;
}
</style>
