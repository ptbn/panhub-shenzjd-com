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
            <h3 class="section-title">☁️ AList 网盘中枢与动态挂载驱动</h3>
            <div class="header-right-actions">
              <button
                type="button"
                class="quick-preset-btn"
                @click="quickFillTaogeAlist"
                title="一键填入家庭推荐的 AList 服务地址与凭据">
                ⚡ 填入家庭 AList 预设
              </button>
              <label class="toggle-label">
                <input v-model="form.cloudDriveEnabled" type="checkbox" />
                <span>启用</span>
              </label>
            </div>
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
              <label>AList API Token {{ form.alistHasToken ? '(已加密持久化)' : '' }}</label>
              <input
                v-model="form.alistToken"
                type="password"
                class="input-field"
                :placeholder="form.alistHasToken ? '****** (留空保持原配置)' : '输入 AList API Token'" />
            </div>
            <div class="form-item">
              <div class="flex-between">
                <label>用户专属挂载根目录 (多用户隔离)</label>
                <span class="field-subhint font-mono">必须为 AList 真实存储挂载点</span>
              </div>
              <input
                v-model="form.alistDefaultPath"
                type="text"
                class="input-field"
                placeholder="例如 /NAS本地盘 或 /夸克 (留空使用根目录 /)" />
              <div v-if="mountedStorages.length > 0" class="quick-mount-chips">
                <span class="quick-chip-label">快捷选用已挂载存储：</span>
                <button
                  v-for="s in mountedStorages"
                  :key="s.id"
                  type="button"
                  class="mount-chip-btn"
                  :class="{ active: form.alistDefaultPath === s.mountPath }"
                  @click="form.alistDefaultPath = s.mountPath">
                  {{ s.mountPath }}
                </button>
                <button
                  type="button"
                  class="mount-chip-btn"
                  :class="{ active: form.alistDefaultPath === '/' }"
                  @click="form.alistDefaultPath = '/'">
                  / (全局根目录)
                </button>
              </div>
              <p class="field-hint">影视动态挂载或推送将以此目录为基准，系统已自动对齐您的 AList 实机存储。</p>
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

            <!-- 挂载存储探活列表 -->
            <div v-if="mountedStorages.length > 0" class="col-span-2 storages-box">
              <div class="storages-title">📂 AList 已连接云盘中枢状态：</div>
              <div class="storage-tags">
                <div v-for="s in mountedStorages" :key="s.id" class="storage-chip">
                  <span class="chip-dot" :class="s.status === 'work' ? 'dot-green' : 'dot-yellow'"></span>
                  <span class="chip-path">{{ s.mountPath }}</span>
                  <span class="chip-driver">{{ s.driver }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 芝杜 Z9X (WebDAV) 播放器看板 -->
        <div class="section-group z9x-panel">
          <div class="flex-between">
            <div class="z9x-title-wrap">
              <h3 class="section-title">📺 芝杜 Z9X (WebDAV) 原画直连看板</h3>
              <span class="z9x-mini-badge">玩法一：免下载秒播</span>
            </div>
            <span class="z9x-pill-green">302 官方 CDN 直通</span>
          </div>

          <p class="z9x-desc">
            在芝杜 Z9X 海报墙中添加下列 WebDAV 地址，即可免下载直接 4K 原画秒播 AList 聚合的所有网盘（115/夸克/百度）与本地影视，零消耗 NAS 硬盘与性能。
          </p>

          <div class="z9x-grid">
            <div class="z9x-item">
              <div class="z9x-label-row">
                <span class="z9x-label">🏠 局域网直连 (推荐家里使用·0延迟无限制)</span>
                <button type="button" class="copy-link-btn" @click="copyText('http://192.168.1.110:45199/dav')">复制</button>
              </div>
              <div class="z9x-val font-mono">http://192.168.1.110:45199/dav</div>
            </div>

            <div class="z9x-item">
              <div class="z9x-label-row">
                <span class="z9x-label">🌐 远程/外出地址 (支持公网穿透)</span>
                <button type="button" class="copy-link-btn" @click="copyText('https://alist.taogehome.cloud/dav')">复制</button>
              </div>
              <div class="z9x-val font-mono">https://alist.taogehome.cloud/dav</div>
            </div>

            <div class="z9x-item-row">
              <div class="z9x-item half">
                <div class="z9x-label-row">
                  <span class="z9x-label">👤 用户名 (与 AList 一致)</span>
                  <button type="button" class="copy-link-btn" @click="copyText(z9xUser)">复制</button>
                </div>
                <input v-model="z9xUser" class="z9x-input font-mono" placeholder="AList 用户名 (如 admin)" />
              </div>
              <div class="z9x-item half">
                <div class="z9x-label-row">
                  <span class="z9x-label">🔑 密码 (与 AList 一致)</span>
                  <button type="button" class="copy-link-btn" @click="copyText(z9xPass)">复制</button>
                </div>
                <input v-model="z9xPass" type="password" class="z9x-input font-mono" placeholder="输入 AList 密码" />
              </div>
            </div>
          </div>

          <div class="z9x-guide">
            <div class="guide-title">📖 芝杜海报墙 4.0 添加步骤：</div>
            <ol class="guide-steps">
              <li>打开芝杜 Z9X -> 进入<b>「海报墙」</b> -> 导航切到<b>「源设备」</b> -> 点击<b>「+ 添加」</b>；</li>
              <li>协议类型选择 <b>「WebDAV (HTTP)」</b>，服务器填 <code>192.168.1.110</code>，端口填 <code>45199</code>，路径填 <code>/dav</code>；</li>
              <li>填入上述账号密码，建议路径分别添加 <code>/dav/115网盘</code> 或 <code>/dav/夸克</code>，保存后即可自动出海报墙！</li>
            </ol>
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
import { useNasProfile } from "~/composables/useNasProfile";

const props = defineProps<{
  visible: boolean;
}>();
const emit = defineEmits(["close", "saved"]);

const { loadProfile, saveProfile: persistNasProfile, getLocalProfile, getLocalCredentials, getAuthHeaders } = useNasProfile();

const form = reactive({
  name: "我的绿联 DX4600 UGOS",
  cloudDriveEnabled: true,
  alistUrl: "",
  alistToken: "",
  alistHasToken: false,
  alistDefaultPath: "/NAS本地盘",
  torrentClientType: "aria2" as "aria2" | "qbittorrent",
  torrentClientUrl: "",
  torrentClientSecret: "",
  torrentHasSecret: false,
  torrentDefaultDir: "/Media/Movies",
});

function hydrateFromLocal() {
  const local = getLocalCredentials() || getLocalProfile();
  if (local) {
    if (local.name) form.name = local.name;
    if (local.alistUrl) form.alistUrl = local.alistUrl;
    if (local.alistToken && local.alistToken !== "******") {
      form.alistToken = local.alistToken;
      form.alistHasToken = true;
    }
    if (local.alistDefaultPath && !local.alistDefaultPath.startsWith("/我的网盘") && local.alistDefaultPath !== "/我的影视挂载") {
      form.alistDefaultPath = local.alistDefaultPath;
    }
    if (local.torrentClientType) form.torrentClientType = local.torrentClientType;
    if (local.torrentClientUrl) form.torrentClientUrl = local.torrentClientUrl;
    if (local.torrentClientSecret && local.torrentClientSecret !== "******") {
      form.torrentClientSecret = local.torrentClientSecret;
      form.torrentHasSecret = true;
    }
    if (local.torrentDefaultDir) form.torrentDefaultDir = local.torrentDefaultDir;
  }
}

if (import.meta.client) {
  hydrateFromLocal();
}

const saving = ref(false);
const testingAlist = ref(false);
const testingTorrent = ref(false);
const testFeedback = ref<{ success: boolean; message: string } | null>(null);
const mountedStorages = ref<Array<{ id: number; mountPath: string; driver: string; status: string }>>([]);

async function loadStorages() {
  try {
    const res = await $fetch<{ success: boolean; storages: any[] }>("/api/nas/storages", {
      headers: getAuthHeaders(),
    });
    if (res.success && res.storages) {
      mountedStorages.value = res.storages;
      // 自动自愈：若当前配置的是历史遗留的假目录，纠偏为实机存在的真实存储
      if (form.alistDefaultPath === "/我的网盘/电影" || form.alistDefaultPath === "/我的影视挂载") {
        const local = res.storages.find((s: any) => s.mountPath.includes("本地") || s.mountPath.includes("NAS")) || res.storages[0];
        if (local) {
          form.alistDefaultPath = local.mountPath;
        }
      }
    }
  } catch (e) {
    // 静默降级，不阻塞界面渲染
  }
}

const z9xUser = ref(typeof localStorage !== "undefined" ? localStorage.getItem("panhub_z9x_user") || "admin" : "admin");
const z9xPass = ref(typeof localStorage !== "undefined" ? localStorage.getItem("panhub_z9x_pass") || "" : "");

if (typeof window !== "undefined") {
  watch(z9xUser, (val) => {
    localStorage.setItem("panhub_z9x_user", val);
  });
  watch(z9xPass, (val) => {
    localStorage.setItem("panhub_z9x_pass", val);
  });
}

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      testFeedback.value = null;
      hydrateFromLocal();
      loadStorages();
      try {
        const profile = await loadProfile();
        if (profile) {
          form.name = profile.name;
          form.cloudDriveEnabled = profile.cloudDriveEnabled;
          form.alistUrl = profile.alistUrl;
          form.alistHasToken = profile.alistHasToken;
          const rawPath = profile.alistDefaultPath || "";
          if (
            !rawPath ||
            rawPath === "/我的网盘/电影" ||
            rawPath === "/我的影视挂载" ||
            rawPath.startsWith("/我的网盘")
          ) {
            form.alistDefaultPath = "/NAS本地盘";
          } else {
            form.alistDefaultPath = rawPath;
          }
          form.torrentClientType = profile.torrentClientType || "aria2";
          form.torrentClientUrl = profile.torrentClientUrl;
          form.torrentHasSecret = profile.torrentHasSecret;
          form.torrentClientSecret = profile.torrentHasSecret ? "******" : "";
          form.torrentDefaultDir = profile.torrentDefaultDir;
        }
      } catch (e) {
        console.error("加载 NAS 配置失败:", e);
      }
    }
  },
  { immediate: true }
);

function quickFillTaogeAlist() {
  form.alistUrl = "https://alist.taogehome.cloud";
  form.alistToken = "alist-871d2cbe-8d73-4996-8b6e-243d4c68868eSEanz0h5BaIf9RqZ3HqxIXoe5pW6eJzP38pWZGSxp8plF9xZNyCHPZPzG8jlECTP";
  if (!form.alistDefaultPath || form.alistDefaultPath === "/我的影视挂载" || form.alistDefaultPath === "/我的网盘/电影") {
    form.alistDefaultPath = "/NAS本地盘";
  }
  testFeedback.value = {
    success: true,
    message: "已一键填入家庭 AList 预设配置，请点击【测试 AList 连通性】验证或直接保存。",
  };
}

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
    if (res.success) {
      loadStorages();
    }
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
    await persistNasProfile(form);
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

function copyText(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  testFeedback.value = {
    success: true,
    message: `已复制到剪贴板: ${text}`,
  };
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

/* 芝杜 Z9X 看板专属样式 */
.z9x-panel {
  background: rgba(16, 185, 129, 0.04);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 10px;
  padding: 14px 16px;
}

.z9x-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.z9x-mini-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.z9x-pill-green {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
}

.z9x-desc {
  font-size: 12px;
  color: #9ca3af;
  margin: 6px 0 12px;
  line-height: 1.5;
}

.z9x-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.z9x-item {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 12px;
}

.z9x-item-row {
  display: flex;
  gap: 10px;
}

.z9x-item.half {
  flex: 1;
}

.z9x-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.z9x-label {
  font-size: 11px;
  color: #9ca3af;
}

.z9x-val {
  font-size: 12px;
  color: #6ee7b7;
  word-break: break-all;
}

.z9x-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #6ee7b7;
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.z9x-input:focus {
  border-color: #10b981;
}

.copy-link-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #d1d5db;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-link-btn:hover {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border-color: #10b981;
}

.z9x-guide {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

.guide-title {
  font-size: 12px;
  font-weight: 600;
  color: #e5e7eb;
  margin-bottom: 6px;
}

.guide-steps {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.6;
}

.guide-steps li {
  margin-bottom: 3px;
}

.guide-steps code {
  background: rgba(0, 0, 0, 0.4);
  color: #34d399;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
}

.storages-box {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 4px;
}

.storages-title {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 8px;
  font-weight: 500;
}

.storage-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.storage-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot-green {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.dot-yellow {
  background: #f59e0b;
}

.chip-path {
  color: #e5e7eb;
  font-weight: 600;
}

.chip-driver {
  color: #9ca3af;
  font-size: 10px;
}

.header-right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quick-preset-btn {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-preset-btn:hover {
  background: rgba(16, 185, 129, 0.25);
  color: #fff;
}

.field-hint {
  font-size: 11px;
  color: #9ca3af;
  margin: 4px 0 0;
  line-height: 1.4;
}

.field-subhint {
  font-size: 11px;
  color: #10b981;
}

.quick-mount-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.quick-chip-label {
  font-size: 11px;
  color: #9ca3af;
}

.mount-chip-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.mount-chip-btn:hover {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.mount-chip-btn.active {
  background: rgba(16, 185, 129, 0.25);
  border-color: #10b981;
  color: #10b981;
  font-weight: 600;
}
</style>
