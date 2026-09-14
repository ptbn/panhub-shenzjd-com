<template>
  <Transition name="island-spring">
    <aside
      v-show="active"
      class="compact-floating-island"
      :class="{ 'is-expanded': isSearchExpanded || !platformList || platformList.length === 0 }"
      role="toolbar"
      aria-label="快捷筛选与检索灵动胶囊"
      data-theme-part="compact-island">
      <div class="island-body">
        <!-- 平台横向筛选胶囊组（仅在已获搜索结果且未主动展开搜索时展示） -->
        <Transition name="fade-morph" mode="out-in">
          <div v-if="!isSearchExpanded && platformList && platformList.length > 0" key="pills-mode" class="island-pills-bar">
            <!-- 平台胶囊容器 -->
            <div class="pills-scroller" ref="scrollerRef">
              <button
                type="button"
                class="island-pill"
                :class="{ active: currentPlatform === 'all' }"
                @click="$emit('update:platform', 'all'); $emit('scrollToAnchor')">
                <span class="pill-title">全部</span>
                <span class="pill-badge">{{ searchStateTotal }}</span>
              </button>
              <button
                v-for="p in platformList"
                :key="p.key"
                type="button"
                class="island-pill"
                :class="{
                  active: currentPlatform === p.key,
                  'pill-magnet': p.key === 'magnet'
                }"
                @click="$emit('update:platform', p.key); $emit('scrollToAnchor')">
                <span class="pill-title">{{ p.name }}</span>
                <span class="pill-badge">{{ p.count }}</span>
              </button>
            </div>

            <!-- 分割微线 -->
            <div class="island-divider" aria-hidden="true" />

            <!-- 展开搜索微按钮 -->
            <button
              type="button"
              class="island-action-btn search-trigger-btn"
              title="展开搜索"
              aria-label="展开搜索框"
              @click="openSearch">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span v-if="kw" class="trigger-kw-preview">{{ kw }}</span>
            </button>
          </div>

          <!-- 搜索输入模式：平滑形变出的输入舱（主动展开或初始未搜索状态） -->
          <div v-else key="search-mode" class="island-search-bar">
            <div class="search-input-wrap">
              <div class="input-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <input
                ref="inputRef"
                :value="kw"
                class="island-input"
                placeholder="搜索影视 / 网盘 / 磁力…"
                @input="$emit('update:kw', ($event.target as HTMLInputElement).value)"
                @keyup.enter="handleEnterSearch"
                @keyup.esc="closeSearch" />
              <button
                v-if="kw"
                type="button"
                class="input-clear-btn"
                title="清空搜索词"
                @click="$emit('update:kw', ''); focusInput()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <!-- 执行搜索按钮 -->
            <button
              type="button"
              class="island-submit-btn"
              title="搜索"
              @click="handleEnterSearch">
              搜索
            </button>

            <!-- 收起折叠按钮 (仅在有平台胶囊时才提供折叠收起) -->
            <button
              v-if="platformList && platformList.length > 0"
              type="button"
              class="island-collapse-btn"
              title="收起搜索框"
              aria-label="收起搜索框"
              @click="closeSearch">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </Transition>
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { ref, nextTick } from "vue";

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

const emit = defineEmits<{
  (e: "update:kw", val: string): void;
  (e: "update:platform", val: string): void;
  (e: "search"): void;
  (e: "scrollToAnchor"): void;
}>();

const isSearchExpanded = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const scrollerRef = ref<HTMLElement | null>(null);

function openSearch() {
  isSearchExpanded.value = true;
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function closeSearch() {
  isSearchExpanded.value = false;
}

function focusInput() {
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function handleEnterSearch() {
  emit("search");
  isSearchExpanded.value = false;
}
</script>

<style scoped>
/* 居中灵动悬浮胶囊岛主容器 (Apple/Linear Glassmorphism) */
.compact-floating-island {
  position: fixed;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 55;
  width: min(740px, calc(100% - 48px));
  background: var(--bg-glass-strong, rgba(13, 17, 23, 0.88));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.14));
  border-radius: 9999px;
  box-shadow: 0 10px 32px -4px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 0 20px -2px rgba(16, 185, 129, 0.08);
  padding: 5px 8px;
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.25s ease,
    box-shadow 0.25s ease,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.compact-floating-island:hover {
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 14px 40px -4px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 24px rgba(16, 185, 129, 0.16);
}

.island-body {
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
}

/* 平台标签筛选态 */
.island-pills-bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pills-scroller {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 1px 0;
  -webkit-overflow-scrolling: touch;
}

.pills-scroller::-webkit-scrollbar {
  display: none;
}

.island-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  background: var(--bg-surface, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.09));
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.island-pill:hover {
  color: var(--text-primary, #ffffff);
  background: var(--bg-surface-elevated, rgba(255, 255, 255, 0.12));
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.island-pill.active {
  color: #ffffff;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: #10b981;
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35);
}

.island-pill.pill-magnet.active {
  background: linear-gradient(135deg, #10b981 0%, #047857 100%);
}

.pill-title {
  line-height: 1;
}

.pill-badge {
  font-size: 10px;
  opacity: 0.85;
  background: rgba(0, 0, 0, 0.2);
  padding: 1px 5px;
  border-radius: 9999px;
}

/* 分割线 */
.island-divider {
  width: 1px;
  height: 20px;
  background: var(--border-glass, rgba(255, 255, 255, 0.12));
  flex-shrink: 0;
}

/* 搜索展开触发按钮 */
.island-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 9999px;
  background: var(--bg-surface, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.12));
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.island-action-btn:hover {
  color: var(--primary, #10b981);
  border-color: var(--primary, #10b981);
  background: rgba(16, 185, 129, 0.12);
  transform: translateY(-1px);
}

.trigger-kw-preview {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--text-primary, #ffffff);
}

/* 搜索模式：展开输入舱 */
.island-search-bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: barSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg-surface-elevated, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.18));
  border-radius: 9999px;
  padding: 2px 8px 2px 12px;
  height: 34px;
  transition: all 0.2s ease;
}

.search-input-wrap:focus-within {
  border-color: var(--primary, #10b981);
  background: rgba(0, 0, 0, 0.4);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
}

.input-icon {
  color: var(--text-tertiary, #94a3b8);
  display: flex;
  align-items: center;
  margin-right: 6px;
}

.island-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary, #ffffff);
  font-size: 13px;
  outline: none;
  min-width: 0;
}

.input-clear-btn {
  background: transparent;
  border: none;
  color: var(--text-tertiary, #94a3b8);
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 50%;
}

.input-clear-btn:hover {
  color: var(--text-primary, #ffffff);
}

.island-submit-btn {
  padding: 5px 14px;
  border-radius: 9999px;
  background: var(--primary, #10b981);
  color: #ffffff;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s ease, transform 0.15s ease;
}

.island-submit-btn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.island-collapse-btn {
  background: transparent;
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.12));
  color: var(--text-tertiary, #94a3b8);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.island-collapse-btn:hover {
  color: var(--text-primary, #ffffff);
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
}

/* 动效 */
.island-spring-enter-active,
.island-spring-leave-active {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease;
}

.island-spring-enter-from,
.island-spring-leave-to {
  transform: translate(-50%, -18px) scale(0.96);
  opacity: 0;
}

.fade-morph-enter-active,
.fade-morph-leave-active {
  transition: opacity 0.16s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-morph-enter-from {
  opacity: 0;
  transform: scale(0.97);
}

.fade-morph-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

@keyframes barSlideIn {
  from {
    opacity: 0;
    transform: translateX(8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 移动端与窄屏适配：智能下沉至底部，单手顺手触达，绝不遮挡上方视野 */
@media (max-width: 768px) {
  .compact-floating-island {
    top: auto;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    width: calc(100% - 32px);
    max-width: 480px;
    padding: 4px 6px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  .island-spring-enter-from,
  .island-spring-leave-to {
    transform: translate(-50%, 24px) scale(0.95);
    opacity: 0;
  }
}
</style>
