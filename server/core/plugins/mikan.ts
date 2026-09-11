import { BaseAsyncPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { loggers } from "../utils/logger";

const MIKAN_ENDPOINTS = [
  "https://mikanime.tv/RSS/Search",
  "https://mikanani.me/RSS/Search",
];

const DEFAULT_TRACKERS = [
  "http://open.acgtracker.com:1096/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
]
  .map((tr) => `tr=${encodeURIComponent(tr)}`)
  .join("&");

function formatBytes(bytesNum: number): string {
  if (!bytesNum || isNaN(bytesNum)) return "";
  if (bytesNum >= 1024 * 1024 * 1024) {
    return `${(bytesNum / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytesNum / (1024 * 1024)).toFixed(1)} MB`;
}

export class MikanPlugin extends BaseAsyncPlugin {
  constructor() {
    super("mikan", 4);
  }

  override async search(
    keyword: string,
    ext?: Record<string, any>
  ): Promise<SearchResult[]> {
    const rawKw = (keyword || "").trim();
    if (!rawKw) return [];

    const timeout = Math.min(
      2500,
      Math.max(1000, Number((ext as any)?.__plugin_timeout_ms) || 2500)
    );

    let xml = "";
    for (const endpoint of MIKAN_ENDPOINTS) {
      try {
        const url = `${endpoint}?searchstr=${encodeURIComponent(rawKw)}`;
        xml = await ofetch<string>(url, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            accept: "application/xml, text/xml, */*",
          },
          timeout,
        });
        if (xml && xml.includes("<item>")) break;
      } catch (err: any) {
        loggers.plugin.debug("Mikan 镜像请求跳过", {
          endpoint,
          error: err?.message,
        });
      }
    }

    if (!xml || !xml.includes("<item>")) return [];

    const out: SearchResult[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && out.length < 15) {
      const itemContent = match[1];

      const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        itemContent.match(/<title>(.*?)<\/title>/);
      const title = (titleMatch?.[1] || "").trim();
      if (!title) continue;

      // 从 enclosure 的 url 中提取 40 位 SHA-1 hash（形如 /Download/20260806/{hash}.torrent）
      const hashMatch = itemContent.match(/([a-fA-F0-9]{40})/);
      const infoHash = hashMatch ? hashMatch[1].toLowerCase() : "";
      if (!infoHash) continue;

      // 提取文件大小
      const lenMatch = itemContent.match(/length="(\d+)"/) || itemContent.match(/<contentLength>(\d+)<\/contentLength>/);
      const lengthBytes = lenMatch ? Number(lenMatch[1]) : 0;
      const sizeText = formatBytes(lengthBytes);

      // 提取发布时间
      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
      let datetime = new Date().toISOString();
      if (pubDateMatch?.[1]) {
        const parsed = Date.parse(pubDateMatch[1]);
        if (!isNaN(parsed)) datetime = new Date(parsed).toISOString();
      }

      const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(
        title
      )}&${DEFAULT_TRACKERS}`;

      out.push({
        message_id: "",
        unique_id: `mikan-${infoHash}`,
        channel: "蜜柑计划 (Mikan Project)",
        datetime,
        title: `${title}${sizeText ? ` [${sizeText}]` : ""}`,
        content: `正规字幕组分流 | ${sizeText || "高质量压制"}`,
        links: [{ type: "magnet", url: magnet, password: "" }],
      });
    }

    return out;
  }
}
