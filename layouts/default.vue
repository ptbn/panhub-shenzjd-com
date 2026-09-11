<template>
  <!-- 原生专属顶部导航栏（去作者化、纯净极简） -->
  <header class="native-navbar">
    <div class="navbar-container">
      <NuxtLink to="/" class="navbar-brand">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <span class="brand-name">PanHub 聚合搜索</span>
      </NuxtLink>

      <div class="navbar-actions">
        <!-- 尺寸合适的专属原生头像（36px 现代渐变质感 + 在线小绿点） -->
        <div class="user-avatar" title="个人主页">
          <div class="avatar-inner">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <span class="status-indicator"></span>
        </div>
      </div>
    </div>
  </header>

  <!-- 主内容区 -->
  <main class="main">
    <slot />
  </main>

  <!-- 页脚 -->
  <footer class="site-footer">
    <NuxtLink to="/privacy" class="footer-link">隐私政策</NuxtLink>
    <span class="footer-sep">·</span>
    <span class="footer-copy">© {{ new Date().getFullYear() }} PanHub</span>
  </footer>
</template>

<script setup lang="ts">
const { loadSettings } = useSettings();

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
/* 原生顶部导航栏 */
.native-navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  width: 100%;
  height: 58px;
  background: var(--bg-glass, rgba(255, 253, 248, 0.88));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border-light, #e5dfd0);
  transition: background-color 0.2s, border-color 0.2s;
}

.navbar-container {
  max-width: 1200px;
  height: 100%;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text-primary, #1f2937);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.01em;
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--primary, #0f766e) 0%, #0d9488 100%);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(15, 118, 110, 0.2);
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

/* 尺寸适中的原生头像：36px 经典尺寸，自然圆润 */
.user-avatar {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.user-avatar:hover {
  transform: scale(1.05);
}

.avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #0f766e 0%, #14b8a6 50%, #38bdf8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(15, 118, 110, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.9);
}

.status-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 9px;
  height: 9px;
  background-color: #10b981;
  border: 2px solid var(--bg-primary, #ffffff);
  border-radius: 50%;
}

/* 主容器与页脚 */
.main {
  min-height: calc(100vh - 120px);
}

.site-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 16px 28px;
  font-size: 13px;
  color: var(--text-tertiary, #9ca3af);
}

.footer-link {
  color: var(--text-secondary, #6b7280);
  text-decoration: none;
}

.footer-sep {
  opacity: 0.5;
}
</style>
