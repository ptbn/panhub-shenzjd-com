<template>
  <div class="admin-page">
    <div class="admin-header">
      <div class="header-left">
        <h1 class="page-title">PanHub 超级管理员控制台</h1>
        <p class="page-desc">全站用户生命周期 · 一次性邀请码分发 · NAS 推送全局审计 · 全站广播</p>
      </div>
      <div class="header-right">
        <button
          class="engine-badge-btn"
          :title="storageType === 'd1' ? '已启用 Cloudflare D1 永久关系型存储' : '当前为边缘混合缓存模式，点击查看 D1 1分钟绑定指南'"
          @click="showD1Modal = true">
          <span v-if="storageType === 'd1'" class="badge-d1">
            <span class="dot dot-green"></span>
            D1 永久关系型存储
          </span>
          <span v-else class="badge-edge">
            <span class="dot dot-amber"></span>
            边缘韧性缓存模式 (可配置D1)
          </span>
        </button>
        <NuxtLink to="/" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          返回搜索首页
        </NuxtLink>
      </div>
    </div>

    <!-- 顶部导航选项卡 -->
    <div class="admin-tabs">
      <button
        :class="['admin-tab', { active: activeTab === 'users' }]"
        @click="activeTab = 'users'">
        👥 用户管理 ({{ users.length }})
      </button>
      <button
        :class="['admin-tab', { active: activeTab === 'invites' }]"
        @click="activeTab = 'invites'">
        🎟️ 邀请码管理 ({{ invites.length }})
      </button>
      <button
        :class="['admin-tab', { active: activeTab === 'logs' }]"
        @click="activeTab = 'logs'">
        📊 全局推送审计 ({{ logs.length }})
      </button>
      <button
        :class="['admin-tab', { active: activeTab === 'broadcast' }]"
        @click="activeTab = 'broadcast'">
        📢 全站公告广播
      </button>
    </div>

    <!-- 提示消息 -->
    <div v-if="toastMessage" class="toast-bar">
      {{ toastMessage }}
    </div>

    <!-- TAB 1: 用户管理 -->
    <div v-if="activeTab === 'users'" class="tab-content">
      <div class="toolbar">
        <button class="primary-btn" @click="showAddUserModal = true">
          + 录入 / 直接添加新用户
        </button>
      </div>

      <div class="card-panel">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>已绑定 NAS</th>
                <th>最后活跃</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td class="font-medium text-white">{{ u.username }}</td>
                <td class="text-gray-400">{{ u.email }}</td>
                <td>
                  <span :class="['badge', u.role === 'admin' ? 'badge-admin' : 'badge-user']">
                    {{ u.role === 'admin' ? '超级管理员' : '普通用户' }}
                  </span>
                </td>
                <td>
                  <span :class="['badge', u.status === 'active' ? 'badge-active' : 'badge-frozen']">
                    {{ u.status === 'active' ? '正常' : '已冻结' }}
                  </span>
                </td>
                <td>
                  <span v-if="u.nasConfigured" class="text-emerald-400 font-mono text-xs">
                    ✓ {{ u.nasName || '已配置' }}
                  </span>
                  <span v-else class="text-gray-500 text-xs">未配置</span>
                </td>
                <td class="text-xs text-gray-400">{{ formatDate(u.lastActiveAt) }}</td>
                <td class="action-cell">
                  <button
                    v-if="u.status === 'active'"
                    class="btn-sm btn-warn"
                    @click="updateUserStatus(u.id, 'freeze')">
                    冻结
                  </button>
                  <button
                    v-else
                    class="btn-sm btn-success"
                    @click="updateUserStatus(u.id, 'unfreeze')">
                    解冻
                  </button>
                  <button
                    class="btn-sm btn-secondary"
                    @click="resetUserPassword(u.id)">
                    重置密码
                  </button>
                  <button
                    class="btn-sm btn-danger"
                    @click="deleteUser(u.id)">
                    注销
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: 邀请码管理 -->
    <div v-else-if="activeTab === 'invites'" class="tab-content">
      <div class="toolbar">
        <button class="primary-btn" @click="generateNewInvite">
          + 一键生成 8 位邀请码（1小时有效）
        </button>
        <button class="secondary-btn" @click="importManualInvite">
          + 录入已有邀请码
        </button>
      </div>

      <div class="card-panel">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>邀请码</th>
                <th>创建时间</th>
                <th>有效截止</th>
                <th>状态</th>
                <th>使用时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in invites" :key="inv.code">
                <td class="font-mono text-emerald-400 font-bold text-base tracking-wider">{{ inv.code }}</td>
                <td class="text-xs text-gray-400">{{ formatDate(inv.createdAt) }}</td>
                <td class="text-xs text-gray-400">{{ inv.expiresAt ? formatDate(inv.expiresAt) : '1小时有效' }}</td>
                <td>
                  <span v-if="inv.isRevoked" class="badge badge-frozen">已作废</span>
                  <span v-else-if="inv.usedBy" class="badge badge-user">已使用</span>
                  <span v-else-if="inv.expiresAt && Date.now() > inv.expiresAt" class="badge badge-frozen">已过期</span>
                  <span v-else class="badge badge-active">有效待使用</span>
                </td>
                <td class="text-xs text-gray-400">{{ inv.usedAt ? formatDate(inv.usedAt) : '-' }}</td>
                <td class="action-cell">
                  <button
                    v-if="!inv.usedBy && !inv.isRevoked && (!inv.expiresAt || Date.now() <= inv.expiresAt)"
                    class="btn-sm btn-secondary"
                    @click="copyInviteLink(inv.code)">
                    复制邀请链接
                  </button>
                  <button
                    v-if="!inv.usedBy && !inv.isRevoked && (!inv.expiresAt || Date.now() <= inv.expiresAt)"
                    class="btn-sm btn-warn"
                    @click="revokeInvite(inv.code)">
                    作废
                  </button>
                  <span v-else class="text-xs text-gray-500">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: 全局推送审计历史 -->
    <div v-else-if="activeTab === 'logs'" class="tab-content">
      <div class="card-panel">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>推送时间</th>
                <th>用户</th>
                <th>资源标题</th>
                <th>协议</th>
                <th>目标设备</th>
                <th>目标目录</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id">
                <td class="text-xs text-gray-400">{{ formatDate(log.createdAt) }}</td>
                <td class="text-white">{{ log.username }}</td>
                <td class="text-gray-300 max-w-xs truncate" :title="log.title">{{ log.title }}</td>
                <td>
                  <span class="font-mono text-xs uppercase px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    {{ log.protocol }}
                  </span>
                </td>
                <td class="text-xs text-gray-400">{{ log.targetDevice }}</td>
                <td class="text-xs font-mono text-gray-400">{{ log.targetPath }}</td>
                <td>
                  <span :class="['badge', log.status === 'success' ? 'badge-active' : 'badge-frozen']">
                    {{ log.status === 'success' ? '成功送达' : '失败' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: 全站公告广播 -->
    <div v-else class="tab-content">
      <div class="card-panel max-w-xl">
        <h3 class="panel-title">发布全站置顶广播公告</h3>
        <p class="panel-desc">发布后将立即在全站顶部向所有登录用户呈现，支持告知家庭宽带升级、NAS 维护等通知。</p>

        <div class="form-item mb-4">
          <label class="block text-sm font-medium mb-1 text-gray-300">公告内容</label>
          <textarea
            v-model="broadcastContent"
            rows="3"
            class="w-full p-3 rounded-lg bg-black/40 border border-white/12 text-white outline-none focus:border-emerald-500"
            placeholder="例如: 今晚 23:00 家庭宽带进行带宽扩容维护，NAS 离线下载可能稍有延迟。"></textarea>
        </div>

        <div class="flex items-center gap-2 mb-6">
          <input
            id="broadcast-enable"
            v-model="broadcastEnabled"
            type="checkbox"
            class="rounded border-white/20" />
          <label for="broadcast-enable" class="text-sm text-gray-300">启用全站横幅展示</label>
        </div>

        <button class="primary-btn" @click="saveBroadcast">
          保存并立即发布广播
        </button>
      </div>
    </div>

    <!-- 直接创建/录入用户弹窗 -->
    <div v-if="showAddUserModal" class="modal-overlay" @click.self="showAddUserModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">快速录入 / 添加新用户</h3>
          <button class="modal-close" @click="showAddUserModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">
            管理员可直接录入或创建用户账号，无需填写邀请码。录入后用户可立即使用账号密码登录，数据将在本地与服务端双向固化。
          </p>
          <div class="mb-4">
            <label class="block text-xs font-medium text-gray-300 mb-1">登录邮箱 *</label>
            <input
              v-model="newUserForm.email"
              type="email"
              class="w-full p-2.5 rounded-lg bg-black/40 border border-white/15 text-white text-sm outline-none focus:border-emerald-500"
              placeholder="例如: friend@example.com" />
          </div>
          <div class="mb-4">
            <label class="block text-xs font-medium text-gray-300 mb-1">用户名 *</label>
            <input
              v-model="newUserForm.username"
              type="text"
              class="w-full p-2.5 rounded-lg bg-black/40 border border-white/15 text-white text-sm outline-none focus:border-emerald-500"
              placeholder="例如: 家庭成员" />
          </div>
          <div class="mb-4">
            <label class="block text-xs font-medium text-gray-300 mb-1">登录密码 (留空自动生成)</label>
            <input
              v-model="newUserForm.password"
              type="text"
              class="w-full p-2.5 rounded-lg bg-black/40 border border-white/15 text-white text-sm outline-none focus:border-emerald-500 font-mono"
              placeholder="至少 6 位字符，留空则随机生成" />
          </div>
          <div class="mb-5">
            <label class="block text-xs font-medium text-gray-300 mb-1">用户角色</label>
            <select
              v-model="newUserForm.role"
              class="w-full p-2.5 rounded-lg bg-black/40 border border-white/15 text-white text-sm outline-none focus:border-emerald-500">
              <option value="user">普通用户</option>
              <option value="admin">超级管理员</option>
            </select>
          </div>
        </div>
        <div class="modal-footer flex items-center justify-end gap-3">
          <button class="secondary-btn" @click="showAddUserModal = false">取消</button>
          <button
            class="primary-btn"
            :disabled="submittingUser"
            @click="submitCreateUser">
            {{ submittingUser ? '正在创建...' : '立即确认创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- D1 数据库绑定指导弹窗 -->
    <div v-if="showD1Modal" class="modal-overlay" @click.self="showD1Modal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Cloudflare D1 关系型数据库配置指南</h3>
          <button class="modal-close" @click="showD1Modal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">
            当前系统运行在<strong>边缘多节点韧性缓存模式</strong>（数据已通过自包含 HMAC 加密验签与浏览器离线镜像保护，刷新绝不丢失）。
            若希望升级为 100% 永久服务器端 SQLite 关系型存储，仅需在 Cloudflare 控制台添加 <strong>D1 数据库绑定</strong>：
          </p>
          <ol class="step-list">
            <li>
              <strong>1. 创建 D1 数据库</strong>：
              登录 Cloudflare Dashboard -> 侧边栏「存储和数据库」->「D1 SQL 数据库」-> 点击「创建数据库」，名称填写 <code>panhub-db</code>。
            </li>
            <li>
              <strong>2. 绑定到当前 Pages 项目</strong>：
              进入「Workers 和 Pages」-> 点击当前项目 <code>panhub-shenzjd-com</code> ->「设置 (Settings)」->「函数 (Functions)」-> 找到「D1 数据库绑定」-> 点击「添加绑定」：
              <div class="code-box">
                变量名称 (Variable name): <code>DB</code><br />
                D1 数据库: 选择 <code>panhub-db</code>
              </div>
            </li>
            <li>
              <strong>3. 重新部署生效</strong>：
              点击「保存」，并触发一次项目部署（或重新推送 main 分支）。系统将全自动建表并永久持久化！
            </li>
          </ol>
        </div>
        <div class="modal-footer">
          <button class="primary-btn" @click="showD1Modal = false">我已了解</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const activeTab = ref<"users" | "invites" | "logs" | "broadcast">("users");
const users = ref<any[]>([]);
const invites = ref<any[]>([]);
const logs = ref<any[]>([]);
const broadcastContent = ref("");
const broadcastEnabled = ref(true);
const toastMessage = ref("");
const storageType = ref<"d1" | "memory">("memory");
const showD1Modal = ref(false);
const showAddUserModal = ref(false);
const submittingUser = ref(false);
const newUserForm = reactive({
  email: "",
  username: "",
  password: "",
  role: "user" as "user" | "admin",
});

const STORAGE_KEY_INVITES = "panhub_admin_invites_v1";
const STORAGE_KEY_USERS = "panhub_admin_users_v1";

function showToast(msg: string) {
  toastMessage.value = msg;
  setTimeout(() => {
    toastMessage.value = "";
  }, 4000);
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeInvites(current: any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  for (const inv of current) {
    if (inv?.code) map.set(inv.code.toUpperCase().trim(), { ...inv });
  }
  for (const inv of incoming) {
    if (!inv?.code) continue;
    const code = inv.code.toUpperCase().trim();
    const prev = map.get(code);
    map.set(code, {
      ...prev,
      ...inv,
      usedBy: inv.usedBy || prev?.usedBy || null,
      usedAt: inv.usedAt || prev?.usedAt || null,
      isRevoked: inv.isRevoked || prev?.isRevoked ? 1 : 0,
    });
  }
  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function mergeUsers(current: any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  for (const u of current) {
    if (u?.id) map.set(u.id, { ...u });
  }
  for (const u of incoming) {
    if (!u?.id) continue;
    const prev = map.get(u.id);
    map.set(u.id, { ...prev, ...u });
  }
  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function loadData() {
  // 1. 本地 LocalStorage 优先秒开回显
  if (import.meta.client) {
    try {
      const cInv = localStorage.getItem(STORAGE_KEY_INVITES);
      if (cInv) invites.value = mergeInvites(invites.value, JSON.parse(cInv));
      const cUsers = localStorage.getItem(STORAGE_KEY_USERS);
      if (cUsers) users.value = mergeUsers(users.value, JSON.parse(cUsers));
    } catch {}
  }

  // 2. 双向同步拉取
  try {
    const t = Date.now();
    const [uRes, iRes, lRes] = await Promise.all([
      $fetch<{ users: any[]; storageType?: string }>(`/api/admin/users/sync`, {
        method: "POST",
        body: { knownUsers: users.value },
      }).catch(() => $fetch<{ users: any[]; storageType?: string }>(`/api/admin/users?_t=${t}`)),
      $fetch<{ invites: any[] }>(`/api/admin/invites/sync`, {
        method: "POST",
        body: { knownInvites: invites.value },
      }).catch(() => $fetch<{ invites: any[] }>(`/api/admin/invites?_t=${t}`)),
      $fetch<{ logs: any[] }>(`/api/admin/history?_t=${t}`).catch(() => ({ logs: [] })),
    ]);

    if (uRes?.users) {
      users.value = mergeUsers(users.value, uRes.users);
      if (import.meta.client) {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users.value));
      }
    }
    if (iRes?.invites) {
      invites.value = mergeInvites(invites.value, iRes.invites);
      if (import.meta.client) {
        localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(invites.value));
      }
    }
    if (lRes?.logs) {
      logs.value = lRes.logs;
    }
    if (uRes?.storageType) {
      storageType.value = uRes.storageType === "d1" ? "d1" : "memory";
    }
  } catch (e: any) {
    console.error("加载管理数据失败:", e);
  }
}

onMounted(() => {
  loadData();
});

async function updateUserStatus(userId: string, action: "freeze" | "unfreeze") {
  try {
    await $fetch(`/api/admin/users/${userId}/status`, {
      method: "POST",
      body: { action },
    });
    showToast(action === "freeze" ? "用户已冻结" : "用户已解冻");
    const target = users.value.find((u) => u.id === userId);
    if (target) {
      target.status = action === "freeze" ? "frozen" : "active";
      if (import.meta.client) {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users.value));
      }
    }
    await loadData();
  } catch (err: any) {
    showToast(err.data?.message || err.message || "操作失败");
  }
}

async function deleteUser(userId: string) {
  if (!confirm("确认注销该用户账号吗？其绑定的 NAS 配置将被一并清理。")) return;
  try {
    await $fetch(`/api/admin/users/${userId}/status`, {
      method: "POST",
      body: { action: "delete" },
    });
    showToast("用户账号已注销");
    users.value = users.value.filter((u) => u.id !== userId);
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users.value));
    }
    await loadData();
  } catch (err: any) {
    showToast(err.data?.message || err.message || "注销失败");
  }
}

async function resetUserPassword(userId: string) {
  const newPass = prompt("请输入为该用户设置的新密码（留空则自动生成临时密码）：");
  if (newPass === null) return;
  try {
    const res = await $fetch<{ temporaryPassword?: string }>(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: { newPassword: newPass.trim() || undefined },
    });
    alert(`密码已重置！临时密码为: ${res.temporaryPassword}`);
    await loadData();
  } catch (err: any) {
    showToast(err.data?.message || err.message || "重置密码失败");
  }
}

async function submitCreateUser() {
  if (!newUserForm.email.trim() || !newUserForm.username.trim()) {
    showToast("请填写完整的邮箱与用户名");
    return;
  }
  submittingUser.value = true;
  try {
    const res = await $fetch<{ success: boolean; user: any; password: string }>("/api/admin/users", {
      method: "POST",
      body: newUserForm,
    });
    showToast(`成功创建用户 ${res.user.username}！`);
    users.value = mergeUsers(users.value, [res.user]);
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users.value));
    }
    showAddUserModal.value = false;
    const credInfo = `用户创建/录入成功！\n\n邮箱: ${res.user.email}\n密码: ${res.password}\n\n请保存此凭据以供用户登录。`;
    newUserForm.email = "";
    newUserForm.username = "";
    newUserForm.password = "";
    newUserForm.role = "user";
    alert(credInfo);
    await loadData();
  } catch (err: any) {
    showToast(err.data?.message || err.message || "创建用户失败");
  } finally {
    submittingUser.value = false;
  }
}

async function generateNewInvite() {
  try {
    const res = await $fetch<{ invite: any }>("/api/admin/invites", { method: "POST" });
    showToast(`成功生成 8 位邀请码: ${res.invite.code}（1小时内有效）`);
    invites.value = mergeInvites(invites.value, [res.invite]);
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(invites.value));
    }
    await loadData();
  } catch (err: any) {
    showToast(err.data?.message || err.message || "生成邀请码失败");
  }
}

async function importManualInvite() {
  const raw = prompt("请输入要录入的 8 位邀请码（支持粘贴完整邀请链接）：");
  if (!raw) return;
  let code = raw.trim();
  if (code.includes("invite=")) {
    try {
      const u = new URL(code, "https://dummy.local");
      code = u.searchParams.get("invite") || code;
    } catch {}
  }
  code = code.toUpperCase().trim();
  if (!code || code.length !== 8) {
    showToast("邀请码格式错误，应为 8 位字符");
    return;
  }
  try {
    const res = await $fetch<{ invites: any[] }>("/api/admin/invites/sync", {
      method: "POST",
      body: {
        knownInvites: [
          {
            code,
            createdBy: "admin",
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000,
            isRevoked: 0,
            usedBy: null,
            usedAt: null,
          },
        ],
      },
    });
    showToast(`邀请码 ${code} 已成功录入与同步！`);
    if (res?.invites) {
      invites.value = mergeInvites(invites.value, res.invites);
      if (import.meta.client) {
        localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(invites.value));
      }
    }
  } catch (err: any) {
    showToast(err.data?.message || err.message || "录入失败，可能该邀请码签名无效");
  }
}

async function revokeInvite(code: string) {
  try {
    await $fetch(`/api/admin/invites/${code}/revoke`, { method: "POST" });
    showToast(`邀请码 ${code} 已作废`);
    const target = invites.value.find((i) => i.code === code);
    if (target) target.isRevoked = 1;
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(invites.value));
    }
    await loadData();
  } catch (err: any) {
    showToast(err.data?.message || err.message || "作废失败");
  }
}

function copyInviteLink(code: string) {
  const origin = window.location.origin;
  const link = `${origin}/auth/login?invite=${code}`;
  navigator.clipboard.writeText(link);
  showToast(`邀请链接已复制到剪贴板！(码: ${code})`);
}

async function saveBroadcast() {
  try {
    await $fetch("/api/admin/broadcast", {
      method: "POST",
      body: {
        content: broadcastContent.value,
        enabled: broadcastEnabled.value,
      },
    });
    showToast("全站公告已保存生效！");
  } catch (err: any) {
    showToast(err.data?.message || err.message || "保存失败");
  }
}
</script>

<style scoped>
.admin-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px 60px;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 6px;
}

.page-desc {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #10b981;
  font-size: 13px;
  text-decoration: none;
}

.admin-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 24px;
  overflow-x: auto;
}

.admin-tab {
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
}

.admin-tab.active {
  color: #10b981;
  border-bottom-color: #10b981;
  font-weight: 600;
}

.toast-bar {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #34d399;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 18px;
}

.card-panel {
  background: rgba(26, 26, 26, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.toolbar {
  margin-bottom: 16px;
}

.primary-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
  border: none;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.table-responsive {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.data-table th {
  padding: 12px 14px;
  color: #9ca3af;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.action-cell {
  display: flex;
  gap: 6px;
  align-items: center;
}

.btn-sm {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn-warn {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}

.btn-success {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.3);
  color: #34d399;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: #e5e7eb;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.badge-admin {
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.badge-user {
  background: rgba(255, 255, 255, 0.08);
  color: #d1d5db;
}

.badge-active {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.badge-frozen {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.engine-badge-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.engine-badge-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
}

.badge-d1 {
  color: #34d399;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-edge {
  color: #fbbf24;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.dot-green {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
}

.dot-amber {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #e5e7eb;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  margin-left: 10px;
  transition: all 0.2s;
}

.secondary-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-card {
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  max-width: 580px;
  width: 100%;
  padding: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.modal-close {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}

.modal-close:hover {
  color: #fff;
}

.modal-desc {
  font-size: 13px;
  color: #d1d5db;
  line-height: 1.6;
  margin-bottom: 16px;
}

.step-list {
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 20px;
}

.step-list li {
  line-height: 1.6;
}

.step-list strong {
  color: #f3f4f6;
}

.code-box {
  margin-top: 6px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-family: monospace;
  color: #34d399;
  font-size: 12px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
