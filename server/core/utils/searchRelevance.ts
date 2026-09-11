import MiniSearch from "minisearch";
import type { SearchResult } from "../types/models";
import { normalizeSearchKeyword } from "./searchKeyword";

const STOP_WORDS = new Set([
  "的", "之", "与", "和", "及", "在", "了", "着", "是", "个", "部", "季", "集",
  "电影", "高清", "下载", "资源", "分享", "网盘",
]);

let segmenter: Intl.Segmenter | null = null;
try {
  if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
    segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
  }
} catch {
  segmenter = null;
}

export function tokenizeText(text: string): string[] {
  if (!text) return [];
  if (segmenter) {
    return Array.from(segmenter.segment(text))
      .filter((x) => x.isWordLike && !STOP_WORDS.has(x.segment.trim()))
      .map((x) => x.segment.trim().toLowerCase())
      .filter((x) => x.length > 0);
  }
  // 降级：若运行环境无 Intl.Segmenter，使用通用正则分词
  return text
    .toLowerCase()
    .split(/[\s/|,，、·:：;；!?？！+._\-\[\]()（）【】]+/)
    .filter((x) => x.length > 0 && !STOP_WORDS.has(x));
}

export interface ScoredSearchResult {
  result: SearchResult;
  score: number;
  matchedTerms: string[];
  exactMatch: boolean;
}

/**
 * 使用 MiniSearch (BM25) 进行两阶段工业级相关性打分与排序
 * 解决擦边词误召回、冷门无关条目霸屏问题，同时保留全集与高质量合集资源
 */
export function rankAndFilterSearchResults(
  results: SearchResult[],
  rawKeyword: string
): SearchResult[] {
  const keyword = (rawKeyword || "").trim();
  if (!keyword || results.length === 0) {
    return results;
  }

  // 单字符关键词（如搜 "1"、"a"）：跳过强过滤，避免误杀兜底插件场景
  if (keyword.length <= 1) {
    return results;
  }

  const normalizedKeyword = normalizeSearchKeyword(keyword);
  const queryTokens = tokenizeText(keyword);

  // 为全部输入结果分配稳定 ID 并创建 MiniSearch 索引
  const docMap = new Map<string, SearchResult>();
  const docs = results.map((r, idx) => {
    const id = `doc_${idx}`;
    docMap.set(id, r);
    return {
      id,
      title: r.title || "",
      content: r.content || "",
    };
  });

  const miniSearch = new MiniSearch({
    fields: ["title", "content"],
    storeFields: ["id"],
    searchOptions: {
      boost: { title: 3.5 },
      fuzzy: 0.2,
      prefix: true,
    },
    tokenize: tokenizeText,
  });

  miniSearch.addAll(docs);

  const searchHits = miniSearch.search(keyword);
  const hitMap = new Map<string, { score: number; terms: string[] }>();
  for (const hit of searchHits) {
    hitMap.set(hit.id, {
      score: hit.score,
      terms: hit.terms || [],
    });
  }

  const scoredList: ScoredSearchResult[] = [];

  for (let i = 0; i < results.length; i++) {
    const id = `doc_${i}`;
    const r = results[i];
    const hit = hitMap.get(id);

    const normTitle = normalizeSearchKeyword(r.title || "");
    const normContent = normalizeSearchKeyword(r.content || "");

    // 1. 完全包含断言（最高优先级）
    const titleExact = normTitle.includes(normalizedKeyword);
    const contentExact = normContent.includes(normalizedKeyword);
    const isExact = titleExact || contentExact;

    let baseScore = hit ? hit.score : 0;
    const matchedTerms = hit ? hit.terms : [];

    // 精准包含加分
    if (titleExact) baseScore += 200;
    else if (contentExact) baseScore += 80;

    // 2. 筛选过滤逻辑 (Filter Threshold)
    let isRelevant = false;
    if (isExact) {
      isRelevant = true;
    } else if (queryTokens.length <= 1) {
      // 单词检索：若分词匹配到或包含，即算相关
      isRelevant = matchedTerms.length > 0 || normTitle.includes(queryTokens[0] || "");
    } else {
      // 复合词检索（如“哈利波特与魔法石”）：
      // 必须匹配至少 2 个词，或者匹配率 >= 50% 核心词汇，防止只匹配单一连词/噪音词
      const matchRatio = matchedTerms.length / queryTokens.length;
      if (matchedTerms.length >= 2 || matchRatio >= 0.5) {
        isRelevant = true;
      }
    }

    if (isRelevant) {
      scoredList.push({
        result: r,
        score: baseScore,
        matchedTerms,
        exactMatch: isExact,
      });
    }
  }

  // 3. 排序策略：
  // 梯队 1：相关度得分（BM25 + Exact Boost）排在最前；
  // 梯队 2：当相关度接近时，按时间倒序
  scoredList.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    // 分差大于 15 分说明相关性有显著层级差距，严格按相关性排
    if (Math.abs(scoreDiff) > 15) {
      return scoreDiff;
    }
    // 分差接近时，新鲜度更优先
    const tA = Date.parse(a.result.datetime || "") || 0;
    const tB = Date.parse(b.result.datetime || "") || 0;
    return tB - tA;
  });

  return scoredList.map((item) => item.result);
}
