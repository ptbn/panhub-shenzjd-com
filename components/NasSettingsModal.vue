<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <div class="header-left">
          <h2 class="modal-title">我的 NAS 驱动配置中心</h2>
          <p class="modal-subtitle">适配绿联 DX4600 (UGOS) · AList 网盘转存 · Aria2 / qBittorrent 离线下载</p>
        </div>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- 提示消息 -->
      <div v-if="testFeedback" :class="['feedback-box', testFeedback.success ? 'feedback-ok' : 'feedback-err']">
        {{ testFeedback.message }}
      </div>

      <div class="modal-body">
        <!-- 基础配置 -->
        <div class="section-group">
          <h3 class="section-title">📦 NAS 设备名称</h3>
          <input
            v-model="form.name"
            type="text"
            class="input-field"
            placeholder="例如: 客厅绿联 DX4600 UGOS" />
        </div>

        <!-- AList 网盘驱动配置 -->
        <div class="section-group">
          <div class="flex-between">
            <h3 class="section-title">☁️ AList 网盘转存驱动</h3>
            <label class="toggle-label">
              <input v-model="form.cloudDriveEnabled" type="checkbox" />
              <span>启用</span>
            </label>
          </div>
          <div v-if="form.cloudDriveEnabled" class="form-grid">
            <div class="form-item col-span-2">
              <label>AList 访问地址 (支持 Cloudflare Tunnel 域名)</label>
              <input
                v-model="form.alistUrl"
                type="url"
                class="input-field"
                placeholder="https://alist.taogehome.cloud" />
            </div>
            <div class="form-item">
              <label>AList API Token {{ form.alistHasToken ? '(已保存密文)' : '' }}</label>
              <input
                v-model="form.alistToken"
                type="password"
                class="input-field"
                :placeholder="form.alistHasToken ? '****** (留空保持原配置)' : '输入 AList 个人令牌'" />
            </div>
            <div class="form-item">
              <label>默认转存落盘目录</label>
              <input
                v-model="form.alistDefaultPath"
                type="text"
                class="input-field"
                placeholder="/我的网盘/电影" />
            </div>
            <div class="col-span-2">
              <button
                type="button"
                class="test-btn"
                :disabled="testingAlist || !form.alistUrl"
                @click="testAlist">
                {{ testingAlist ? '连通性探活中...' : '⚡ 测试 AList 连通性' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Aria2 / qBittorrent BT 磁力驱动配置 -->
        <div class="section-group">
          <h3 class="section-title">🧲 BT / 磁力下载器驱动 (绿联云影院联动)</h3>
          <div class="client-type-selector">
            <label class="radio-label">
              <input v-model="form.torrentClientType" type="radio" value="aria2" />
              <span>Aria2 JSON-RPC (推荐)</span>
            </label>
            <label class="radio-label">
              <input v-model="form.torrentClientType" type="radio" value="qbittorrent" />
              <span>qBittorrent WebAPI</span>
            </label>
          </div>

          <div class="form-grid">
            <div class="form-item col-span-2">
              <label>下载器访问地址 (支持 Tunnel 域名)</label>
              <input
                v-model="form.torrentClientUrl"
                type="url"
                class="input-field"
                :placeholder="form.torrentClientType === 'aria2' ? 'https://aria2.taogehome.cloud/jsonrpc' : 'https://qb.taogehome.cloud'" />
            </div>
            <div class="form-item">
              <label>RPC 密钥 / Web 密码 {{ form.torrentHasSecret ? '(已保存密文)' : '' }}</label>
              <input
                v-model="form.torrentClientSecret"
                type="password"
                class="input-field"
                :placeholder="form.torrentHasSecret ? '****** (留空保持原配置)' : '输入 RPC Secret 或密码'" />
            </div>
            <div class="form-item">
              <label>NAS 落地存储路径 (绿联云影院监控目录)</label>
              <input
                v-model="form.torrentDefaultDir"
                type="text"
                class="input-field"
                placeholder="/Media/Movies" />
            </div>
            <div class="col-span-2">
              <button
                type="button"
                class="test-btn"
                :disabled="testingTorrent || !form.torrentClientUrl"
                @click="testTorrent">
                {{ testingTorrent ? '连通性探活中...' : '⚡ 测试下载器连通性' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('close')">取消</button>
        <button class="save-btn" :disabled="saving" @click="saveProfile">
          {{ saving ? '正在安全加密保存...' : '保存 NAS 配置' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
}>();
const emit = defineEmits(["close", "saved"]);

const form = reactive({
  name: "我的绿联 DX4600 UGOS",
  cloudDriveEnabled: true,
  alistUrl: "",
  alistToken: "",
  alistHasToken: false,
  alistDefaultPath: "/我的网盘/电影",
  torrentClientType: "aria2" as "aria2" | "qbittorrent",
  torrentClientUrl: "",
  torrentClientSecret: "",
  torrentHasSecret: false,
  torrentDefaultDir: "/Media/Movies",
});

const saving = ref(false);
const testingAlist = ref(false);
const testingTorrent = ref(false);
const testFeedback = ref<{ success: boolean; message: string } | null>(null);

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      testFeedback.value = null;
      try {
        const res = await $fetch<{ profile: any }>("/api/nas/profile");
        if (res.profile) {
          form.name = res.profile.name;
          form.cloudDriveEnabled = res.profile.cloudDriveEnabled;
          form.alistUrl = res.profile.alistUrl;
          form.alistHasToken = res.profile.alistHasToken;
          form.alistToken = res.profile.alistHasToken ? "******" : "";
          form.alistDefaultPath = res.profile.alistDefaultPath;
          form.torrentClientType = res.profile.torrentClientType || "aria2";
          form.torrentClientUrl = res.profile.torrentClientUrl;
          form.torrentHasSecret = res.profile.torrentHasSecret;
          form.torrentClientSecret = res.profile.torrentHasSecret ? "******" : "";
          form.torrentDefaultDir = res.profile.torrentDefaultDir;
        }
      } catch (e) {
        console.error("加载 NAS 配置失败:", e);
      }
    }
  },
  { immediate: true }
);

async function testAlist() {
  testingAlist.value = true;
  testFeedback.value = null;
  try {
    const res = await $fetch<{ success: boolean; message: string }>("/api/nas/test", {
      method: "POST",
      body: {
        type: "alist",
        url: form.alistUrl,
        token: form.alistToken,
      },
    });
    testFeedback.value = res;
  } catch (err: any) {
    testFeedback.value = {
      success: false,
      message: err.data?.message || err.message || "AList 连接测试失败",
    };
  } finally {
    testingAlist.value = false;
  }
}

async function testTorrent() {
  testingTorrent.value = true;
  testFeedback.value = null;
  try {
    const res = await $fetch<{ success: boolean; message: string }>("/api/nas/test", {
      method: "POST",
      body: {
        type: form.torrentClientType,
        url: form.torrentClientUrl,
        secret: form.torrentClientSecret,
        password: form.torrentClientSecret,
      },
    });
    testFeedback.value = res;
  } catch (err: any) {
    testFeedback.value = {
      success: false,
      message: err.data?.message || err.message || "下载器连接测试失败",
    };
  } finally {
    testingTorrent.value = false;
  }
}

async function saveProfile() {
  saving.value = true;
  testFeedback.value = null;
  try {
    await $fetch("/api/nas/profile", {
      method: "POST",
      body: form,
    });
    emit("saved");
    emit("close");
  } catch (err: any) {
    testFeedback.value = {
      success: false,
      message: err.data?.message || err.message || "保存失败",
    };
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 620px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px;
}

.modal-subtitle {
  font-size: 12px;
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

.feedback-box {
  margin: 12px 24px 0;
  padding: 10px 14px;
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

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-group {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 16px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #e5e7eb;
  margin: 0 0 12px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #9ca3af;
  cursor: pointer;
}

.client-type-selector {
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #d1d5db;
  cursor: pointer;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.col-span-2 {
  grid-column: span 2;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 12px;
  color: #9ca3af;
}

.input-field {
  width: 100%;
  padding: 9px 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  outline: none;
}

.input-field:focus {
  border-color: #10b981;
}

.test-btn {
  width: 100%;
  padding: 8px;
  border-radius: 6px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.test-btn:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.2);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.cancel-btn {
  padding: 9px 18px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.save-btn {
  padding: 9px 22px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  color: #fff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
