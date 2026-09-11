<template>
  <div class="search-filter-bar" data-theme-part="filter-bar">
    <!-- 筛选栏头部状态与控制 -->
    <div class="filter-header">
      <div class="filter-title-wrap">
        <span class="filter-icon">⚙️</span>
        <span class="filter-title">多维片源筛选</span>
        <span class="filter-stats">
          已筛出 <strong>{{ filteredCount }}</strong> / {{ totalCount }} 条资源
        </span>
      </div>

      <div class="filter-actions">
        <!-- 排序方式快捷选择 -->
        <div class="sort-selector">
          <span class="sort-label">排序:</span>
          <select
            class="sort-select"
            :value="modelValue.sortBy"
            @change="updateSort(($event.target as HTMLSelectElement).value)">
            <option value="default">收录时间 (最新在前)</option>
            <option value="quality-desc">画质优先 (4K/原盘优先)</option>
            <option value="year-desc">年份最新 (新片优先)</option>
            <option value="year-asc">年份较早 (老片优先)</option>
          </select>
        </div>

        <!-- 高级筛选折叠展开切换 -->
        <button
          class="action-btn toggle-btn"
          :class="{ active: isExpanded }"
          @click="isExpanded = !isExpanded"
          type="button">
          <span>{{ isExpanded ? "收起筛选" : "高级筛选" }}</span>
          <svg
            class="chevron"
            :class="{ 'chevron--open': isExpanded }"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2">
            <path d="M6 9l6 6 6-6"></path>
          </svg>
        </button>

        <!-- 一键重置 -->
        <button
          v-if="hasActiveFilter"
          class="action-btn reset-btn"
          @click="handleReset"
          type="button"
          title="恢复全部筛选默认设置">
          重置
        </button>
      </div>
    </div>

    <!-- 筛选主区域 -->
    <div class="filter-rows">
      <!-- 维度 1：网盘类型 -->
      <div class="filter-row">
        <span class="row-label">网盘平台</span>
        <div class="row-options">
          <button
            :class="['filter-pill', { active: modelValue.platform === 'all' }]"
            @click="setFilter('platform', 'all')">
            全部 ({{ totalCount }})
          </button>
          <button
            v-for="p in platformList"
            :key="p.key"
            :class="['filter-pill', { active: modelValue.platform === p.key }]"
            @click="setFilter('platform', p.key)">
            <span>{{ p.name }}</span>
            <span class="pill-count">({{ p.count }})</span>
          </button>
        </div>
      </div>

      <!-- 维度 2：清晰度 -->
      <div class="filter-row">
        <span class="row-label">清晰度</span>
        <div class="row-options">
          <button
            :class="['filter-pill', { active: modelValue.resolution === 'all' }]"
            @click="setFilter('resolution', 'all')">
            全部
          </button>
          <button
            v-for="r in resolutions"
            :key="r.key"
            :class="['filter-pill', { active: modelValue.resolution === r.key }]"
            @click="setFilter('resolution', r.key)">
            {{ r.label }}
            <span v-if="resolutionCounts[r.key]" class="pill-count">
              ({{ resolutionCounts[r.key] }})
            </span>
          </button>
        </div>
      </div>

      <!-- 高级折叠面板：类型、年份、特色画质 -->
      <div v-show="isExpanded" class="advanced-filter-group">
        <!-- 维度 3：内容类型 -->
        <div class="filter-row">
          <span class="row-label">片源类型</span>
          <div class="row-options">
            <button
              :class="['filter-pill', { active: modelValue.mediaType === 'all' }]"
              @click="setFilter('mediaType', 'all')">
              全部
            </button>
            <button
              v-for="m in mediaTypes"
              :key="m.key"
              :class="['filter-pill', { active: modelValue.mediaType === m.key }]"
              @click="setFilter('mediaType', m.key)">
              {{ m.label }}
              <span v-if="typeCounts[m.key]" class="pill-count">
                ({{ typeCounts[m.key] }})
              </span>
            </button>
          </div>
        </div>

        <!-- 维度 4：发行年代 -->
        <div class="filter-row">
          <span class="row-label">发行年代</span>
          <div class="row-options">
            <button
              :class="['filter-pill', { active: modelValue.yearRange === 'all' }]"
              @click="setFilter('yearRange', 'all')">
              全部
            </button>
            <button
              v-for="y in yearRanges"
              :key="y.key"
              :class="['filter-pill', { active: modelValue.yearRange === y.key }]"
              @click="setFilter('yearRange', y.key)">
              {{ y.label }}
              <span v-if="yearCounts[y.key]" class="pill-count">
                ({{ yearCounts[y.key] }})
              </span>
            </button>
          </div>
        </div>

        <!-- 维度 5：特色画质 (REMUX / 杜比 / HDR) -->
        <div class="filter-row">
          <span class="row-label">特色规格</span>
          <div class="row-options">
            <button
              :class="['filter-pill', { active: modelValue.specialQuality === 'all' }]"
              @click="setFilter('specialQuality', 'all')">
              全部
            </button>
            <button
              v-for="q in specialQualities"
              :key="q"
              :class="['filter-pill', { active: modelValue.specialQuality === q }]"
              @click="setFilter('specialQuality', q)">
              {{ q }}
              <span v-if="specialQualityCounts[q]" class="pill-count">
                ({{ specialQualityCounts[q] }})
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { FilterState, ResolutionType, MediaType, YearRange, QualityTag, SortOption } from "~/composables/useResourceParser";
import { getDefaultFilterState, getDynamicYearRanges } from "~/composables/useResourceParser";

interface PlatformItem {
  key: string;
  name: string;
  count: number;
  icon?: string;
}

const props = defineProps<{
  modelValue: FilterState;
  totalCount: number;
  filteredCount: number;
  platformList: PlatformItem[];
  resolutionCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  yearCounts: Record<string, number>;
  specialQualityCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: FilterState): void;
  (e: "reset"): void;
}>();

// 是否展开高级筛选（默认展开，移动端自适应折叠）
const isExpanded = ref(true);

const resolutions = [
  { key: "4K" as ResolutionType, label: "4K / 2160P" },
  { key: "1080P" as ResolutionType, label: "1080P 高清" },
  { key: "720P" as ResolutionType, label: "720P 标清" },
];

const mediaTypes = [
  { key: "movie" as MediaType, label: "电影" },
  { key: "tv" as MediaType, label: "电视剧/剧集" },
  { key: "anime" as MediaType, label: "动漫/番剧" },
  { key: "doc" as MediaType, label: "纪录片" },
  { key: "show" as MediaType, label: "综艺" },
];

const yearRanges = getDynamicYearRanges();

const specialQualities: QualityTag[] = ["REMUX", "杜比视界", "HDR", "蓝光", "高帧率"];

const hasActiveFilter = computed(() => {
  const f = props.modelValue;
  return (
    f.platform !== "all" ||
    f.resolution !== "all" ||
    f.mediaType !== "all" ||
    f.yearRange !== "all" ||
    f.specialQuality !== "all" ||
    f.sortBy !== "default"
  );
});

function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
  const updated = { ...props.modelValue, [key]: value };
  emit("update:modelValue", updated);
}

function updateSort(sortBy: string) {
  setFilter("sortBy", sortBy as SortOption);
}

function handleReset() {
  emit("update:modelValue", getDefaultFilterState());
  emit("reset");
}
</script>

<style scoped>
.search-filter-bar {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeIn 0.35s ease-out;
}

/* 顶部控制栏 */
.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.filter-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-icon {
  font-size: 15px;
}

.filter-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.filter-stats {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-light);
}

.filter-stats strong {
  color: var(--primary);
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 排序下拉框 */
.sort-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.sort-select {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.sort-select:hover,
.sort-select:focus {
  border-color: var(--primary);
}

/* 按钮通用 */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
  border-color: var(--border-medium);
}

.reset-btn {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.reset-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
}

.chevron {
  transition: transform 0.2s ease;
}

.chevron--open {
  transform: rotate(180deg);
}

/* 筛选行 */
.filter-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.row-label {
  min-width: 64px;
  padding-top: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #6b7280);
  text-align: right;
  flex-shrink: 0;
}

.row-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  flex: 1;
}

/* 筛选标签胶囊 */
.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.filter-pill:hover {
  background: var(--bg-primary);
  border-color: var(--border-medium);
  transform: translateY(-1px);
}

.filter-pill.active {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(15, 118, 110, 0.28);
}

.pill-count {
  font-size: 11px;
  opacity: 0.8;
}

/* 高级折叠面板 */
.advanced-filter-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-light);
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .filter-row {
    flex-direction: column;
    gap: 6px;
  }
  .row-label {
    text-align: left;
    min-width: auto;
    padding-top: 0;
  }
  .filter-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .filter-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
