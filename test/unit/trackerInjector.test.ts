import { describe, it, expect } from "vitest";
import {
  HIGH_AVAILABILITY_TRACKERS,
  extractTrackersFromMagnet,
  enhanceMagnetUrlWithTrackers,
} from "../../server/core/nas/trackerInjector";

describe("Tracker 活水注入模块 (trackerInjector)", () => {
  it("非磁力链接或空字符串应原样返回，不产生任何副作用", () => {
    expect(enhanceMagnetUrlWithTrackers("")).toBe("");
    expect(enhanceMagnetUrlWithTrackers(null as any)).toBe(null);
    expect(enhanceMagnetUrlWithTrackers("https://example.com/file.torrent")).toBe(
      "https://example.com/file.torrent"
    );
    expect(enhanceMagnetUrlWithTrackers("ed2k://|file|test|123|abc/")).toBe(
      "ed2k://|file|test|123|abc/"
    );
  });

  it("正确提取磁力链接中已有 Tracker 并自动小写规范化", () => {
    const magnet =
      "magnet:?xt=urn:btih:dc36bc7e6dd458a4298651450d35737256632dbd&dn=Oppenheimer&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=http%3A%2F%2Fexample.com%2Fannounce";
    const trackers = extractTrackersFromMagnet(magnet);
    expect(trackers.size).toBe(2);
    expect(trackers.has("udp://tracker.opentrackr.org:1337/announce")).toBe(true);
    expect(trackers.has("http://example.com/announce")).toBe(true);
  });

  it("当磁力链接无任何 Tracker 时，自动完整注入高可用 Tracker 矩阵", () => {
    const rawMagnet =
      "magnet:?xt=urn:btih:aba9bb6576cd7dec91dd22981e4fdad605666aa3&dn=RoOT";
    const enhanced = enhanceMagnetUrlWithTrackers(rawMagnet);

    expect(enhanced.startsWith(rawMagnet)).toBe(true);
    expect(enhanced).toContain("&tr=");

    const extracted = extractTrackersFromMagnet(enhanced);
    for (const tr of HIGH_AVAILABILITY_TRACKERS) {
      expect(extracted.has(tr.toLowerCase())).toBe(true);
    }
  });

  it("当磁力链接已包含部分 Tracker 时，智能去重仅追加缺失的 Tracker", () => {
    const existingTracker = "udp://tracker.opentrackr.org:1337/announce";
    const rawMagnet = `magnet:?xt=urn:btih:1234567890123456789012345678901234567890&dn=Test&tr=${encodeURIComponent(
      existingTracker
    )}`;

    const enhanced = enhanceMagnetUrlWithTrackers(rawMagnet);

    // 验证已有 tracker 绝不重复出现两遍
    const trMatches = enhanced.match(new RegExp(encodeURIComponent(existingTracker), "gi"));
    expect(trMatches?.length).toBe(1);

    // 验证其他高可用 Tracker 已成功补齐
    const extracted = extractTrackersFromMagnet(enhanced);
    expect(extracted.has("udp://open.stealth.si:80/announce")).toBe(true);
    expect(extracted.has("http://nyaa.tracker.wf:7777/announce")).toBe(true);
  });

  it("支持传入自定义 Tracker 列表并智能合并去重", () => {
    const rawMagnet = "magnet:?xt=urn:btih:1234567890123456789012345678901234567890";
    const customTrackers = [
      "udp://custom.tracker.org:8080/announce",
      "udp://open.stealth.si:80/announce", // 已包含在高可用列表
    ];

    const enhanced = enhanceMagnetUrlWithTrackers(rawMagnet, customTrackers);
    const extracted = extractTrackersFromMagnet(enhanced);

    expect(extracted.has("udp://custom.tracker.org:8080/announce")).toBe(true);
    expect(extracted.has("udp://open.stealth.si:80/announce")).toBe(true);
    expect(extracted.size).toBe(2);
  });
});
