<template>
  <div class="home">
    <!-- 智能紧凑吸顶搜索与筛选胶囊 (Smart Compact Sticky Bar) -->
    <CompactStickyBar
      :active="isStickyActive"
      :kw="kw"
      :loading="searchState.loading"
      :searched="searched"
      :total-filtered-count="totalFilteredCount"
      :search-state-total="searchState.total"
      :platform-list="platformList"
      :current-platform="filterState.platform"
      @update:kw="kw = $event"
      @update:platform="onPlatformChange"
      @search="onSearch"
      @scroll-to-anchor="scrollToAnchor" />

    <!-- 英雄区域 + 热门搜索 -->
    <div class="hero-row">
      <div class="hero-noise" aria-hidden="true" />
      <header class="hero">
        <div class="hero-accent" aria-hidden="true" />
        <div class="hero-content">
          <div class="hero-badge">PanHub 搜索聚合引擎</div>
          <h1 class="hero-title">
            <span class="hero-title-line">一键检索</span>
            <span class="hero-title-line hero-title-line--accent">全网网盘资源</span>
          </h1>
          <p class="hero-description">
            聚合阿里云盘、夸克、百度网盘、115、迅雷等平台 · 快速、直达、少打扰
          </p>
          <ul class="hero-features" role="list">
            <li class="hero-feature">实时聚合</li>
            <li class="hero-feature">多平台覆盖</li>
            <li class="hero-feature">结果去重</li>
          </ul>
        </div>
        <div class="hero-shape" aria-hidden="true" />
      </header>
    </div>

    <!-- 搜索框 -->
    <SearchBox
      v-model="kw"
      :loading="searchState.loading"
      :paused="searchState.paused"
      :searched="searched"
      :placeholder="placeholder"
      @search="onSearch"
      @reset="fullReset"
      @pause="pauseSearch"
      @continue="handleContinueSearch" />

    <!-- 统计和过滤器 -->
    <div v-if="searched" class="stats-bar">
      <div class="stats-content">
        <div class="stats-main">
          <span class="stat-item">
            <span class="stat-label">结果</span>
            <span class="stat-value">{{ searchState.total }}</span>
          </span>
          <span class="stat-item">
            <span class="stat-label">用时</span>
            <span class="stat-value">{{ searchState.elapsedMs }}ms</span>
          </span>
          <span v-if="searchState.deepLoading && !searchState.paused" class="loading-indicator">
            <span class="pulse-dot"></span>
            <span class="loading-text">持续搜索中…</span>
          </span>
          <span v-if="searchState.paused" class="paused-indicator-bar">
            <span class="pause-icon">⏸</span>
            <span v-if="autoPausedAtLimit" class="paused-text">
              已找到 {{ searchState.total }} 条结果，可继续搜索更多
            </span>
            <span v-else class="paused-text">搜索已暂停</span>
          </span>
        </div>

        <!-- 平台过滤器 -->
        <div class="platform-filters" v-if="hasResults">
          <button
            :class="['filter-pill', { active: filterState.platform === 'all' }]"
            @click="onPlatformChange('all')">
            全部 ({{ searchState.total }})
          </button>
          <button
            v-for="p in platformList"
            :key="p.key"
            :class="['filter-pill', { active: filterState.platform === p.key }]"
            @click="onPlatformChange(p.key)">
            {{ p.name }} ({{ p.count }})
          </button>
        </div>

      </div>
    </div>

    <!-- 左右协同工作区 (范式 A: 7:3 协同视口 + 移动端自适应下沉) -->
    <div v-if="searched || hasResults" class="search-workspace-layout">
      <!-- 左侧主工作区 (70%): 多维规格筛选与片源结果列表 -->
      <main class="workspace-main">
        <!-- 多维资源筛选栏 -->
        <SearchFilterBar
          v-if="hasResults"
          v-model="filterState"
          :total-count="searchState.total"
          :filtered-count="totalFilteredCount"
          :platform-list="platformList"
          :resolution-counts="resolutionCounts"
          :type-counts="typeCounts"
          :year-counts="yearCounts"
          :special-quality-counts="specialQualityCounts"
          @reset="resetFilterState" />

        <!-- 结果区平滑定位锚点 -->
        <div id="results-anchor" class="results-anchor" aria-hidden="true" />

        <!-- 搜索结果 -->
        <section v-if="hasResults" class="results-section">
          <div v-if="groupedResults.length > 0" class="results-grid">
            <ResultGroup
              v-for="group in groupedResults"
              :key="group.type"
              :title="platformName(group.type)"
              :color="platformColor(group.type)"
              :icon="platformIcon(group.type)"
              :items="group.items"
              :expanded="filterState.platform !== 'all' || isExpanded(group.type)"
              :initial-visible="initialVisible"
              :can-toggle-collapse="false"
              @toggle="handleToggle(group.type)"
              @copy="copyLink"
              @push-nas="openPushDrawer" />
          </div>
          <div v-else class="filter-empty-card">
            <p class="filter-empty-text">
              🔍 未找到符合当前组合筛选条件的资源，请尝试切换筛选标签或
              <button class="filter-reset-link" @click="resetFilterState">重置筛选</button>
            </p>
          </div>
        </section>

        <!-- 空状态：仅当搜索完全结束且无结果时显示，搜索进行中不显示 -->
        <section v-else-if="searched && !searchState.loading && !searchState.deepLoading && !searchState.paused" class="empty-state">
          <div class="empty-card">
            <div class="empty-card__main">
              <div class="empty-icon" aria-hidden="true">
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                  <path d="m8.5 8.5 5 5" />
                  <path d="m13.5 8.5-5 5" />
                </svg>
              </div>
              <div class="empty-card__text">
                <h3>未找到相关资源</h3>
                <p>试试其他关键词，或在右侧查看是否有相关中文字幕</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <!-- 右侧配套侧栏 (30%): SubHD 字幕关联展示面板 -->
      <aside class="workspace-sidebar">
        <SubtitleSidebar
          :keyword="kw"
          :douban-id="currentDoubanId"
          :is-searching="searchState.loading || searchState.deepLoading" />
      </aside>
    </div>

    <!-- 错误提示 -->
    <section v-if="searchState.error" class="error-alert">
      <span class="error-icon">⚠️</span>
      <span>{{ searchState.error }}</span>
    </section>

    <!-- 影视片库多维探索发现 - 搜索时隐藏 -->
    <section v-if="!searched" class="douban-hot-section">
      <ErrorBoundary message="影视探索加载失败">
        <FilmExploreSection ref="filmExploreRef" :on-search="quickSearch" />
      </ErrorBoundary>
    </section>

    <!-- NAS 离线下载推送抽屉 -->
    <PushDrawer
      :visible="pushDrawerVisible"
      :item="currentPushItem"
      @close="pushDrawerVisible = false"
      @success="handlePushSuccess" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import PushDrawer from "~/components/PushDrawer.vue";
import { PLATFORM_INFO } from "~/config/plugins";
import { isBotUA } from "~/utils/botUA";
import {
  parseResourceMeta,
  matchesFilter,
  compareResources,
  getDefaultFilterState,
  getDynamicYearRanges,
  parseYearRange,
  type FilterState,
} from "~/composables/useResourceParser";

const config = useRuntimeConfig();
const apiBase = (config.public?.apiBase as string) || "/api";
const siteUrl = (config.public?.siteUrl as string) || "";
const route = useRoute();
const router = useRouter();

// 影视片库探索组件引用与 SubHD 字幕关联 ID
const filmExploreRef = ref<InstanceType<typeof FilmExploreSection> | null>(null);
const currentDoubanId = ref<string>("");
const lastDoubanKw = ref<string>("");

// NAS 离线推送抽屉状态
const pushDrawerVisible = ref(false);
const currentPushItem = ref<any>(null);

function openPushDrawer(item: any) {
  currentPushItem.value = item;
  pushDrawerVisible.value = true;
}

function handlePushSuccess() {
  // 推送成功回调
}

// 智能紧凑吸顶状态与定位控制
const isStickyActive = ref(false);

function onLayoutScroll() {
  if (typeof window === "undefined") return;
  const layout = document.querySelector(".layout");
  const scrollTop =
    (layout && layout.scrollTop > 0 ? layout.scrollTop : 0) ||
    window.scrollY ||
    document.documentElement?.scrollTop ||
    0;
  // 当视口滚动超过 240px 时平滑滑入紧凑吸顶栏
  isStickyActive.value = scrollTop > 240;
}

function scrollToAnchor() {
  if (typeof window === "undefined") return;
  nextTick(() => {
    const anchor = document.getElementById("results-anchor");
    const layout = document.querySelector(".layout");
    if (anchor) {
      const top = Math.max(0, anchor.offsetTop - 120); // 预留 TopAppBar (60px) + CompactStickyBar (50px) 空间
      if (layout && layout.scrollTop > 0) {
        layout.scrollTo({ top, behavior: "smooth" });
      }
      window.scrollTo({ top, behavior: "smooth" });
      document.documentElement?.scrollTo({ top, behavior: "smooth" });
    }
  });
}

function onPlatformChange(platform: string) {
  filterState.value.platform = platform;
  if (isStickyActive.value) {
    scrollToAnchor();
  }
}

// 页面加载时初始化影视探索数据与滚动监听
onMounted(async () => {
  await nextTick();
  if (typeof window !== "undefined") {
    const layout = document.querySelector(".layout");
    if (layout) {
      layout.addEventListener("scroll", onLayoutScroll, { passive: true });
    }
    window.addEventListener("scroll", onLayoutScroll, { passive: true });
  }

  // 从 URL 读取搜索关键词
  const q = route.query.q;
  if (q && typeof q === "string") {
    // 爬虫抓取 /?q=xxx（来自 sitemap）时不自动搜索：否则每次抓取都触发
    // 一次完整搜索，形成自举循环。真人浏览器才自动搜索。
    if (isBotUA(typeof navigator !== "undefined" ? navigator.userAgent : undefined)) {
      kw.value = q; // 仍回填输入框，页面可读
    } else {
      kw.value = q;
      // 必须走 onSearch（内部先 checkSearchAuth），不能直接 doSearch——
      // 否则 URL 带 ?q= 时绕过公众号认证（与用户手动搜索行为一致）。
      await onSearch();
    }
  }
  if (filmExploreRef.value) await filmExploreRef.value.init();
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    const layout = document.querySelector(".layout");
    if (layout) {
      layout.removeEventListener("scroll", onLayoutScroll);
    }
    window.removeEventListener("scroll", onLayoutScroll);
  }
});

// SEO 元数据
useSeoMeta({
  title: "PanHub - 全网最全的网盘搜索",
  description:
    "聚合阿里云盘、夸克、百度网盘、115、迅雷等平台，实时检索各类分享链接与资源，快速、高效。",
  ogTitle: "PanHub - 全网最全的网盘搜索",
  ogDescription:
    "聚合阿里云盘、夸克、百度网盘、115、迅雷等平台，实时检索各类分享链接与资源，快速、高效。",
  ogType: "website",
  ogSiteName: "PanHub",
  ogImage:
    "https://cdn.jsdmirror.com/gh/wu529778790/img.shenzjd.com@master/blog/imgx-20260828-151509-5bk7.svg",
  twitterCard: "summary_large_image",
  twitterTitle: "PanHub - 全网最全的网盘搜索",
  twitterDescription:
    "聚合阿里云盘、夸克、百度网盘、115、迅雷等平台，实时检索各类分享链接与资源，快速、高效。",
  twitterImage:
    "https://cdn.jsdmirror.com/gh/wu529778790/img.shenzjd.com@master/blog/imgx-20260828-151509-5bk7.svg",
});

useHead({
  link: [{ rel: "canonical", href: siteUrl ? `${siteUrl}/` : "/" }],
  meta: [
    {
      name: "keywords",
      content:
        "网盘搜索, 阿里云盘搜索, 夸克网盘搜索, 百度网盘搜索, 115 网盘, 迅雷云盘, 资源搜索, 盘搜, PanHub",
    },
  ],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "PanHub",
        url: siteUrl || "",
        potentialAction: {
          "@type": "SearchAction",
          target: (siteUrl || "") + "/?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      }),
    },
  ],
});

// 搜索相关状态
const kw = ref("");
const placeholder =
  "搜索网盘资源，支持百度云、阿里云盘、夸克网盘、115网盘、迅雷云盘、天翼云盘、123网盘、移动云盘、UC网盘等";

// 平台过滤（结果排序固定按时间最新在前，见 sortItems，不再提供其它排序选项）
const filterPlatform = ref<string>("all");
const initialVisible = 3;
const expandedSet = ref<Set<string>>(new Set());

// 使用搜索 composable
const {
  state: searchState,
  searched,
  performSearch,
  resetSearch,
  copyLink,
  pauseSearch,
  continueSearch,
  hasResults,
  autoPausedAtLimit,
} = useSearch();
const { settings, loadSettings } = useSettings();
const { checkSearchAuth, forceVerify } = useWxAuth();
// 自愿支持弹窗（floating-unlock）：每搜索 3 次自愿弹一次，不阻塞搜索
const { maybeShowUnlockAd } = useUnlockAd();

// 获取搜索选项（使用最新的用户设置）
function getSearchOptions() {
  return {
    apiBase,
    keyword: kw.value,
    settings: {
      // 2026-08-25：插件/频道知识全在后端，前端设置只保留并发与超时
      concurrency: settings.value.concurrency,
      pluginTimeoutMs: settings.value.pluginTimeoutMs,
    },
  };
}

// 执行实际搜索逻辑
async function doSearch() {
  if (!kw.value || searchState.value.loading) return;
  loadSettings();
  const keyword = kw.value.trim();
  // 同步搜索词到 URL
  if (router) {
    router.replace({ query: { q: keyword } });
  }
  await performSearch({
    ...getSearchOptions(),
    onAuthRequired: handleAuthRequired,
  });
}

// 搜索接口返回 401 时回调（2026-08-22）：
// 服务端 requireWxAuth 实时校验 token 失效/取消关注 → 强制重新吊起
// 微信认证弹窗，认证成功后再重试搜索。
let wxAuthRetrying = false;
async function handleAuthRequired() {
  // 防止一次搜索并发多个子请求同时触发多次弹窗
  if (wxAuthRetrying) return;
  wxAuthRetrying = true;
  try {
    // 强制重新认证（重置 isVerified，重新弹关注公众号弹窗）
    const ok = await forceVerify();
    if (ok) {
      resetSearch();
      await doSearch();
    }
  } finally {
    wxAuthRetrying = false;
  }
}

// 搜索执行
async function onSearch() {
  if (!kw.value) return;
  // 若用户手动输入了新关键词（与上次点击的海报片名不匹配），则清空精准豆瓣关联 ID
  if (kw.value !== lastDoubanKw.value) {
    currentDoubanId.value = "";
  }
  // 暂停状态下发起新搜索：放弃旧任务重新开始（想继续旧搜索请点"继续"按钮）
  if (searchState.value.paused) {
    resetSearch();
  }
  if (searchState.value.loading) return;
  // 微信公众号认证（强制：未认证先完成关注+验证码验证，成功后自动继续搜索）
  const authed = await checkSearchAuth();
  if (!authed) return;
  // 自愿支持弹窗：每搜索 3 次自愿弹出一次（fire-and-forget，不阻塞本次搜索）
  maybeShowUnlockAd();
  await doSearch();
}

// 快速搜索（支持海报点击透传豆瓣 ID 联动 SubHD）
async function quickSearch(keyword: string, doubanId?: string) {
  kw.value = keyword;
  currentDoubanId.value = doubanId || "";
  lastDoubanKw.value = keyword;
  await onSearch();
}

// 继续搜索（从暂停处继续）
async function handleContinueSearch() {
  if (!searchState.value.paused) return;
  loadSettings();
  await continueSearch({
    ...getSearchOptions(),
    onAuthRequired: handleAuthRequired,
  });
}

// 完全重置 - 清空输入框、结果、状态，并刷新页面
async function fullReset() {
  // 清空输入框和重置状态
  kw.value = "";
  currentDoubanId.value = "";
  lastDoubanKw.value = "";
  resetFilterState();
  expandedSet.value = new Set();
  resetSearch();
  // 清除 URL 参数
  if (router) {
    router.replace({ query: {} });
  }
  // 刷新页面以恢复初始状态（包括影视探索）
  await nextTick();
  if (filmExploreRef.value) await filmExploreRef.value.init();
}

// 平台信息
const platformIcon = (t: string): string => PLATFORM_INFO[t]?.icon || "📦";
const platformName = (t: string): string => PLATFORM_INFO[t]?.name || t;
const platformColor = (t: string): string => PLATFORM_INFO[t]?.color || "#9ca3af";

// 多维筛选状态
const filterState = ref<FilterState>(getDefaultFilterState());

function resetFilterState() {
  filterState.value = getDefaultFilterState();
  if (isStickyActive.value) {
    scrollToAnchor();
  }
}

// 平台信息列表（带数量与图标，按数量降序）
const platformList = computed(() => {
  const m = searchState.value?.merged ?? {};
  return Object.keys(m)
    .filter((type) => (m[type]?.length ?? 0) > 0)
    .sort((a, b) => (m[b]?.length ?? 0) - (m[a]?.length ?? 0))
    .map((type) => ({
      key: type,
      name: platformName(type),
      count: m[type]?.length ?? 0,
      icon: platformIcon(type),
    }));
});

// 所有原始结果扁平数组（供各维度计数统计）
const allRawItems = computed(() => {
  const m = searchState.value?.merged ?? {};
  const list: Array<{ item: any; platform: string }> = [];
  for (const p of Object.keys(m)) {
    for (const item of m[p] || []) {
      list.push({ item, platform: p });
    }
  }
  return list;
});

// 清晰度各维度计数
const resolutionCounts = computed(() => {
  const counts: Record<string, number> = { "4K": 0, "1080P": 0, "720P": 0 };
  for (const { item } of allRawItems.value) {
    const meta = parseResourceMeta(item?.note || item?.url || "");
    if (meta.resolution in counts) counts[meta.resolution]++;
  }
  return counts;
});

// 类型各维度计数
const typeCounts = computed(() => {
  const counts: Record<string, number> = { movie: 0, tv: 0, anime: 0, doc: 0, show: 0 };
  for (const { item } of allRawItems.value) {
    const meta = parseResourceMeta(item?.note || item?.url || "");
    if (meta.mediaType in counts) counts[meta.mediaType]++;
  }
  return counts;
});

// 年代各维度计数（根据当前年份动态区间统计）
const dynamicYearOptions = getDynamicYearRanges();
const yearCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const opt of dynamicYearOptions) {
    counts[opt.key] = 0;
  }
  for (const { item } of allRawItems.value) {
    const meta = parseResourceMeta(item?.note || item?.url || "");
    const y = meta.year;
    if (y) {
      for (const opt of dynamicYearOptions) {
        const range = parseYearRange(opt.key);
        if (range && y >= range.startYear && y <= range.endYear) {
          counts[opt.key]++;
        }
      }
    }
  }
  return counts;
});

// 特殊画质规格各维度计数
const specialQualityCounts = computed(() => {
  const counts: Record<string, number> = {
    REMUX: 0,
    "杜比视界": 0,
    HDR: 0,
    "蓝光": 0,
    "高帧率": 0,
  };
  for (const { item } of allRawItems.value) {
    const meta = parseResourceMeta(item?.note || item?.url || "");
    for (const tag of meta.qualityTags) {
      if (tag in counts) counts[tag]++;
    }
  }
  return counts;
});

// 响应式多维过滤与排序结果
const groupedResults = computed(() => {
  const list: Array<{ type: string; items: any[] }> = [];
  const source = searchState.value?.merged ?? {};
  const currentFilters = filterState.value;

  for (const type of Object.keys(source)) {
    const rawItems = source[type] || [];
    if (!rawItems.length) continue;

    // 结合当前多维条件进行过滤
    const filtered = rawItems.filter((item: any) => {
      const meta = parseResourceMeta(item?.note || item?.url || "");
      return matchesFilter(meta, currentFilters, type);
    });

    if (filtered.length > 0) {
      // 根据所选排序模式实时重排
      const sorted = [...filtered].sort((a, b) => compareResources(a, b, currentFilters.sortBy));
      list.push({ type, items: sorted });
    }
  }

  // 数量多的平台排前面
  list.sort((a, b) => (b.items?.length ?? 0) - (a.items?.length ?? 0));
  return list;
});

const totalFilteredCount = computed(() => {
  return groupedResults.value.reduce((acc, g) => acc + (g.items?.length || 0), 0);
});

// 展开/收起
function isExpanded(type: string) {
  return expandedSet.value.has(type);
}

function handleToggle(type: string) {
  filterState.value.platform = type;
  scrollToAnchor();
}

function visibleItems(type: string, items: any[]) {
  return isExpanded(type) ? items : items.slice(0, initialVisible);
}
</script>

<style scoped>
.home {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.results-anchor {
  display: block;
  height: 1px;
  margin-top: -1px;
  visibility: hidden;
  pointer-events: none;
}

/* 英雄区域 + 热门搜索（frontend-design: editorial + industrial） */
.hero-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  position: relative;
  background: linear-gradient(145deg, rgba(15, 118, 110, 0.12) 0%, rgba(15, 118, 110, 0.04) 35%, rgba(245, 158, 11, 0.06) 70%, rgba(15, 118, 110, 0.08) 100%);
  border-radius: 20px;
  box-shadow: 0 4px 20px -4px rgba(15, 118, 110, 0.15);
  overflow: hidden;
}

.hero-noise {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
  z-index: 0;
}

.hero {
  flex: 1;
  min-width: 0;
  padding: 24px 28px;
  text-align: left;
  position: relative;
  z-index: 1;
}

.hero-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 100%;
  background: linear-gradient(180deg, var(--primary) 0%, var(--secondary) 50%, var(--primary) 100%);
  opacity: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
  padding-left: 12px;
}

.hero-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--primary);
  margin-bottom: 10px;
  padding: 6px 12px;
  background: rgba(15, 118, 110, 0.12);
  border: 1px solid rgba(15, 118, 110, 0.25);
  border-radius: 8px;
  font-family: "Manrope", sans-serif;
  animation: heroReveal 0.6s ease-out both;
  animation-delay: 0.05s;
}

.hero-title {
  font-family: "Syne", "Manrope", sans-serif;
  font-size: 36px;
  font-weight: 800;
  margin: 0 0 10px;
  color: var(--text-primary);
  letter-spacing: -0.04em;
  line-height: 1.1;
  max-width: 560px;
  animation: heroReveal 0.6s ease-out both;
  animation-delay: 0.12s;
}

.hero-title-line {
  display: block;
}

.hero-title-line--accent {
  background: linear-gradient(120deg, var(--primary) 0%, #0d9488 40%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 16px;
  line-height: 1.65;
  max-width: 520px;
  animation: heroReveal 0.6s ease-out both;
  animation-delay: 0.2s;
}

.hero-features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
}

.hero-feature {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--primary-dark);
  padding: 6px 12px;
  background: var(--bg-input);
  border: 1px solid rgba(15, 118, 110, 0.2);
  border-radius: 10px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  animation: heroReveal 0.6s ease-out both;
}

.hero-feature:nth-child(1) { animation-delay: 0.28s; }
.hero-feature:nth-child(2) { animation-delay: 0.34s; }
.hero-feature:nth-child(3) { animation-delay: 0.4s; }

.hero-feature:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(15, 118, 110, 0.15);
  border-color: rgba(15, 118, 110, 0.35);
}

.hero-shape {
  position: absolute;
  right: 8%;
  bottom: 10%;
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, rgba(15, 118, 110, 0.15) 0%, rgba(245, 158, 11, 0.08) 100%);
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  filter: blur(24px);
  pointer-events: none;
  z-index: 0;
}

@keyframes heroReveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 统计和过滤器栏 */
.stats-bar {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-md);
  animation: fadeIn 0.4s ease;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-main {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
}

.stat-label {
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary);
}

/* 加载指示器 */
.loading-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(15, 118, 110, 0.1);
  border-radius: var(--radius-md);
  border: 1px solid rgba(15, 118, 110, 0.2);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

.loading-text {
  font-size: 13px;
  color: var(--primary);
  font-weight: 500;
}

/* 暂停状态指示器（统计栏） */
.paused-indicator-bar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: var(--radius-md);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
  font-weight: 500;
}

.pause-icon {
  font-size: 14px;
}

.paused-text {
  font-size: 13px;
}

/* 平台过滤器 */
.platform-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-pill {
  padding: 6px 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
    color var(--transition-fast), transform var(--transition-fast),
    box-shadow var(--transition-fast);
  white-space: nowrap;
}

.filter-pill:hover {
  background: var(--bg-primary);
  border-color: var(--border-medium);
  transform: translateY(-1px);
}

.filter-pill.active {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(15, 118, 110, 0.28);
}

/* 左右 7:3 协同工作区布局 (范式 A: Master-Detail 宽屏 + 移动端自适应下沉) */
.search-workspace-layout {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(320px, 3fr);
  gap: 24px;
  align-items: start;
  width: 100%;
  animation: fadeIn 0.4s ease;
}

.workspace-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workspace-sidebar {
  min-width: 0;
  position: sticky;
  top: 124px;
}

@media (max-width: 1024px) {
  .search-workspace-layout {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .workspace-sidebar {
    position: static;
  }
}

/* 搜索结果区域 */
.results-section {
  animation: fadeIn 0.5s ease;
}

.results-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.filter-empty-card {
  padding: 36px 24px;
  background: var(--bg-primary);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-lg);
  text-align: center;
  margin: 16px 0;
}

.filter-empty-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-reset-link {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 6px;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: all 0.2s ease;
}

.filter-reset-link:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

/* 空状态 */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: 32px 0;
  animation: fadeIn 0.4s ease;
}

.empty-card {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 40px 44px;
  box-shadow: var(--shadow-xl);
  display: flex;
  align-items: center;
  gap: 40px;
  flex-wrap: wrap;
}

.empty-card__main {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 280px;
  flex: 1 1 320px;
}

.empty-icon {
  flex-shrink: 0;
  width: 88px;
  height: 88px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.6) 0%,
    rgba(255, 255, 255, 0.2) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: var(--primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.empty-card__text h3 {
  margin: 0 0 8px 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-card__text p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* 错误提示 */
.error-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  color: var(--error);
  font-weight: 500;
  animation: fadeIn 0.3s ease;
}

.error-icon {
  font-size: 18px;
}

/* 移动端优化 */
@media (max-width: 640px) {
  .hero {
    padding: 24px 18px;
  }

  .hero-content {
    padding-left: 4px;
  }

  .hero-badge {
    font-size: 10px;
    letter-spacing: 0.1em;
    margin-bottom: 10px;
  }

  .hero-title {
    font-size: 26px;
  }

  .hero-description {
    font-size: 14px;
    margin-bottom: 16px;
  }

  .hero-feature {
    font-size: 12px;
    padding: 6px 12px;
  }

  .hero-shape {
    width: 80px;
    height: 80px;
    right: 5%;
    bottom: 5%;
  }

  .stats-bar {
    padding: 12px;
  }

  .stats-main {
    gap: 8px;
  }

  .stat-item {
    padding: 6px 10px;
  }

  .stat-value {
    font-size: 16px;
  }

  .platform-filters {
    gap: 6px;
  }

  .filter-pill {
    padding: 5px 10px;
    font-size: 12px;
  }

  .empty-card {
    padding: 24px 20px;
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }

  .empty-card__main {
    min-width: 0;
    width: 100%;
    gap: 16px;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 18px;
  }

  .empty-icon svg {
    width: 36px;
    height: 36px;
  }

  .empty-card h3 {
    font-size: 18px;
  }

  .suggestions-card {
    padding: 16px;
  }

  .tag {
    padding: 6px 12px;
    font-size: 12px;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .hero-title-line--accent {
    -webkit-text-fill-color: var(--primary);
    background: none;
  }

  .hero-badge,
  .hero-feature {
    border-width: 2px;
  }

  .filter-pill.active {
    border-width: 2px;
  }

  .tag {
    border-width: 2px;
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .hero-badge,
  .hero-title,
  .hero-description,
  .hero-feature {
    animation: none;
  }

  .hero-feature:hover {
    transform: none;
  }

  .hero,
  .stats-bar,
  .results-section,
  .empty-state,
  .error-alert,
  .hot-search-section {
    animation: none;
  }

  .filter-pill:hover {
    transform: none;
  }

  .pulse-dot {
    animation: none;
    opacity: 0.7;
  }
}

</style>
