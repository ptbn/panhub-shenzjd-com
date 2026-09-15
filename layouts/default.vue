<template>
  <div class="app-shell">
    <!-- 现代化流媒体毛玻璃顶栏 (Top App Bar) -->
    <header class="top-app-bar">
      <div class="app-bar-container">
        <!-- 品牌标识与 Logo -->
        <div class="brand-section">
          <NuxtLink to="/" class="brand-link" title="PanHub 首页">
            <div class="brand-badge-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <div class="brand-text">
              <span class="brand-title">PanHub</span>
              <span class="brand-tag">PRO</span>
            </div>
          </NuxtLink>
        </div>

        <!-- 桌面端核心导航项 (面向未来多功能扩展) -->
        <nav class="desktop-nav" aria-label="全局导航">
          <NuxtLink to="/" class="nav-item" :class="{ active: currentNav === 'home' }">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>综合搜索</span>
          </NuxtLink>

          <a href="#explore" class="nav-item" @click.prevent="scrollToSection('explore')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="17" x2="22" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
            <span>影视大厅</span>
            <span class="nav-pill-badge">豆瓣</span>
          </a>

          <a href="#subtitles" class="nav-item" @click.prevent="scrollToSection('subtitles')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>字幕中心</span>
            <span class="nav-pill-badge subhd">SubHD</span>
          </a>

          <a href="#magnet-section" class="nav-item" @click.prevent="scrollToSection('magnet-section')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 3v7a6 6 0 0 0 12 0V3" />
              <line x1="4" y1="3" x2="8" y2="3" />
              <line x1="16" y1="3" x2="20" y2="3" />
            </svg>
            <span>BT / 磁力</span>
          </a>
        </nav>

        <!-- 顶栏右侧交互操作区 -->
        <div class="action-section">
          <!-- 深色/浅色主题快捷切换 -->
          <button
            type="button"
            class="theme-toggle-btn"
            :title="isDark ? '切换至明亮模式' : '切换至暗夜模式'"
            @click="toggleTheme">
            <svg v-if="isDark" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>

          <!-- 用户与 NAS 管理操作区 -->
          <div v-if="user" class="user-nav-group">
            <button
              type="button"
              class="nav-pill-btn nas-btn"
              @click="nasModalVisible = true"
              title="配置我的 NAS (AList / Aria2 / 绿联云影院)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>我的 NAS</span>
            </button>

            <NuxtLink
              v-if="isAdmin"
              to="/admin"
              class="nav-pill-btn admin-btn"
              title="进入超级管理员控制台">
              <span>管理后台</span>
            </NuxtLink>

            <div class="user-dropdown-wrapper">
              <button
                type="button"
                class="avatar-capsule user-btn"
                @click="userMenuOpen = !userMenuOpen"
                :title="user.username">
                <div class="avatar-glow-dot"></div>
                <span class="user-name-text">{{ user.username }}</span>
              </button>

              <div v-if="userMenuOpen" class="user-dropdown-menu">
                <div class="dropdown-header">
                  <div class="font-medium text-white">{{ user.username }}</div>
                  <div class="text-xs text-gray-400">{{ user.email }}</div>
                  <div class="mt-1">
                    <span class="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      {{ user.role === 'admin' ? '超级管理员' : '普通用户' }}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  class="dropdown-item"
                  @click="nasModalVisible = true; userMenuOpen = false">
                  ⚙️ 我的 NAS 配置
                </button>
                <NuxtLink
                  v-if="isAdmin"
                  to="/admin"
                  class="dropdown-item"
                  @click="userMenuOpen = false">
                  🛡️ 超级管理员后台
                </NuxtLink>
                <button
                  type="button"
                  class="dropdown-item text-red-400"
                  @click="handleLogout">
                  🚪 退出登录
                </button>
              </div>
            </div>
          </div>
          <div v-else>
            <NuxtLink to="/auth/login" class="nav-pill-btn admin-btn">
              登录 / 注册
            </NuxtLink>
          </div>

          <!-- 移动端汉堡折叠按钮 -->
          <button
            type="button"
            class="mobile-menu-btn"
            :aria-expanded="mobileMenuOpen"
            @click="mobileMenuOpen = !mobileMenuOpen">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line v-if="!mobileMenuOpen" x1="3" y1="12" x2="21" y2="12" />
              <line v-if="!mobileMenuOpen" x1="3" y1="6" x2="21" y2="6" />
              <line v-if="!mobileMenuOpen" x1="3" y1="18" x2="21" y2="18" />
              <line v-if="mobileMenuOpen" x1="18" y1="6" x2="6" y2="18" />
              <line v-if="mobileMenuOpen" x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 移动端抽屉展开菜单 -->
      <Transition name="drawer">
        <div v-show="mobileMenuOpen" class="mobile-drawer">
          <NuxtLink to="/" class="drawer-nav-item" @click="mobileMenuOpen = false">
            <span>🔍 综合搜索</span>
          </NuxtLink>
          <a href="#explore" class="drawer-nav-item" @click.prevent="scrollToSection('explore')">
            <span>🎬 影视大厅 (豆瓣)</span>
          </a>
          <a href="#subtitles" class="drawer-nav-item" @click.prevent="scrollToSection('subtitles')">
            <span>💬 字幕中心 (SubHD)</span>
          </a>
          <a href="#magnet-section" class="drawer-nav-item" @click.prevent="scrollToSection('magnet-section')">
            <span>🧲 磁力/BT 资源</span>
          </a>
          <NuxtLink to="/privacy" class="drawer-nav-item secondary" @click="mobileMenuOpen = false">
            <span>📜 隐私政策</span>
          </NuxtLink>
        </div>
      </Transition>
    </header>

    <!-- 主内容插槽 -->
    <main class="main-body">
      <slot />
    </main>

    <!-- 全局悬浮【回到顶部】FAB 按钮 -->
    <BackToTop />

    <!-- 极简流体页脚 -->
    <footer class="app-footer">
      <div class="footer-content">
        <NuxtLink to="/privacy" class="footer-nav-link">隐私政策</NuxtLink>
        <span class="footer-divider">·</span>
        <span class="footer-brand">PanHub · 全网极速聚合</span>
        <span class="footer-divider">·</span>
        <span class="footer-copyright">© {{ new Date().getFullYear() }}</span>
      </div>
    </footer>
    <!-- 全局 NAS 设置弹窗 -->
    <NasSettingsModal :visible="nasModalVisible" @close="nasModalVisible = false" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import BackToTop from "../components/BackToTop.vue";
import NasSettingsModal from "../components/NasSettingsModal.vue";

const { loadSettings } = useSettings();
const { isDark, toggle: toggleTheme } = useDarkMode();
const { user, isAdmin, logout } = useAuth();
const { loadProfile } = useNasProfile();

const currentNav = ref("home");
const mobileMenuOpen = ref(false);
const nasModalVisible = useState<boolean>("nas_modal_visible", () => false);
const userMenuOpen = ref(false);

async function handleLogout() {
  userMenuOpen.value = false;
  await logout();
}

function scrollToSection(id: string) {
  mobileMenuOpen.value = false;
  const layout = document.querySelector(".layout") as HTMLElement | null;
  const el = document.getElementById(id);
  if (el) {
    if (layout) {
      const topPos = el.getBoundingClientRect().top + layout.scrollTop - 70;
      layout.scrollTo({ top: Math.max(0, topPos), behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }
}

onMounted(() => {
  loadSettings();
  if (user.value) {
    loadProfile().catch(() => {});
  }
});
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* 现代化毛玻璃顶栏 (Top App Bar) */
.top-app-bar {
  position: sticky;
  top: 0;
  z-index: 50;
  width: 100%;
  height: 60px;
  background: var(--bg-glass, rgba(13, 17, 23, 0.82));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-glass, rgba(255, 255, 255, 0.08));
  transition: background-color 0.25s ease, border-color 0.25s ease;
}

.app-bar-container {
  max-width: 1280px;
  height: 100%;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* 品牌 Logo */
.brand-section {
  display: flex;
  align-items: center;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.brand-badge-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, #10b981 0%, #0f766e 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.brand-link:hover .brand-badge-icon {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.45);
}

.brand-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.brand-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary, #ffffff);
}

.brand-tag {
  font-size: 10px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  letter-spacing: 0.05em;
}

/* 桌面端导航 */
.desktop-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #94a3b8);
  text-decoration: none;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.nav-item:hover {
  color: var(--text-primary, #ffffff);
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
}

.nav-item.active {
  color: var(--text-primary, #ffffff);
  background: var(--bg-surface-elevated, rgba(255, 255, 255, 0.1));
  font-weight: 600;
}

.nav-pill-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 9999px;
  background: rgba(245, 158, 11, 0.16);
  color: #f59e0b;
  font-weight: 600;
}

.nav-pill-badge.subhd {
  background: rgba(59, 130, 246, 0.16);
  color: #60a5fa;
}

/* 右侧操作区 */
.action-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.1));
  background: var(--bg-btn, rgba(255, 255, 255, 0.05));
  color: var(--text-secondary, #94a3b8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-toggle-btn:hover {
  color: var(--text-primary, #ffffff);
  background: var(--bg-btn-hover, rgba(255, 255, 255, 0.1));
  border-color: var(--border-medium, rgba(255, 255, 255, 0.2));
}

.avatar-capsule {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-surface-elevated, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.15));
  color: var(--text-secondary, #cbd5e1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.avatar-glow-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 6px #10b981;
  border: 1.5px solid var(--bg-primary, #0d1117);
}

.user-nav-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.nas-btn {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
  color: #34d399;
}

.nas-btn:hover {
  background: rgba(16, 185, 129, 0.22);
}

.admin-btn {
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.3);
  color: #c4b5fd;
}

.admin-btn:hover {
  background: rgba(139, 92, 246, 0.22);
}

.user-dropdown-wrapper {
  position: relative;
}

.user-btn {
  cursor: pointer;
  width: auto;
  padding: 0 10px 0 8px;
  border-radius: 999px;
  gap: 6px;
}

.user-name-text {
  font-size: 12px;
  color: #fff;
  font-weight: 500;
}

.user-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 200px;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  padding: 6px;
  z-index: 60;
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  padding: 8px 10px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 4px;
}

.dropdown-item {
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  border: none;
  background: transparent;
  color: #e5e7eb;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  display: block;
  transition: background-color 0.15s;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.mobile-menu-btn {
  display: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.1));
  background: transparent;
  color: var(--text-primary, #ffffff);
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* 移动端折叠抽屉 */
.mobile-drawer {
  padding: 12px 20px 18px;
  background: var(--bg-glass-strong, rgba(13, 17, 23, 0.96));
  border-bottom: 1px solid var(--border-glass, rgba(255, 255, 255, 0.1));
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-nav-item {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary, #ffffff);
  text-decoration: none;
  background: var(--bg-surface-elevated, rgba(255, 255, 255, 0.04));
  transition: background 0.18s ease;
}

.drawer-nav-item.secondary {
  color: var(--text-secondary, #94a3b8);
  font-size: 13px;
}

/* 主内容与页脚 */
.main-body {
  flex: 1;
}

.app-footer {
  padding: 24px 16px 36px;
  border-top: 1px solid var(--border-glass, rgba(255, 255, 255, 0.06));
  margin-top: auto;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-tertiary, #64748b);
}

.footer-nav-link {
  color: var(--text-secondary, #94a3b8);
  text-decoration: none;
}

.footer-nav-link:hover {
  color: var(--primary, #10b981);
}

.footer-divider {
  opacity: 0.4;
}

/* 响应式适配 */
@media (max-width: 900px) {
  .desktop-nav {
    display: none;
  }
  .mobile-menu-btn {
    display: flex;
  }
  .app-bar-container {
    padding: 0 16px;
  }
}
</style>
