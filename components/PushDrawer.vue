<template>
  <div v-if="visible" class="drawer-backdrop" @click.self="$emit('close')">
    <div class="drawer-panel">
      <!-- 头部 -->
      <div class="drawer-header">
        <div class="header-left">
          <div class="nas-icon-badge">
            <svg v-if="isCloud" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <div>
            <h2 class="drawer-title">{{ isCloud ? '转存至网盘 · 芝杜秒播' : '推送到 NAS 离线下载' }}</h2>
            <p class="drawer-subtitle">{{ isCloud ? '云端免下载 · AList 302 聚合 · 芝杜 Z9X 海报墙直映' : '智能分类 · 目录自动分流 · 联动绿联云影院' }}</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- 反馈消息 -->
      <div v-if="feedback" :class="['feedback-card', feedback.success ? 'feedback-ok' : 'feedback-err']">
        <div class="feedback-title">{{ feedback.success ? '🎉 操作成功！' : '❌ 提示' }}</div>
        <div class="feedback-msg">{{ feedback.message }}</div>
      </div>

      <!-- 内容区 -->
      <div class="drawer-body">
        <!-- 资源卡片预览 -->
        <div class="resource-preview">
          <div class="res-title">{{ item?.note || item?.url }}</div>
          <div class="res-meta">
            <span class="meta-pill font-mono">{{ isCloud ? '网盘分享资源' : 'BT磁力/种子直链' }}</span>
            <span v-if="item?.password" class="meta-pill highlight">提取码: {{ item.password }}</span>
            <span v-if="inferredMediaType" class="meta-pill">{{ inferredMediaType }}</span>
          </div>
        </div>

        <!-- 玩法一 (方案 A)：网盘类动态挂载与芝杜直出联动面板 -->
        <div v-if="isCloud" class="cloud-panel">
          <!-- 门禁 1：未登录提示 -->
          <div v-if="!isAuthenticated" class="gate-card unauth">
            <div class="gate-icon">🔒</div>
            <div class="gate-content">
              <div class="gate-title">多用户 AList 专属挂载需登录</div>
              <div class="gate-desc">登录后即可将分享直接挂载到您的专属目录，芝杜 Z9X 免下载 4K 秒播，完全隔离其他用户。</div>
              <div class="gate-actions">
                <a href="/auth/login" class="gate-btn primary">立即登录 / 注册</a>
              </div>
            </div>
          </div>

          <!-- 门禁 1.5：正在同步云端 D1 NAS 配置 (防闪烁) -->
          <div v-else-if="checkingProfile && !alistConfigured" class="gate-card loading-gate">
            <div class="gate-icon">
              <span class="spinner-large"></span>
            </div>
            <div class="gate-content">
              <div class="gate-title">正在同步云端 D1 NAS 节点配置...</div>
              <div class="gate-desc">正在拉取您的家庭 AList 与芝杜挂载配置，请稍候。</div>
            </div>
          </div>

          <!-- 门禁 2：已登录但未配置 AList -->
          <div v-else-if="!alistConfigured" class="gate-card unconfigured">
            <div class="gate-icon">⚙️</div>
            <div class="gate-content">
              <div class="gate-title">尚未在【我的 NAS】中绑定 AList</div>
              <div class="gate-desc">请先配置您的 AList 服务地址与 API Token，配置后可一键自动挂载并推送到芝杜海报墙。</div>
              <div class="gate-actions">
                <button type="button" class="gate-btn primary" @click="openNasSettings">
                  前往绑定我的 AList
                </button>
              </div>
            </div>
          </div>

          <!-- 状态 3：已就绪，展示方案 A 挂载面板 -->
          <template v-else>
            <!-- 挂载成功展示卡片 -->
            <div v-if="mountSuccessResult" class="mount-success-card">
              <div class="success-header">
                <span class="badge-success">✅ 已成功动态挂载至 AList</span>
                <span class="driver-name">{{ mountSuccessResult.driver }}</span>
              </div>
              <div class="mount-info-row">
                <span class="info-label">📺 芝杜 Z9X 直播源 (WebDAV)：</span>
                <div class="copyable-row">
                  <code class="code-val">{{ mountSuccessResult.webdavUrl }}</code>
                  <button type="button" class="mini-copy-btn" @click="copyText(mountSuccessResult.webdavUrl)">复制</button>
                </div>
              </div>
              <div v-if="mountSuccessResult.files && mountSuccessResult.files.length > 0" class="files-preview">
                <div class="files-title">📁 包含影视媒体文件 ({{ mountSuccessResult.files.length }} 个)：</div>
                <ul class="files-list">
                  <li v-for="f in mountSuccessResult.files.slice(0, 4)" :key="f.name">
                    <span class="file-name">{{ f.name }}</span>
                    <span v-if="f.size" class="file-size">{{ formatBytes(f.size) }}</span>
                  </li>
                </ul>
              </div>
              <div class="success-actions">
                <a :href="mountSuccessResult.alistPlayUrl" target="_blank" class="open-alist-btn">
                  <span>🌐 打开 AList 在线原画播放</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              </div>
            </div>

            <!-- 挂载前引导卡片：方案 A (支持动态只读分享挂载，如 115/百度/阿里/123Pan) -->
            <div v-else-if="canShareMount" class="z9x-card">
              <div class="z9x-header">
                <span class="z9x-badge">⚡ 方案 A：AList 动态分享挂载</span>
                <span class="z9x-tag">免转存 · 芝杜秒播</span>
              </div>
              <div class="mount-path-preview">
                <span class="preview-label">专属挂载路径：</span>
                <code class="preview-path">{{ targetMountPathPreview }}</code>
              </div>
              <div class="z9x-steps">
                <div class="step-item">
                  <span class="step-num">1</span>
                  <div class="step-text">点击下方<b>「一键挂载到 AList」</b>，系统自动通过 AList 接口将该分享挂载为只读影视目录；</div>
                </div>
                <div class="step-item">
                  <span class="step-num">2</span>
                  <div class="step-text"><b>无需转存到个人盘，不占网盘空间</b>，芝杜 Z9X 海报墙直接读取 WebDAV 4K 播放；</div>
                </div>
                <div class="step-item">
                  <span class="step-num">3</span>
                  <div class="step-text">若遇到特殊链接失效，支持随时使用备用通道前往网盘官方转存。</div>
                </div>
              </div>
            </div>

            <!-- 挂载前引导卡片：方案 B (需转存个人盘，如迅雷/夸克/UC/天翼等) -->
            <div v-else class="z9x-card transfer-card">
              <div class="z9x-header">
                <span class="z9x-badge transfer-badge">📦 方案 B：转存至个人盘 · 穿透同步</span>
                <span class="z9x-tag transfer-tag">需转存个人盘 · 芝杜秒播</span>
              </div>
              <div class="mount-path-preview">
                <span class="preview-label">识别目标网盘：</span>
                <code class="preview-path">{{ detectedNetdiskName }}</code>
                <span v-if="resolvedAlistPath" class="target-storage-tag">AList 挂载点: {{ resolvedAlistPath }}</span>
              </div>
              <div class="z9x-steps">
                <div class="step-item">
                  <span class="step-num">1</span>
                  <div class="step-text">受网盘官方安全机制限制，需由您在官方页面保存：点击下方<b>「① 打开网盘转存 (带提取码)」</b>，前往网盘点击<b>【保存到我的网盘】</b>；</div>
                </div>
                <div class="step-item">
                  <span class="step-num">2</span>
                  <div class="step-text">在网盘中保存成功后，返回此处点击<b>「② 存入后穿透刷新 AList」</b>，系统立即通知 AList 穿透刷新该目录缓存；</div>
                </div>
                <div class="step-item">
                  <span class="step-num">3</span>
                  <div class="step-text"><b>芝杜 Z9X 海报墙将即刻自动识别并原画直映</b>，畅享 4K 极速秒播。</div>
                </div>
              </div>
              <div class="transfer-notice">
                💡 <b>特别提醒</b>：迅雷/夸克官方有安全风控，需由您在打开的官方网页中点击<b>【保存到网盘】</b>。保存完毕后，点击下方第 ② 步即可通知 AList 穿透同步并在芝杜播放。
              </div>
            </div>
          </template>
        </div>

        <!-- 磁力类资源：下载器调度面板 -->
        <div v-else class="torrent-panel">
          <!-- 门禁 1：未登录提示 -->
          <div v-if="!isAuthenticated" class="gate-card unauth">
            <div class="gate-icon">🔒</div>
            <div class="gate-content">
              <div class="gate-title">推送至 NAS 离线下载需先登录账号</div>
              <div class="gate-desc">登录后即可将种子/磁力自动下发至内网 qBittorrent / Aria2 并自动入库芝杜与绿联云影院海报墙。</div>
              <div class="gate-actions">
                <a href="/auth/login" class="gate-btn primary">立即登录 / 注册</a>
              </div>
            </div>
          </div>

          <!-- 门禁 1.5：正在同步云端 D1 NAS 配置 (防闪烁) -->
          <div v-else-if="checkingProfile && !alistConfigured" class="gate-card loading-gate">
            <div class="gate-icon">
              <span class="spinner-large"></span>
            </div>
            <div class="gate-content">
              <div class="gate-title">正在同步云端 D1 NAS 节点配置...</div>
              <div class="gate-desc">正在拉取您的家庭 NAS 下载驱动配置，请稍候。</div>
            </div>
          </div>

          <!-- 门禁 2：已登录但尚未配置 NAS 节点 -->
          <div v-else-if="!alistConfigured" class="gate-card unconfigured">
            <div class="gate-icon">⚙️</div>
            <div class="gate-content">
              <div class="gate-title">尚未配置 NAS 节点与下载器</div>
              <div class="gate-desc">请先在【我的 NAS】中配置 AList 访问凭证或 qBittorrent / Aria2 下载服务。</div>
              <div class="gate-actions">
                <button type="button" class="gate-btn primary" @click="openNasSettings">
                  前往配置我的 NAS
                </button>
              </div>
            </div>
          </div>

          <!-- 状态 3：已就绪，展示完整下载器调度表单 -->
          <template v-else>
            <!-- 智能分类预设 -->
            <div class="form-group">
              <label class="group-label">影视媒体分类 (智能识别)</label>
              <div class="category-chips">
                <button
                  type="button"
                  :class="['chip', { active: form.category === 'movie' }]"
                  @click="setCategory('movie')">
                  🎬 电影 (Movies)
                </button>
                <button
                  type="button"
                  :class="['chip', { active: form.category === 'tv' }]"
                  @click="setCategory('tv')">
                  📺 电视剧 (TV)
                </button>
                <button
                  type="button"
                  :class="['chip', { active: form.category === 'anime' }]"
                  @click="setCategory('anime')">
                  🌸 动漫 (Anime)
                </button>
                <button
                  type="button"
                  :class="['chip', { active: form.category === 'other' }]"
                  @click="setCategory('other')">
                  📁 其他文件
                </button>
              </div>
            </div>

            <!-- 下载器选择 -->
            <div class="form-group">
              <label class="group-label">调度下载器驱动</label>
              <div class="engine-selector">
                <label class="engine-option">
                  <input v-model="form.preferredClient" type="radio" value="aria2" />
                  <span>Aria2 下载</span>
                </label>
                <label class="engine-option">
                  <input v-model="form.preferredClient" type="radio" value="qbittorrent" />
                  <span>qBittorrent (推荐 · AList 内网联动)</span>
                </label>
              </div>
            </div>

            <!-- 目标落盘目录 -->
            <div class="form-group">
              <div class="flex-between">
                <label class="group-label">目标存储目录 (NAS 影视盘)</label>
                <button type="button" class="reset-link" @click="resetDefaultPath">恢复默认</button>
              </div>
              <input
                v-model="form.targetDir"
                type="text"
                class="input-box"
                placeholder="/Media/Movies" />
              <p class="hint-text">
                💡 适配绿联 DX4600：下载至对应目录后，绿联云影院将自动触发文件监控并自动生成海报墙。
              </p>
            </div>
          </template>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="drawer-footer">
        <button class="cancel-btn" @click="$emit('close')">关闭</button>

        <!-- 网盘类资源操作按钮群 -->
        <template v-if="isCloud">
          <!-- 方案 A 操作群 (免转存直接挂载) -->
          <template v-if="canShareMount">
            <button
              v-if="isAuthenticated && alistConfigured"
              class="push-btn primary-glow"
              :disabled="mounting"
              @click="executeMountShare">
              <span v-if="mounting" class="spinner"></span>
              <span>{{ mounting ? '正在挂载并同步...' : '⚡ 一键挂载到 AList (芝杜秒播)' }}</span>
            </button>
            <button class="push-btn secondary-btn" @click="copyAndOpenShare">
              <span>🌐 打开网盘分享页 (带提取码)</span>
            </button>
            <button
              v-if="isAuthenticated && alistConfigured"
              class="push-btn refresh-btn"
              :disabled="refreshing"
              @click="triggerManualRefresh">
              <span v-if="refreshing" class="spinner"></span>
              <span>{{ refreshing ? '穿透刷新中...' : `🔄 转存后穿透刷新 AList${resolvedAlistPath ? ` [${resolvedAlistPath}]` : ''}` }}</span>
            </button>
          </template>

          <!-- 方案 B 操作群 (需转存个人盘后穿透刷新) -->
          <template v-else>
            <button class="push-btn secondary-btn step-btn" @click="copyAndOpenShare">
              <span>🌐 ① 打开网盘转存 (带提取码)</span>
            </button>
            <button
              v-if="isAuthenticated && alistConfigured"
              class="push-btn refresh-btn step-btn"
              :disabled="refreshing"
              @click="triggerManualRefresh">
              <span v-if="refreshing" class="spinner"></span>
              <span>{{ refreshing ? '穿透刷新中...' : `🔄 ② 存入后穿透刷新 AList${resolvedAlistPath ? ` [${resolvedAlistPath}]` : ''}` }}</span>
            </button>
          </template>
        </template>

        <!-- 磁力类资源操作按钮 -->
        <template v-else>
          <a v-if="!isAuthenticated" href="/auth/login" class="push-btn primary-glow">
            <span>🔒 请先登录账号</span>
          </a>
          <button v-else-if="!alistConfigured" class="push-btn primary-glow" @click="openNasSettings">
            <span>⚙️ 前往配置我的 NAS</span>
          </button>
          <button v-else class="push-btn" :disabled="pushing || checkingProfile" @click="executePush">
            <span v-if="pushing" class="spinner"></span>
            <span>{{ pushing ? '正在向 NAS 下发指令...' : '📥 立即推送到 NAS' }}</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { parseResourceMeta } from "~/composables/useResourceParser";
import { useAuth } from "~/composables/useAuth";
import { useNasProfile } from "~/composables/useNasProfile";
import { resolveNetdiskMountPath } from "~/utils/storageResolver";

const props = defineProps<{
  visible: boolean;
  item: any;
}>();
const emit = defineEmits(["close", "success"]);
const { user, isAuthenticated } = useAuth();
const { loadProfile: fetchNasProfile, getLocalProfile, getAuthHeaders } = useNasProfile();

const nasModalVisible = useState<boolean>("nas_modal_visible", () => false);
const nasTasksDrawerVisible = useState<boolean>("nas_tasks_drawer_visible", () => false);


const pushing = ref(false);
const mounting = ref(false);
const refreshing = ref(false);
const feedback = ref<{ success: boolean; message: string } | null>(null);
const mountSuccessResult = ref<any>(null);
const userOpenedSharePage = ref(false);

const alistConfigured = ref(false);
const checkingProfile = ref(false);
const userDefaultPath = ref("/NAS本地盘");
const userStorages = ref<any[]>([]);

// 立即在客户端从 LocalStorage 硬持久化恢复状态，防任何时机闪烁
if (import.meta.client) {
  const local = getLocalProfile();
  if (local && local.alistUrl) {
    alistConfigured.value = true;
    userDefaultPath.value =
      local.alistDefaultPath && !local.alistDefaultPath.startsWith("/我的网盘") && local.alistDefaultPath !== "/我的影视挂载"
        ? local.alistDefaultPath
        : "/NAS本地盘";
  }
}

const form = reactive({
  category: "movie" as "movie" | "tv" | "anime" | "other",
  preferredClient: "qbittorrent" as "auto" | "alist" | "aria2" | "qbittorrent",
  targetDir: "/NAS本地盘/电影",
});

const isCloud = computed(() => {
  const url = props.item?.url || "";
  return /quark\.cn|aliyundrive\.com|alipan\.com|pan\.baidu\.com|123pan\.com|115\.com|pan\.xunlei\.com|drive\.uc\.cn/i.test(
    url
  );
});

const canShareMount = computed(() => {
  const u = (props.item?.url || "").toLowerCase();
  return /115\.com\/s|pan\.baidu\.com\/s|alipan\.com\/s|aliyundrive\.com\/s|123pan\.com\/s/i.test(u);
});

const resolvedNetdiskInfo = computed(() => {
  const url = props.item?.url || "";
  return resolveNetdiskMountPath(url, userStorages.value);
});

const detectedNetdiskName = computed(() => {
  return resolvedNetdiskInfo.value?.rule?.name || "网盘资源";
});

const resolvedAlistPath = computed(() => {
  if (resolvedNetdiskInfo.value?.matched) {
    return resolvedNetdiskInfo.value.targetPath;
  }
  return "";
});

const targetMountPathPreview = computed(() => {
  let base = userDefaultPath.value;
  if (!base || base === "/我的影视挂载" || base === "/我的网盘/电影") {
    base = resolvedAlistPath.value || "/NAS本地盘";
  }
  const rawTitle = (props.item?.note || props.item?.url || "未知影视")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  const title = rawTitle.slice(0, 30);
  return `${base.replace(/\/+$/, "")}/${title}`;
});

const inferredMediaType = computed(() => {
  if (!props.item) return "";
  const meta = parseResourceMeta(props.item.note || props.item.url || "");
  if (meta.mediaType === "tv") return "识别为剧集";
  if (meta.mediaType === "anime") return "识别为动漫";
  if (meta.mediaType === "movie") return "识别为电影";
  return "";
});

async function checkUserProfile() {
  // 1. 本地 LocalStorage 瞬时检查
  const local = getLocalProfile();
  if (local && local.alistUrl) {
    alistConfigured.value = true;
    userDefaultPath.value =
      local.alistDefaultPath && !local.alistDefaultPath.startsWith("/我的网盘") && local.alistDefaultPath !== "/我的影视挂载"
        ? local.alistDefaultPath
        : "/NAS本地盘";
  }

  // 若本地尚未命中配置，标记检查中以展示平滑占位动画，杜绝误报
  if (!alistConfigured.value) {
    checkingProfile.value = true;
  }

  // 2. 异步同步服务端（并在边缘节点冷重启时自动回写自愈）
  try {
    const prof = await fetchNasProfile();
    if (prof && prof.alistUrl) {
      alistConfigured.value = true;
      userDefaultPath.value =
        prof.alistDefaultPath && !prof.alistDefaultPath.startsWith("/我的网盘") && prof.alistDefaultPath !== "/我的影视挂载"
          ? prof.alistDefaultPath
          : "/NAS本地盘";

      // 异步抓取当前 AList 已挂载存储列表，用于精准解析目录
      $fetch<{ success: boolean; storages: any[] }>("/api/nas/storages", {
        headers: getAuthHeaders(),
      })
        .then((sRes) => {
          if (sRes.success && sRes.storages) {
            userStorages.value = sRes.storages;
            if (isCloud.value) {
              updateTargetDir();
            }
          }
        })
        .catch(() => {});
    } else if (!local?.alistUrl) {
      alistConfigured.value = false;
      userStorages.value = [];
    }
  } catch {
    if (!local?.alistUrl) {
      alistConfigured.value = false;
      userStorages.value = [];
    }
  } finally {
    checkingProfile.value = false;
  }
}

function computeSmartTargetDir(category: "movie" | "tv" | "anime" | "other"): string {
  const sub = category === "movie" ? "电影" : category === "tv" ? "电视剧" : category === "anime" ? "动漫" : "其他";
  const enSub = category === "movie" ? "Movies" : category === "tv" ? "TV" : category === "anime" ? "Anime" : "Downloads";

  if (isCloud.value) {
    // 优先使用当前资源在 AList 中实机匹配到的挂载点
    let cloudRoot = "";
    if (
      resolvedNetdiskInfo.value?.matched &&
      (resolvedNetdiskInfo.value.strategy === "driver_match" ||
        resolvedNetdiskInfo.value.strategy === "keyword_match")
    ) {
      cloudRoot = resolvedNetdiskInfo.value.targetPath;
    }
    if (!cloudRoot) {
      cloudRoot =
        userDefaultPath.value &&
        userDefaultPath.value !== "/我的影视挂载" &&
        userDefaultPath.value !== "/我的网盘/电影"
          ? userDefaultPath.value
          : "/NAS本地盘";
    }
    if (cloudRoot && cloudRoot !== "/") {
      return `${cloudRoot.replace(/\/+$/, "")}/${sub}`;
    }
    return `/${sub}`;
  }

  // 磁力类资源：若已配置 AList 专属挂载目录（如 /NAS本地盘），优先对齐该目录，确保 AList 与绿联云影院直接入库
  if (
    userDefaultPath.value &&
    userDefaultPath.value !== "/" &&
    userDefaultPath.value !== "/我的影视挂载" &&
    userDefaultPath.value !== "/我的网盘/电影"
  ) {
    return `${userDefaultPath.value.replace(/\/+$/, "")}/${sub}`;
  }
  return `/NAS本地盘/${sub}`;
}

function updateTargetDir() {
  form.targetDir = computeSmartTargetDir(form.category);
}

watch(
  () => resolvedAlistPath.value,
  () => {
    if (isCloud.value) {
      updateTargetDir();
    }
  }
);

watch(
  () => props.visible,
  (v) => {
    if (v) {
      feedback.value = null;
      mountSuccessResult.value = null;
      userOpenedSharePage.value = false;
      checkUserProfile();
    }
  },
  { immediate: true }
);

watch(
  () => props.item,
  (newItem) => {
    if (!newItem) return;
    feedback.value = null;
    mountSuccessResult.value = null;
    const text = `${newItem.note || ""} ${newItem.url || ""}`;
    const meta = parseResourceMeta(text);

    if (meta.mediaType === "tv" || /第[0-9一二三四五六七八九十]+季|[sS][0-9]{1,2}|集全|连载/i.test(text)) {
      form.category = "tv";
    } else if (meta.mediaType === "anime" || /番剧|新番|动漫|动画/i.test(text)) {
      form.category = "anime";
    } else {
      form.category = "movie";
    }
    updateTargetDir();
  },
  { immediate: true }
);

function setCategory(cat: "movie" | "tv" | "anime" | "other") {
  form.category = cat;
  updateTargetDir();
}

function resetDefaultPath() {
  updateTargetDir();
}

function openNasSettings() {
  emit("close");
  nasModalVisible.value = true;
}

function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text);
    feedback.value = { success: true, message: "地址已成功复制到剪贴板！" };
  }
}

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 方案 A：一键调用 AList 动态分享挂载 API
 */
async function executeMountShare() {
  if (!props.item?.url) return;
  if (!isAuthenticated.value) {
    feedback.value = {
      success: false,
      message: "请先登录 PanHub 账号，才能使用多用户 AList 专属挂载与芝杜秒播服务！",
    };
    return;
  }
  if (!alistConfigured.value) {
    feedback.value = {
      success: false,
      message: "您尚未在【我的 NAS】中配置 AList 访问地址与 API Token，请先完成绑定。",
    };
    return;
  }

  mounting.value = true;
  feedback.value = null;
  mountSuccessResult.value = null;

  try {
    const res = await $fetch<any>("/api/nas/mount-share", {
      method: "POST",
      headers: getAuthHeaders(),
      body: {
        url: props.item.url,
        password: props.item.password,
        title: props.item.note || props.item.url,
      },
    });
    mountSuccessResult.value = res;
    feedback.value = {
      success: true,
      message: `🎉 已成功动态挂载至 AList：${res.mountPath}，芝杜海报墙与播放器即刻秒播！`,
    };
  } catch (err: any) {
    let rawMsg = err.data?.message || err.message || "AList 动态挂载失败";
    if (rawMsg.includes('"errno":2') || rawMsg.includes('"errno": 2')) {
      rawMsg = "百度网盘接口提示【errno: 2 参数错误/资源失效】。可能原因：该分享已取消或失效、提取码错误，或触发了百度官方反爬风控（要求登录个人账号）。已自动为您清理失败挂载点。";
    }
    feedback.value = {
      success: false,
      message: `${rawMsg} 建议点击下方【🌐 打开网盘分享页 (带提取码)】存入个人盘后，点击【🔄 转存后穿透刷新 AList】！`,
    };
  } finally {
    mounting.value = false;
  }
}

/**
 * 备用：复制提取码并在新标签页打开网盘分享页
 */
async function copyAndOpenShare() {
  userOpenedSharePage.value = true;
  if (!props.item?.url) return;
  if (props.item.password && typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(props.item.password);
    } catch {}
  }
  window.open(props.item.url, "_blank", "noopener,noreferrer");
  feedback.value = {
    success: true,
    message: props.item.password
      ? `提取码 [${props.item.password}] 已自动复制！已在新标签页打开网盘，请点击【保存到我的网盘】，保存完成后返回此处点击第②步。`
      : "已在新标签页打开网盘，请点击【保存到我的网盘】，保存完成后返回此处点击第②步。",
  };
}

/**
 * 真实穿透刷新对应 AList 目录缓存
 */
async function triggerManualRefresh() {
  if (!isAuthenticated.value) {
    feedback.value = {
      success: false,
      message: "请先登录 PanHub 账号后执行穿透刷新。",
    };
    return;
  }
  if (!alistConfigured.value) {
    feedback.value = {
      success: false,
      message: "尚未配置 AList，无法执行目录穿透刷新，请先在【我的 NAS】中绑定 AList。",
    };
    return;
  }

  // 严格防呆拦截：若用户尚未点击打开网盘，给出醒目警示，消除“以为点击此按钮能替我存入网盘”的认知错位
  if (!userOpenedSharePage.value) {
    feedback.value = {
      success: false,
      message: "⚠️ 特别提醒：该按钮仅用于通知 AList 刷新影视海报墙，系统无法代替您向网盘转存文件！请务必先点击【① 打开网盘转存 (带提取码)】并在网盘官方网页中点击【保存到网盘】；若您此前已经在网盘中保存过了，请再次点击本按钮即可穿透刷新。",
    };
    userOpenedSharePage.value = true; // 允许第二次点击继续穿透刷新
    return;
  }

  refreshing.value = true;
  feedback.value = null;

  const targetPath = resolvedAlistPath.value || "/";

  try {
    const res = await $fetch<any>("/api/nas/refresh", {
      method: "POST",
      headers: getAuthHeaders(),
      body: {
        path: targetPath,
        url: props.item?.url || "",
      },
    });
    feedback.value = {
      success: true,
      message: res.message || `✅ AList 目录 [${res.path || targetPath}] 缓存已成功穿透刷新！若您已在网盘中点击了【保存】，芝杜海报墙此时已能秒播；若尚未保存，请先点击第①步打开网盘保存！`,
    };
  } catch (e: any) {
    let msg = e.data?.message || e.message || "刷新 AList 目录失败，请检查 AList 状态";
    if (typeof msg === "string" && (msg.includes("storage not found") || msg.includes("rawPath"))) {
      msg = `未在您的 AList 中检测到对应网盘的挂载点 [${targetPath}]。请确认已在 AList 后台完成该网盘的挂载。`;
    }
    feedback.value = {
      success: false,
      message: msg,
    };
  } finally {
    refreshing.value = false;
  }
}

async function executePush() {
  if (!props.item) return;
  pushing.value = true;
  feedback.value = null;

  try {
    const res = await $fetch<{ success: boolean; message: string; targetPath: string; protocol: string }>(
      "/api/nas/push",
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: {
          title: props.item.note || props.item.url,
          url: props.item.url,
          password: props.item.password,
          category: form.category,
          targetDir: form.targetDir,
          preferredClient: form.preferredClient,
        },
      }
    );

    feedback.value = {
      success: true,
      message: `${res.message} (落盘目录: ${res.targetPath})`,
    };

    setTimeout(() => {
      emit("success");
      emit("close");
      if (!isCloud.value) {
        nasTasksDrawerVisible.value = true;
      }
    }, 1500);

  } catch (err: any) {
    feedback.value = {
      success: false,
      message: err.data?.message || err.message || "推送失败，请检查 NAS 配置与连通性",
    };
  } finally {
    pushing.value = false;
  }
}
</script>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 100%;
  max-width: 480px;
  height: 100%;
  background: #18181b;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
  animation: slideLeft 0.25s ease-out;
}

@keyframes slideLeft {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nas-icon-badge {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.drawer-title {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 3px;
}

.drawer-subtitle {
  font-size: 11px;
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

.feedback-card {
  margin: 16px 20px 0;
  padding: 12px 14px;
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

.feedback-title {
  font-weight: 600;
  margin-bottom: 3px;
}

.drawer-body {
  padding: 20px 22px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.resource-preview {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px;
}

.res-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  line-height: 1.4;
  margin-bottom: 10px;
  word-break: break-all;
}

.res-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #d1d5db;
}

.meta-pill.highlight {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  font-weight: 500;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-label {
  font-size: 13px;
  font-weight: 600;
  color: #e5e7eb;
}

.reset-link {
  background: transparent;
  border: none;
  color: #10b981;
  font-size: 12px;
  cursor: pointer;
}

.category-chips {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.chip {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.chip.active {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
  color: #34d399;
  font-weight: 600;
}

.engine-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
}

.engine-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #d1d5db;
  cursor: pointer;
}

.input-box {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-family: monospace;
  outline: none;
}

.input-box:focus {
  border-color: #10b981;
}

.hint-text {
  font-size: 11px;
  color: #9ca3af;
  margin: 2px 0 0;
  line-height: 1.4;
}

.drawer-footer {
  padding: 16px 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  padding: 10px 16px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.push-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  color: #fff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.push-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
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

.primary-glow {
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
}

.z9x-card {
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.z9x-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.z9x-badge {
  font-size: 13px;
  font-weight: 700;
  color: #34d399;
}

.z9x-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
  font-weight: 500;
}

.transfer-card {
  background: rgba(56, 189, 248, 0.06);
  border-color: rgba(56, 189, 248, 0.25);
}

.transfer-badge {
  color: #38bdf8;
}

.transfer-tag {
  background: rgba(56, 189, 248, 0.18);
  color: #7dd3fc;
}

.target-storage-tag {
  margin-left: 8px;
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(56, 189, 248, 0.18);
  color: #38bdf8;
  border-radius: 4px;
  font-family: monospace;
}

.step-btn {
  font-size: 12px;
}

.z9x-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.step-num {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.25);
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

.step-text {
  font-size: 12px;
  color: #d1d5db;
  line-height: 1.5;
}

.step-text b {
  color: #34d399;
}

.transfer-notice {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  font-size: 11px;
  color: #fbbf24;
  line-height: 1.45;
}

.transfer-notice b {
  color: #fef3c7;
}

.quick-links {
  margin-top: 4px;
  display: flex;
  justify-content: flex-end;
}

.alist-link {
  font-size: 12px;
  color: #9ca3af;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color 0.2s;
}

.alist-link:hover {
  color: #34d399;
}

.gate-card {
  display: flex;
  gap: 14px;
  padding: 16px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.gate-card.unconfigured {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.25);
}

.gate-card.loading-gate {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.25);
  align-items: center;
}

.spinner-large {
  display: inline-block;
  width: 22px;
  height: 22px;
  border: 2.5px solid rgba(59, 130, 246, 0.3);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

.gate-icon {
  font-size: 24px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gate-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.gate-title {
  font-size: 14px;
  font-weight: 700;
  color: #f3f4f6;
}

.gate-desc {
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.5;
}

.gate-actions {
  margin-top: 8px;
}

.gate-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  border: none;
  background: #3b82f6;
  color: #fff;
  transition: opacity 0.2s;
}

.gate-btn:hover {
  opacity: 0.9;
}

.mount-path-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.preview-label {
  font-size: 11px;
  color: #9ca3af;
}

.preview-path {
  font-size: 11px;
  color: #34d399;
  font-family: monospace;
}

.mount-success-card {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.success-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.badge-success {
  font-size: 13px;
  font-weight: 700;
  color: #34d399;
}

.driver-name {
  font-size: 11px;
  color: #9ca3af;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
}

.mount-info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: #9ca3af;
}

.copyable-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.4);
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.code-val {
  font-size: 11px;
  color: #6ee7b7;
  font-family: monospace;
  word-break: break-all;
  flex: 1;
}

.mini-copy-btn {
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: #e5e7eb;
  font-size: 11px;
  cursor: pointer;
}

.files-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.files-title {
  font-size: 12px;
  font-weight: 600;
  color: #e5e7eb;
}

.files-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.files-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #d1d5db;
  background: rgba(255, 255, 255, 0.04);
  padding: 4px 8px;
  border-radius: 4px;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: #9ca3af;
  font-family: monospace;
  margin-left: 8px;
  flex-shrink: 0;
}

.success-actions {
  display: flex;
  justify-content: flex-end;
}

.open-alist-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  font-size: 12px;
  text-decoration: none;
  font-weight: 600;
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #d1d5db !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
}

.refresh-btn {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important;
}
</style>
