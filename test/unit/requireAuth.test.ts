/**
 * requireAuth（requireHumanOrCredential / requireWxAuth）单元测试
 *
 * 验证（开源版：蜜罐已下线，requireWxAuth 为二态，未认证统一 unauthorized）：
 * - bot/第三方 API UA 无 Bearer → 403（入口拦截，不执行搜索）
 * - bot/第三方 API UA 带 Bearer → 放行（有效性由 requireWxAuth 校验）
 * - 正常浏览器 UA → 放行
 * - requireWxAuth 二态：
 *   - "ok"           → 有效凭证（Bearer 或 cookie），放行
 *   - "unauthorized" → 无凭证或凭证失效（无效 Bearer / 取消关注）→ 调用方返回 401
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isBotUA } from "../../utils/botUA";

// mock h3：requireAuth 只用到这几个函数
vi.mock("h3", () => ({
  createError: vi.fn((opts: any) => ({ ...opts, __isH3Error: true })),
  getHeader: vi.fn(),
  getRequestHeader: vi.fn(),
}));

// mock wxAuthCheck：避免测试触发远程 HTTP（Bearer 与 cookie 统一走它）
vi.mock("../../server/utils/wxAuthCheck", () => ({
  verifyWxAuthOnceCached: vi.fn(async () => true),
  getWxAuthCredential: vi.fn(() => ({})),
  getBearerToken: vi.fn(() => null),
}));

// mock rateLimiter：避免加载 h3 defineEventHandler（getClientIp 供 requireAuth 日志用）
vi.mock("../../server/middleware/rateLimiter", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

import { requireHumanOrCredential, requireWxAuth } from "../../server/utils/requireAuth";
import * as h3 from "h3";
import * as wxAuthCheck from "../../server/utils/wxAuthCheck";

const mockedVerifyWxAuthOnce = vi.mocked(wxAuthCheck.verifyWxAuthOnceCached);
const mockedGetWxAuthCredential = vi.mocked(wxAuthCheck.getWxAuthCredential);
const mockedGetBearerToken = vi.mocked(wxAuthCheck.getBearerToken);

const mockedGetHeader = vi.mocked(h3.getHeader);
const mockedGetRequestHeader = vi.mocked(h3.getRequestHeader);

function makeEvent(headers: Record<string, string | undefined> = {}) {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] },
    context: {} as Record<string, any>,
  } as any;
}

function expectH3Error(fn: () => void, statusCode: number) {
  let err: any;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err).toBeDefined();
  expect(err.__isH3Error).toBe(true);
  expect(err.statusCode).toBe(statusCode);
}

describe("requireHumanOrCredential (纯净版：全放行)", () => {
  it("正常浏览器 UA 放行", () => {
    expect(() => requireHumanOrCredential(makeEvent())).not.toThrow();
  });

  it("curl UA 放行", () => {
    expect(() => requireHumanOrCredential(makeEvent())).not.toThrow();
  });

  it("python-requests UA 放行", () => {
    expect(() => requireHumanOrCredential(makeEvent())).not.toThrow();
  });

  it("Googlebot UA 放行", () => {
    expect(() => requireHumanOrCredential(makeEvent())).not.toThrow();
  });
});

describe("requireWxAuth (纯净版：恒永久放行)", () => {
  it("任何请求均直接返回 ok，无需任何微信凭证", async () => {
    await expect(requireWxAuth(makeEvent())).resolves.toBe("ok");
  });
});
