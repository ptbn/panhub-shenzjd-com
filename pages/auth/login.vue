<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- 品牌标识 -->
      <div class="brand-header">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <h1 class="brand-title">PanHub 私有云中枢</h1>
        <p class="brand-subtitle">私有化闭环运行 · NAS 离线下载智能调度</p>
      </div>

      <!-- 自举提示横幅 -->
      <div v-if="isBootstrap" class="bootstrap-banner">
        <span class="sparkle">🚀</span>
        <span>系统初始启动：首位注册用户将自动晋升为<strong>系统超级管理员</strong>（免邀请码）</span>
      </div>

      <!-- 切换标签 -->
      <div class="tab-group">
        <button
          type="button"
          :class="['tab-btn', { active: mode === 'login' }]"
          @click="mode = 'login'; errorMessage = ''">
          账号登录
        </button>
        <button
          type="button"
          :class="['tab-btn', { active: mode === 'register' }]"
          @click="mode = 'register'; errorMessage = ''">
          {{ isBootstrap ? '管理员自举注册' : '邀请码注册' }}
        </button>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMessage" class="error-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- 登录表单 -->
      <form v-if="mode === 'login'" class="form-container" @submit.prevent="handleLogin">
        <div class="form-item">
          <label>电子邮箱</label>
          <input
            v-model="loginForm.email"
            type="email"
            required
            placeholder="admin@taogehome.cloud"
            autocomplete="username" />
        </div>
        <div class="form-item">
          <label>登录密码</label>
          <input
            v-model="loginForm.password"
            type="password"
            required
            placeholder="••••••••"
            autocomplete="current-password" />
        </div>
        <button type="submit" class="submit-btn" :disabled="submitting">
          <span v-if="submitting" class="spinner"></span>
          <span>{{ submitting ? '登录中...' : '立即登录' }}</span>
        </button>
      </form>

      <!-- 注册表单 -->
      <form v-else class="form-container" @submit.prevent="handleRegister">
        <div class="form-item">
          <label>昵称 / 用户名</label>
          <input
            v-model="regForm.username"
            type="text"
            required
            placeholder="例如: 涛哥"
            autocomplete="name" />
        </div>
        <div class="form-item">
          <label>电子邮箱</label>
          <input
            v-model="regForm.email"
            type="email"
            required
            placeholder="your-name@taogehome.cloud"
            autocomplete="email" />
        </div>
        <div class="form-item">
          <label>设置密码</label>
          <input
            v-model="regForm.password"
            type="password"
            required
            minlength="6"
            placeholder="至少 6 位字符"
            autocomplete="new-password" />
        </div>
        <div v-if="!isBootstrap" class="form-item">
          <label>8 位准入邀请码</label>
          <input
            v-model="regForm.inviteCode"
            type="text"
            required
            maxlength="8"
            placeholder="例如: A7K9X2P4"
            style="text-transform: uppercase; font-family: monospace; letter-spacing: 2px;" />
          <p class="field-hint">请向超级管理员索取 8 位专属一次性邀请码</p>
        </div>
        <button type="submit" class="submit-btn" :disabled="submitting">
          <span v-if="submitting" class="spinner"></span>
          <span>{{ submitting ? '正在创建账号...' : (isBootstrap ? '自举为超级管理员并登入' : '完成注册并登入') }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const { fetchUser } = useAuth();

const mode = ref<"login" | "register">("login");
const isBootstrap = ref(false);
const submitting = ref(false);
const errorMessage = ref("");

const loginForm = reactive({
  email: "",
  password: "",
});

const regForm = reactive({
  username: "",
  email: "",
  password: "",
  inviteCode: "",
});

onMounted(async () => {
  try {
    const res = await $fetch<{ isBootstrap: boolean }>("/api/auth/bootstrap-status");
    isBootstrap.value = res.isBootstrap;
    if (isBootstrap.value) {
      mode.value = "register";
    }
  } catch (e) {
    console.warn("获取自举状态失败:", e);
  }
});

async function handleLogin() {
  submitting.value = true;
  errorMessage.value = "";
  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: loginForm,
    });
    await fetchUser();
    const redirect = (route.query.redirect as string) || "/";
    router.push(redirect);
  } catch (err: any) {
    errorMessage.value = err.data?.message || err.message || "登录失败，请检查邮箱与密码";
  } finally {
    submitting.value = false;
  }
}

async function handleRegister() {
  submitting.value = true;
  errorMessage.value = "";
  try {
    await $fetch("/api/auth/register", {
      method: "POST",
      body: regForm,
    });
    await fetchUser();
    const redirect = (route.query.redirect as string) || "/";
    router.push(redirect);
  } catch (err: any) {
    errorMessage.value = err.data?.message || err.message || "注册失败，请检查邀请码与输入";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.auth-page {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: rgba(26, 26, 26, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 32px 28px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px);
}

.brand-header {
  text-align: center;
  margin-bottom: 24px;
}

.brand-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
  color: #f3f4f6;
  margin: 0 0 6px;
}

.brand-subtitle {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

.bootstrap-banner {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #34d399;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 20px;
}

.sparkle {
  font-size: 16px;
}

.tab-group {
  display: flex;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
  margin-bottom: 22px;
}

.tab-btn {
  flex: 1;
  padding: 9px 0;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: 600;
}

.error-box {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 13px;
  font-weight: 500;
  color: #d1d5db;
}

.form-item input {
  padding: 11px 14px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-item input:focus {
  border-color: #10b981;
}

.field-hint {
  font-size: 11px;
  color: #6b7280;
  margin: 2px 0 0;
}

.submit-btn {
  margin-top: 8px;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 0.2s, transform 0.1s;
}

.submit-btn:hover {
  opacity: 0.92;
}

.submit-btn:active {
  transform: scale(0.99);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
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
</style>
