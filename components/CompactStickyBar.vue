<template>
  <Transition name="sticky-slide">
    <div v-show="active" class="compact-sticky-bar" data-theme-part="compact-sticky">
      <div class="sticky-container">
        <!-- 左侧：紧凑搜索胶囊 -->
        <div class="compact-search-box">
          <div class="search-mini-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <input
            :value="kw"
            class="compact-input"
            placeholder="搜索影视/网盘/磁力…"
            @input="$emit('update:kw', ($event.target as HTMLInputElement).value)"
            @keyup.enter="$emit('search')" />
          <button
            v-if="kw"
            type="button"
            class="compact-clear-btn"
            title="清空"
            @click="$emit('update:kw', ''); $emit('search')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            class="compact-submit-btn"
            title="执行搜索"
            @click="$emit('search')">
            搜全网
          </button>
        </div>

        <!-- 中间：平台筛选快捷胶囊 -->
        <div class="compact-platform-pills">
          <button
            type="button"
            class="sticky-pill"
            :class="{ active: currentPlatform === 'all' }"
            @click="$emit('update:platform', 'all')">
            全部 ({{ searchStateTotal }})
          </button>
          <button
            v-for="p in platformList"
            :key="p.key"
            type="button"
            class="sticky-pill"
            :class="{
              active: currentPlatform === p.key,
              'pill-magnet': p.key === 'magnet'
            }"
            @click="$emit('update:platform', p.key)">
            <span>{{ p.name }}</span>
            <span class="sticky-pill-count">({{ p.count }})</span>
          </button>
        </div>

        <!-- 右侧：状态与快捷定位 -->
        <div class="compact-right-meta">
          <span class="filtered-badge">
            已筛出 <strong>{{ totalFilteredCount }}</strong> 条
          </span>
          <button
            type="button"
            class="anchor-scroll-btn"
            title="定位到结果区顶部"
            @click="$emit('scrollToAnchor')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
            <span>回顶部</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  active: boolean;
  kw: string;
  loading: boolean;
  searched: boolean;
  totalFilteredCount: number;
  searchStateTotal: number;
  platformList: Array<{ key: string; name: string; count: number }>;
  currentPlatform: string;
}>();

defineEmits<{
  (e: "update:kw", val: string): void;
  (e: "update:platform", val: string): void;
  (e: "search"): void;
  (e: "scrollToAnchor"): void;
}>();
</script>

<style scoped>
.compact-sticky-bar {
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  z-index: 45;
  background: var(--bg-glass-strong, rgba(13, 17, 23, 0.94));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-glass, rgba(255, 255, 255, 0.12));
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
  padding: 8px 0;
}

.sticky-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* 紧凑搜索框 */
.compact-search-box {
  display: flex;
  align-items: center;
  background: var(--bg-surface-elevated, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.18));
  border-radius: 9999px;
  padding: 2px 4px 2px 12px;
  height: 38px;
  min-width: 260px;
  max-width: 320px;
  transition: all 0.2s ease;
}

.compact-search-box:focus-within {
  border-color: var(--primary, #10b981);
  box-shadow: 0 0 0 2px var(--primary-glow, rgba(16, 185, 129, 0.2));
  background: var(--bg-primary, #0d1117);
}

.search-mini-icon {
  color: var(--text-tertiary, #94a3b8);
  display: flex;
  align-items: center;
  margin-right: 8px;
}

.compact-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary, #ffffff);
  font-size: 13px;
  outline: none;
  min-width: 0;
}

.compact-clear-btn {
  background: transparent;
  border: none;
  color: var(--text-tertiary, #94a3b8);
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 50%;
}

.compact-clear-btn:hover {
  color: var(--text-primary, #ffffff);
}

.compact-submit-btn {
  padding: 4px 12px;
  border-radius: 9999px;
  background: var(--primary, #10b981);
  color: #ffffff;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.compact-submit-btn:hover {
  opacity: 0.9;
}

/* 平台标签胶囊滚动条 */
.compact-platform-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  flex: 1;
  padding: 2px 0;
  scrollbar-width: none;
}

.compact-platform-pills::-webkit-scrollbar {
  display: none;
}

.sticky-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  background: var(--bg-surface, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.1));
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
  transition: all 0.18s ease;
}

.sticky-pill:hover {
  color: var(--text-primary, #ffffff);
  background: var(--bg-surface-elevated, rgba(255, 255, 255, 0.1));
}

.sticky-pill.active {
  color: #ffffff;
  background: var(--primary, #10b981);
  border-color: var(--primary, #10b981);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.sticky-pill.pill-magnet.active {
  background: #10b981;
}

.sticky-pill-count {
  font-size: 11px;
  opacity: 0.85;
}

/* 右侧元数据 */
.compact-right-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.filtered-badge {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  background: var(--bg-surface, rgba(255, 255, 255, 0.06));
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.08));
}

.filtered-badge strong {
  color: var(--primary, #10b981);
}

.anchor-scroll-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 8px;
  background: var(--bg-btn, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.15));
  color: var(--text-primary, #ffffff);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.anchor-scroll-btn:hover {
  background: var(--bg-btn-hover, rgba(255, 255, 255, 0.12));
  border-color: var(--primary, #10b981);
  color: var(--primary, #10b981);
}

/* 动效 */
.sticky-slide-enter-active,
.sticky-slide-leave-active {
  transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.sticky-slide-enter-from,
.sticky-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (max-width: 900px) {
  .compact-search-box {
    min-width: 180px;
    max-width: 220px;
  }
  .filtered-badge {
    display: none;
  }
  .sticky-container {
    padding: 0 14px;
    gap: 10px;
  }
}
</style>
