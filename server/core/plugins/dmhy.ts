/**
 * 动漫花园 (DMHY) 动漫与亚洲影视 BT 磁力插件
 * 基于公开 XML/RSS 订阅源获取，提供最新中文内嵌字幕、新番及亚洲影视资源
 * 特点：无验证码、带字幕组信息、自带简体/繁体中文字幕
 */

import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import * as cheerio from "cheerio";

export class DmhyPlugin extends BaseAsyncPlugin {
  constructor() {
    super("dmhy", 4); // 优先级 4
  }

  override async search(
    keyword: string,
    ext?: Record<string, any>
  ): Promise<SearchResult[]> {
    const kw = (keyword || "").trim();
    if (!kw || kw.length < 2) return [];

    const timeoutMs = ext?.__plugin_timeout_ms || 2500; // 严格限时 2.5s
    const rssUrl = `https://share.dmhy.org/topics/rss/rss.xml?keyword=${encodeURIComponent(
      kw
    )}`;

    try {
      const xml = await ofetch<string>(rssUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
        timeout: timeoutMs,
        responseType: "text",
        retry: 0,
      });

      if (!xml || !xml.includes("<item>")) {
        return [];
      }

      const $ = cheerio.load(xml, { xmlMode: true });
      const results: SearchResult[] = [];

      $("item").slice(0, 15).each((_, el) => {
        const $item = $(el);
        const title = $item.find("title").text().trim();
        const pubDate = $item.find("pubDate").text().trim();
        const enclosure = $item.find("enclosure");
        let magnet = enclosure.attr("url") || "";

        // 若 enclosure 无 magnet，尝试从 description 中提取
        if (!magnet || !magnet.startsWith("magnet:")) {
          const desc = $item.find("description").text() || "";
          const match = desc.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+/i);
          if (match) magnet = match[0];
        }

        if (!title || !magnet || !magnet.startsWith("magnet:")) return;

        const hashMatch = magnet.match(/urn:btih:([a-zA-Z0-9]+)/i);
        const hash = hashMatch ? hashMatch[1].toLowerCase() : "";

        // 提取格式或语言标签
        const tags: string[] = ["动漫花园", "BT磁力"];
        if (/\[(1080P|720P|2160P|4K)\]/i.test(title)) {
          const m = title.match(/(1080P|720P|2160P|4K)/i);
          if (m) tags.push(m[1].toUpperCase());
        }
        if (/简日|繁日|简中|繁中|双语|内嵌/i.test(title)) {
          tags.push("中文内嵌");
        }

        results.push({
          message_id: `dmhy-${hash ? hash.slice(0, 8) : Math.random().toString(36).slice(2)}`,
          unique_id: `dmhy-${hash || title}`,
          channel: "动漫花园",
          datetime: pubDate ? new Date(pubDate).toISOString().replace("T", " ").slice(0, 19) : undefined,
          title,
          content: `【动漫花园】${title}`,
          links: [
            {
              type: "magnet",
              url: magnet,
            },
          ],
          tags,
        });
      });

      return results;
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new DmhyPlugin());
