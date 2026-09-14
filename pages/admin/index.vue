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
      <div class="toolbar user-toolbar">
        <button class="primary-btn add-user-btn" @click="openAddUserModal">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          <span>快速录入新用户</span>
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

    <!-- 直接创建/录入用户弹窗 (全要素 Apple/Linear 现代化美学重塑) -->
    <Transition name="modal-spring">
      <div v-if="showAddUserModal" class="modal-overlay" @click.self="closeAddUserModal">
        <div class="modal-card user-modal-card">
          <!-- 弹窗顶栏 -->
          <div class="modal-header">
            <div class="header-left-group">
              <div class="modal-badge-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
              <div>
                <h3 class="modal-title">快速录入 / 签发新用户</h3>
                <p class="modal-subtitle">直接创建专属账户，免邀请码即刻生效并固化至边缘节点</p>
              </div>
            </div>
            <button class="modal-close" title="关闭" @click="closeAddUserModal">✕</button>
          </div>

          <!-- 模式 1：用户信息录入表单 -->
          <div v-if="!createdCredential" class="modal-body user-modal-body">
            <!-- 登录邮箱 -->
            <div class="form-group">
              <label class="form-label">
                <span>登录邮箱</span>
                <span class="required-star">*</span>
              </label>
              <div class="input-icon-wrap">
                <span class="input-addon-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
                  </svg>
                </span>
                <input
                  v-model="newUserForm.email"
                  type="email"
                  class="modal-input"
                  placeholder="例如: friend@taogehome.cloud"
                  autocomplete="off" />
              </div>
            </div>

            <!-- 用户名 -->
            <div class="form-group">
              <label class="form-label">
                <span>用户名称 / 昵称</span>
                <span class="required-star">*</span>
              </label>
              <div class="input-icon-wrap">
                <span class="input-addon-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  v-model="newUserForm.username"
                  type="text"
                  class="modal-input"
                  placeholder="例如: 家庭成员 / 极客影友"
                  autocomplete="off" />
              </div>
            </div>

            <!-- 登录密码 -->
            <div class="form-group">
              <div class="flex-between">
                <label class="form-label">
                  <span>登录密码</span>
                  <span class="label-hint">(留空则自动生成 8 位强密码)</span>
                </label>
                <button type="button" class="btn-text-magic" @click="generateRandomPassword">
                  ✨ 随机生成高强密码
                </button>
              </div>
              <div class="input-icon-wrap">
                <span class="input-addon-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  v-model="newUserForm.password"
                  :type="showPassword ? 'text' : 'password'"
                  class="modal-input mono-font"
                  placeholder="至少 6 位字符，或点击上方随机生成"
                  autocomplete="new-password" />
                <button
                  type="button"
                  class="input-action-icon"
                  :title="showPassword ? '隐藏密码' : '查看密码'"
                  @click="showPassword = !showPassword">
                  <svg v-if="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 用户角色与特权卡片 -->
            <div class="form-group">
              <label class="form-label">分配用户角色与系统权限</label>
              <div class="role-grid">
                <div
                  class="role-card"
                  :class="{ active: newUserForm.role === 'user' }"
                  @click="newUserForm.role = 'user'">
                  <div class="role-radio-indicator">
                    <div class="role-radio-inner" />
                  </div>
                  <div class="role-content">
                    <div class="role-title-row">
                      <span class="role-icon">👤</span>
                      <span class="role-title">普通用户</span>
                      <span class="role-tag tag-user">标准权限</span>
                    </div>
                    <p class="role-desc">
                      可使用全网影视搜索、网盘检索与直达、字幕下载，支持自主配置并调度个人 NAS 离线下载。
                    </p>
                  </div>
                </div>

                <div
                  class="role-card"
                  :class="{ active: newUserForm.role === 'admin' }"
                  @click="newUserForm.role = 'admin'">
                  <div class="role-radio-indicator">
                    <div class="role-radio-inner" />
                  </div>
                  <div class="role-content">
                    <div class="role-title-row">
                      <span class="role-icon">🛡️</span>
                      <span class="role-title">超级管理员</span>
                      <span class="role-tag tag-admin">系统特权</span>
                    </div>
                    <p class="role-desc">
                      除全部搜索功能外，拥有最高控制权，可管理全局用户、生成邀请码、广播公告及配置数据库。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 模式 2：开通成功凭单卡 (Success Credentials Receipt) -->
          <div v-else class="modal-body success-receipt-body">
            <div class="receipt-celebrate">
              <div class="celebrate-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h4 class="celebrate-title">用户开通成功！</h4>
              <p class="celebrate-subtitle">账号已即时持久化并同步至边缘节点，请妥善分发以下登录凭据：</p>
            </div>

            <div class="credentials-card">
              <div class="cred-row">
                <span class="cred-label">用户名</span>
                <span class="cred-value font-medium">{{ createdCredential.username }}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">登录邮箱</span>
                <span class="cred-value cred-copyable" @click="copyText(createdCredential.email, '邮箱')">
                  {{ createdCredential.email }}
                  <svg class="copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </span>
              </div>
              <div class="cred-row">
                <span class="cred-label">登录密码</span>
                <span class="cred-value cred-password cred-copyable" @click="copyText(createdCredential.password, '密码')">
                  <span class="mono-font">{{ createdCredential.password }}</span>
                  <svg class="copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </span>
              </div>
              <div class="cred-row">
                <span class="cred-label">用户角色</span>
                <span :class="['badge', createdCredential.role === 'admin' ? 'badge-admin' : 'badge-user']">
                  {{ createdCredential.role === 'admin' ? '超级管理员' : '普通用户' }}
                </span>
              </div>
              <div class="cred-row">
                <span class="cred-label">登录入口</span>
                <span class="cred-value text-emerald-400 text-xs font-mono">/auth/login</span>
              </div>
            </div>
          </div>

          <!-- 弹窗底栏操作 -->
          <div class="modal-footer user-modal-footer">
            <template v-if="!createdCredential">
              <button type="button" class="btn-ghost" @click="closeAddUserModal">
                取消
              </button>
              <button
                type="button"
                class="btn-primary-gradient"
                :disabled="submittingUser"
                @click="submitCreateUser">
                <span v-if="submittingUser">⚡ 正在创建与同步...</span>
                <span v-else>立即确认创建</span>
              </button>
            </template>
            <template v-else>
              <button type="button" class="btn-ghost" @click="resetNewUserForm">
                + 继续录入
              </button>
              <button type="button" class="btn-primary-gradient" @click="copyAllCredentials">
                📋 一键复制全部凭据
              </button>
              <button type="button" class="btn-secondary-simple" @click="closeAddUserModal">
                完成
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>

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
const showPassword = ref(false);
const createdCredential = ref<{ email: string; username: string; password: string; role: string } | null>(null);
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

function openAddUserModal() {
  createdCredential.value = null;
  newUserForm.email = "";
  newUserForm.username = "";
  newUserForm.password = "";
  newUserForm.role = "user";
  showPassword.value = false;
  showAddUserModal.value = true;
}

function closeAddUserModal() {
  showAddUserModal.value = false;
  createdCredential.value = null;
}

function resetNewUserForm() {
  createdCredential.value = null;
  newUserForm.email = "";
  newUserForm.username = "";
  newUserForm.password = "";
  newUserForm.role = "user";
  showPassword.value = false;
}

function generateRandomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  let pass = "";
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  newUserForm.password = pass;
  showPassword.value = true;
  showToast("已自动生成高强度随机密码");
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`已复制${label}到剪贴板！`);
  } catch {
    showToast(`复制失败，请手动选择复制`);
  }
}

async function copyAllCredentials() {
  if (!createdCredential.value) return;
  const text = [
    "【PanHub 私有云中枢 - 账户开通凭据】",
    `用户名: ${createdCredential.value.username}`,
    `登录邮箱: ${createdCredential.value.email}`,
    `登录密码: ${createdCredential.value.password}`,
    `用户角色: ${createdCredential.value.role === "admin" ? "超级管理员" : "普通用户"}`,
    `登录入口: https://pan.taogehome.cloud/auth/login`,
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制全部账号信息，可直接粘贴发送给用户！");
  } catch {
    showToast("复制失败，请手动复制");
  }
}

async function submitCreateUser() {
  const cleanEmail = newUserForm.email.trim().toLowerCase();
  const cleanUsername = newUserForm.username.trim();
  if (!cleanEmail || !cleanUsername) {
    showToast("请填写完整的邮箱与用户名");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    showToast("请输入有效格式的电子邮箱");
    return;
  }

  submittingUser.value = true;
  try {
    const res = await $fetch<{ success: boolean; user: any; password: string }>("/api/admin/users", {
      method: "POST",
      body: {
        email: cleanEmail,
        username: cleanUsername,
        password: newUserForm.password.trim(),
        role: newUserForm.role,
      },
    });
    showToast(`成功签发用户 ${res.user.username}！`);
    users.value = mergeUsers(users.value, [res.user]);
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users.value));
    }
    createdCredential.value = {
      email: res.user.email,
      username: res.user.username,
      password: res.password,
      role: res.user.role,
    };
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

/* 用户录入弹窗 (Apple / Linear 现代化美学风格体系) */
.user-toolbar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.add-user-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.add-user-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
}

.user-modal-card {
  max-width: 580px;
  background: linear-gradient(145deg, rgba(24, 24, 28, 0.95), rgba(15, 17, 23, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 0 32px -4px rgba(16, 185, 129, 0.12);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  padding: 24px;
}

.header-left-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-badge-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1));
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 16px rgba(16, 185, 129, 0.25);
}

.modal-subtitle {
  font-size: 12px;
  color: #9ca3af;
  margin: 3px 0 0;
  line-height: 1.4;
}

.user-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 10px 0 4px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: #d1d5db;
  display: flex;
  align-items: center;
  gap: 4px;
}

.required-star {
  color: #ef4444;
  font-weight: 700;
}

.label-hint {
  font-size: 11px;
  font-weight: 400;
  color: #6b7280;
  margin-left: 4px;
}

.btn-text-magic {
  background: transparent;
  border: none;
  font-size: 11px;
  color: #10b981;
  cursor: pointer;
  font-weight: 600;
  padding: 0;
  transition: color 0.2s;
}

.btn-text-magic:hover {
  color: #34d399;
}

.input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-addon-icon {
  position: absolute;
  left: 12px;
  color: #6b7280;
  pointer-events: none;
  display: flex;
  align-items: center;
}

.modal-input {
  width: 100%;
  padding: 10px 14px 10px 38px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.modal-input:focus {
  border-color: #10b981;
  background: rgba(0, 0, 0, 0.65);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
}

.modal-input::placeholder {
  color: #4b5563;
}

.mono-font {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.5px;
}

.input-action-icon {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.input-action-icon:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.role-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 640px) {
  .role-grid {
    grid-template-columns: 1fr;
  }
}

.role-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.role-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}

.role-card.active {
  background: linear-gradient(145deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04));
  border-color: rgba(16, 185, 129, 0.45);
  box-shadow: 0 0 20px -4px rgba(16, 185, 129, 0.2);
}

.role-radio-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  flex-shrink: 0;
  transition: all 0.2s;
}

.role-card.active .role-radio-indicator {
  border-color: #10b981;
}

.role-card.active .role-radio-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
}

.role-content {
  flex: 1;
}

.role-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.role-title {
  font-size: 13px;
  font-weight: 600;
  color: #f3f4f6;
}

.role-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.tag-user {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.tag-admin {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.role-desc {
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.45;
  margin: 0;
}

/* 成功凭单卡 (Credentials Receipt) */
.success-receipt-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 8px 0 4px;
}

.receipt-celebrate {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.celebrate-badge {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.1));
  border: 2px solid rgba(16, 185, 129, 0.5);
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 24px rgba(16, 185, 129, 0.4);
  margin-bottom: 8px;
}

.celebrate-title {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.celebrate-subtitle {
  font-size: 12px;
  color: #9ca3af;
  margin: 4px 0 0;
}

.credentials-card {
  width: 100%;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

.cred-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.cred-label {
  color: #9ca3af;
  font-size: 12px;
}

.cred-value {
  color: #f3f4f6;
}

.cred-copyable {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #34d399;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(16, 185, 129, 0.08);
  transition: all 0.2s;
}

.cred-copyable:hover {
  background: rgba(16, 185, 129, 0.2);
}

.cred-password {
  background: rgba(245, 158, 11, 0.1);
  color: #fbbf24;
}

.cred-password:hover {
  background: rgba(245, 158, 11, 0.2);
}

.copy-icon {
  opacity: 0.7;
  transition: opacity 0.2s;
}

.cred-copyable:hover .copy-icon {
  opacity: 1;
}

.user-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

.btn-primary-gradient {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
  border: none;
  padding: 9px 20px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
  transition: all 0.2s;
}

.btn-primary-gradient:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-primary-gradient:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
  color: #9ca3af;
  border: none;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ghost:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.btn-secondary-simple {
  background: rgba(255, 255, 255, 0.08);
  color: #e5e7eb;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary-simple:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* 弹窗弹簧缩放过渡动效 */
.modal-spring-enter-active,
.modal-spring-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-spring-enter-from,
.modal-spring-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}
</style>
