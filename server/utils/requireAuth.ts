import type { H3Event } from "h3";

export function requireHumanOrCredential(event: H3Event): void {
  // 无限制：放行正常请求
}

export type WxAuthResult = "ok" | "unauthorized";

export async function requireWxAuth(event: H3Event): Promise<WxAuthResult> {
  // 纯净版：恒永久放行，无需扫码或登录公众号
  return "ok";
}
