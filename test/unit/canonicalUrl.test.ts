import { describe, expect, it } from "vitest";
import {
  extractPassword,
  getCanonicalDriveInfo,
} from "../../utils/canonicalUrl";

describe("URL Canonicalization 规范化与去重测试", () => {
  it("正确规范化夸克网盘链接（忽略 b.quark.cn 前缀、参数与哈希）", () => {
    const u1 = "https://pan.quark.cn/s/669fbb7c66cb";
    const u2 = "https://b.quark.cn/s/669fbb7c66cb?pwd=abcd#/list/share";
    const u3 = "https://pan.quark.cn/s/669fbb7c66cb/";

    const c1 = getCanonicalDriveInfo(u1);
    const c2 = getCanonicalDriveInfo(u2);
    const c3 = getCanonicalDriveInfo(u3);

    expect(c1.canonicalKey).toBe("quark:669fbb7c66cb");
    expect(c2.canonicalKey).toBe("quark:669fbb7c66cb");
    expect(c3.canonicalKey).toBe("quark:669fbb7c66cb");
    expect(c2.cleanUrl).toBe("https://pan.quark.cn/s/669fbb7c66cb");
    expect(extractPassword(u2)).toBe("abcd");
  });

  it("正确规范化百度网盘链接（兼容 /s/1xxx 与 /share/init?surl=xxx）", () => {
    const u1 = "https://pan.baidu.com/s/1abcdef123?pwd=8888";
    const u2 = "https://pan.baidu.com/share/init?surl=abcdef123&pwd=8888";

    const c1 = getCanonicalDriveInfo(u1);
    const c2 = getCanonicalDriveInfo(u2);

    expect(c1.canonicalKey).toBe("baidu:abcdef123");
    expect(c2.canonicalKey).toBe("baidu:abcdef123");
    expect(extractPassword(u1)).toBe("8888");
    expect(extractPassword(u2)).toBe("8888");
  });

  it("正确规范化阿里云盘链接（兼容 alipan.com 与 aliyundrive.com）", () => {
    const u1 = "https://www.alipan.com/s/xyz987";
    const u2 = "https://www.aliyundrive.com/s/xyz987?token=xxx";

    const c1 = getCanonicalDriveInfo(u1);
    const c2 = getCanonicalDriveInfo(u2);

    expect(c1.canonicalKey).toBe("aliyun:xyz987");
    expect(c2.canonicalKey).toBe("aliyun:xyz987");
  });

  it("正确规范化迅雷网盘、123云盘与UC网盘", () => {
    const xunlei = getCanonicalDriveInfo("https://pan.xunlei.com/s/VN_test123");
    expect(xunlei.canonicalKey).toBe("xunlei:VN_test123");

    const pan123 = getCanonicalDriveInfo("https://www.123684.com/s/test-abc");
    expect(pan123.canonicalKey).toBe("123pan:test-abc");

    const uc = getCanonicalDriveInfo("https://drive.uc.cn/s/uc999");
    expect(uc.canonicalKey).toBe("uc:uc999");
  });

  it("通用链接剥离参数与 hash", () => {
    const gen = getCanonicalDriveInfo("https://example.com/share/item1?from=app#top");
    expect(gen.cleanUrl).toBe("https://example.com/share/item1");
    expect(gen.canonicalKey).toBe("general:https://example.com/share/item1");
  });
});
