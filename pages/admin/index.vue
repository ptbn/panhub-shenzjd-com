<template>
  <div class="admin-page">
    <div class="admin-header">
      <div class="header-left">
        <h1 class="page-title">PanHub 超级管理员控制台</h1>
        <p class="page-desc">全站用户生命周期 · 一次性邀请码分发 · NAS 推送全局审计 · 全站广播</p>
      </div>
      <NuxtLink to="/" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        返回搜索首页
      </NuxtLink>
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
          + 一键生成 8 位一次性邀请码
        </button>
      </div>

      <div class="card-panel">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>邀请码</th>
                <th>创建时间</th>
                <th>状态</th>
                <th>使用时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in invites" :key="inv.code">
                <td class="font-mono text-emerald-400 font-bold text-base tracking-wider">{{ inv.code }}</td>
                <td class="text-xs text-gray-400">{{ formatDate(inv.createdAt) }}</td>
                <td>
                  <span v-if="inv.isRevoked" class="badge badge-frozen">已作废</span>
                  <span v-else-if="inv.usedBy" class="badge badge-user">已使用</span>
                  <span v-else class="badge badge-active">有效待使用</span>
                </td>
                <td class="text-xs text-gray-400">{{ inv.usedAt ? formatDate(inv.usedAt) : '-' }}</td>
                <td class="action-cell">
                  <button
                    v-if="!inv.usedBy && !inv.isRevoked"
                    class="btn-sm btn-secondary"
                    @click="copyInviteLink(inv.code)">
                    复制邀请链接
                  </button>
                  <button
                    v-if="!inv.usedBy && !inv.isRevoked"
                    class="btn-sm btn-warn"
                    @click="revokeInvite(inv.code)">
                    作废
                  </button>
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

async function loadData() {
  try {
    const [uRes, iRes, lRes] = await Promise.all([
      $fetch<{ users: any[] }>("/api/admin/users"),
      $fetch<{ invites: any[] }>("/api/admin/invites"),
      $fetch<{ logs: any[] }>("/api/admin/history"),
    ]);
    users.value = uRes.users;
    invites.value = iRes.invites;
    logs.value = lRes.logs;
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

async function generateNewInvite() {
  try {
    const res = await $fetch<{ invite: any }>("/api/admin/invites", { method: "POST" });
    showToast(`成功生成 8 位邀请码: ${res.invite.code}`);
    await loadData();
  } catch (err: any) {
    showToast(err.data?.message || err.message || "生成邀请码失败");
  }
}

async function revokeInvite(code: string) {
  try {
    await $fetch(`/api/admin/invites/${code}/revoke`, { method: "POST" });
    showToast(`邀请码 ${code} 已作废`);
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
</style>
