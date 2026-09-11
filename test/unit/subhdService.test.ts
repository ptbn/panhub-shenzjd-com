import { describe, it, expect, beforeEach } from "vitest";
import {
  parseSubhdHtml,
  subhdCache,
  type SubhdResult,
} from "../../server/core/services/subhdService";

describe("SubHD Service - 字幕解析与服务", () => {
  beforeEach(() => {
    (subhdCache as any).store.clear();
  });

  const MOCK_SEARCH_HTML = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="bg-white shadow-sm rounded-3 mb-4">
          <div class="row">
            <div class="col-lg-10">
              <div class="pt-3 pe-3 pb-2 ps-3">
                <div class="clearfix">
                  <div class="float-start f16 fw-bold">
                    <a class="link-dark align-middle" href="/a/Cm0tsS">星际穿越</a>
                  </div>
                  <div class="view-text text-secondary">
                    <a href="/a/Cm0tsS" class="link-dark">
                      Interstellar.2014.2160p.BluRay.x265.10bit.SDR.DTS-HD.MA.5.1-SWTYBLZ
                    </a>
                  </div>
                  <div class="text-truncate py-2 f11">
                    <span class="rounded p-1 me-1 text-white">官方字幕</span>
                    <span class="p-1 fw-bold">双语</span>
                    <span class="p-1 fw-bold">简体</span>
                    <span class="p-1 fw-bold">英语</span>
                    <span class="p-1 text-secondary">ASS</span>
                  </div>
                  <div class="pt-2 text-secondary f12">
                    <svg class="bi bi-download"></svg>
                    <span class="align-text-top me-3">2278</span>
                  </div>
                  <div class="pt-1 f12 text-secondary">
                    发布人 <a class="fw-bold text-dark" href="/zu/28">F.I.X字幕侠</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const MOCK_DOUBAN_PAGE_HTML = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="px-3 py-2 border-bottom">
          <div class="view-text">
            <a class="link-dark" href="/a/setAL8">Bluray 4K Remux Edition</a>
            <span class="p-1 ms-2 f12 rounded-3">
              <a href="/zu/55">电波字幕组</a>
            </span>
          </div>
          <div class="pt-1 f11">
            <span class="rounded p-1 me-1 text-white">精选推荐</span>
            <span class="p-1 fw-bold">双语</span>
            <span class="p-1 fw-bold">简体</span>
            <span class="p-1 text-secondary">SUP</span>
          </div>
        </div>
      </body>
    </html>
  `;

  it("应当准确解析 SubHD 搜索列表卡片结构", () => {
    const result = parseSubhdHtml(MOCK_SEARCH_HTML, undefined, "星际穿越");

    expect(result.total).toBe(1);
    expect(result.subhdUrl).toBe("https://subhd.cc/search/%E6%98%9F%E9%99%85%E7%A9%BF%E8%B6%8A");
    
    const item = result.items[0];
    expect(item.id).toBe("Cm0tsS");
    expect(item.title).toContain("Interstellar.2014.2160p");
    expect(item.filmTitle).toBe("星际穿越");
    expect(item.url).toBe("https://subhd.cc/a/Cm0tsS");
    expect(item.group).toBe("F.I.X字幕侠");
    expect(item.languages).toContain("双语");
    expect(item.languages).toContain("简体");
    expect(item.languages).toContain("英语");
    expect(item.formats).toContain("ASS");
    expect(item.tags).toContain("官方字幕");
    expect(item.downloads).toBe("2278");
  });

  it("应当准确解析豆瓣 ID 专页的行列表结构", () => {
    const result = parseSubhdHtml(MOCK_DOUBAN_PAGE_HTML, "1889243");

    expect(result.total).toBe(1);
    expect(result.doubanId).toBe("1889243");
    expect(result.subhdUrl).toBe("https://subhd.cc/d/1889243");

    const item = result.items[0];
    expect(item.id).toBe("setAL8");
    expect(item.title).toBe("Bluray 4K Remux Edition");
    expect(item.url).toBe("https://subhd.cc/a/setAL8");
    expect(item.group).toBe("电波字幕组");
    expect(item.languages).toContain("双语");
    expect(item.formats).toContain("SUP");
    expect(item.tags).toContain("精选推荐");
  });

  it("当 HTML 为空或无有效字幕时应优雅降级返回空列表", () => {
    const result = parseSubhdHtml("<html><body><div>无匹配内容</div></body></html>", "999999");
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.subhdUrl).toBe("https://subhd.cc/d/999999");
  });

  it("内存缓存功能应正常存储与命中", () => {
    const cacheKey = "subhd:d:1889243";
    const dummyResult: SubhdResult = {
      doubanId: "1889243",
      subhdUrl: "https://subhd.cc/d/1889243",
      items: [
        {
          id: "test1",
          title: "测试字幕.ass",
          url: "https://subhd.cc/a/test1",
          languages: ["双语"],
          formats: ["ASS"],
          tags: ["精选推荐"],
        },
      ],
      total: 1,
    };

    subhdCache.set(cacheKey, dummyResult, 60000);
    const cached = subhdCache.get(cacheKey);

    expect(cached.hit).toBe(true);
    expect(cached.value?.items[0].title).toBe("测试字幕.ass");
    expect(cached.value?.items[0].formats).toContain("ASS");
  });

  it("当 doubanId 和 keyword 均为空时直接返回空结果不发送网络请求", async () => {
    const { fetchSubhdSubtitles } = await import("../../server/core/services/subhdService");
    const result = await fetchSubhdSubtitles({});
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });
});
