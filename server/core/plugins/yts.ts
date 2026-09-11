/**
 * YTS (YIFY) 电影 BT 磁力插件
 * 官方开放 REST API，提供 720p/1080p/2160p(4K) 高清蓝光电影种子与磁力
 * 特点：极速（JSON 响应 ~200ms）、免网页爬虫、带真实做种数(Seeds)与文件体积
 */

import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

const TRACKERS = [
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.openbittorrent.com:80",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://tracker.coppersurfer.tk:6969",
  "udp://explodie.org:6969",
].map((t) => `&tr=${encodeURIComponent(t)}`).join("");

interface YtsTorrent {
  url: string;
  hash: string;
  quality: string;
  type: string;
  seeds: number;
  peers: number;
  size: string;
  size_bytes?: number;
  date_uploaded?: string;
}

interface YtsMovie {
  id: number;
  title: string;
  title_english?: string;
  title_long?: string;
  year: number;
  rating: number;
  summary?: string;
  torrents?: YtsTorrent[];
}

interface YtsResponse {
  status: string;
  data?: {
    movie_count?: number;
    movies?: YtsMovie[];
  };
}

export function buildYtsMagnet(hash: string, title: string): string {
  const cleanHash = (hash || "").trim().toLowerCase();
  return `magnet:?xt=urn:btih:${cleanHash}&dn=${encodeURIComponent(title)}${TRACKERS}`;
}

export class YtsPlugin extends BaseAsyncPlugin {
  constructor() {
    super("yts", 5); // 优先级 5 (高优先级极速 JSON 源)
  }

  override async search(
    keyword: string,
    ext?: Record<string, any>
  ): Promise<SearchResult[]> {
    const kw = (keyword || "").trim();
    if (!kw || kw.length < 2) return [];

    const timeoutMs = ext?.__plugin_timeout_ms || 2500; // 严格限时 2.5s
    const primaryUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(
      kw
    )}&sort_by=seeds&limit=20`;

    try {
      const resp = await ofetch<YtsResponse>(primaryUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        timeout: timeoutMs,
        retry: 0,
      });

      if (resp?.status !== "ok" || !Array.isArray(resp?.data?.movies)) {
        return [];
      }

      const results: SearchResult[] = [];

      for (const movie of resp.data.movies) {
        if (!Array.isArray(movie.torrents) || movie.torrents.length === 0) continue;

        const baseTitle = movie.title_english || movie.title;
        const year = movie.year ? ` (${movie.year})` : "";

        for (const t of movie.torrents) {
          if (!t.hash) continue;

          const releaseTitle = `${baseTitle}${year} [${t.quality.toUpperCase()}] [${(t.type || "BluRay").toUpperCase()}] [YTS]`;
          const magnetUrl = buildYtsMagnet(t.hash, releaseTitle);

          const tags: string[] = ["YTS", t.quality.toUpperCase(), "BT磁力"];
          if (t.seeds > 0) {
            tags.push(`做种:${t.seeds}`);
          }
          if (t.size) {
            tags.push(t.size);
          }

          results.push({
            message_id: `yts-${movie.id}-${t.quality}-${t.hash.slice(0, 8)}`,
            unique_id: `yts-${t.hash.toLowerCase()}`,
            channel: "YTS",
            datetime: t.date_uploaded || (movie.year ? `${movie.year}-01-01 00:00:00` : undefined),
            title: releaseTitle,
            content: `【YTS 蓝光高清】做种健康度: ${t.seeds} Seeds / ${t.peers} Peers | 文件体积: ${t.size} | IMDb评分: ${movie.rating || "N/A"}`,
            links: [
              {
                type: "magnet",
                url: magnetUrl,
              },
            ],
            tags,
          });
        }
      }

      return results;
    } catch (err: any) {
      // 优雅容错降级，不阻塞整路搜索
      return [];
    }
  }
}

registerGlobalPlugin(new YtsPlugin());
