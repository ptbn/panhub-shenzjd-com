<template>
  <Transition name="fab-fade">
    <button
      v-show="visible"
      type="button"
      class="back-to-top-fab"
      aria-label="回到顶部"
      title="回到顶部"
      @click="scrollToTop">
      <div class="fab-glow-ring" aria-hidden="true" />
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="fab-icon">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const visible = ref(false);
let scrollTarget: HTMLElement | Window | null = null;

function checkScroll() {
  const scrollTop =
    (scrollTarget instanceof HTMLElement ? scrollTarget.scrollTop : 0) ||
    window.scrollY ||
    document.documentElement.scrollTop ||
    0;
  visible.value = scrollTop > 280;
}

function scrollToTop() {
  if (scrollTarget instanceof HTMLElement && scrollTarget.scrollTop > 0) {
    scrollTarget.scrollTo({ top: 0, behavior: "smooth" });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(() => {
  // app.vue 中主滚动容器为 .layout
  const layout = document.querySelector(".layout") as HTMLElement | null;
  scrollTarget = layout || window;

  if (scrollTarget instanceof HTMLElement) {
    scrollTarget.addEventListener("scroll", checkScroll, { passive: true });
  }
  window.addEventListener("scroll", checkScroll, { passive: true });
  checkScroll();
});

onUnmounted(() => {
  if (scrollTarget instanceof HTMLElement) {
    scrollTarget.removeEventListener("scroll", checkScroll);
  }
  window.removeEventListener("scroll", checkScroll);
});
</script>

<style scoped>
.back-to-top-fab {
  position: fixed;
  right: 28px;
  bottom: 32px;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.15));
  background: var(--bg-glass-strong, rgba(13, 17, 23, 0.88));
  color: var(--text-primary, #ffffff);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 99;
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.22s ease, border-color 0.22s ease, background-color 0.22s ease;
  user-select: none;
  touch-action: manipulation;
}

.back-to-top-fab:hover {
  transform: translateY(-4px) scale(1.06);
  border-color: var(--primary, #10b981);
  box-shadow: 0 10px 28px rgba(16, 185, 129, 0.3), 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.back-to-top-fab:active {
  transform: translateY(-1px) scale(0.96);
}

.fab-glow-ring {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--primary-glow, rgba(16, 185, 129, 0.25)) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.back-to-top-fab:hover .fab-glow-ring {
  opacity: 1;
}

.fab-icon {
  transition: transform 0.2s ease;
}

.back-to-top-fab:hover .fab-icon {
  transform: translateY(-2px);
}

/* 动效过渡 */
.fab-fade-enter-active,
.fab-fade-leave-active {
  transition: opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.fab-fade-enter-from,
.fab-fade-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.85);
}

@media (max-width: 768px) {
  .back-to-top-fab {
    right: 18px;
    bottom: calc(84px + env(safe-area-inset-bottom, 0px));
    width: 42px;
    height: 42px;
  }
}
</style>
