import { describe, it, expect } from "vitest";
import {
  generateSalt,
  generateToken,
  generateInviteCode,
  hashPassword,
  verifyPassword,
  encryptCredential,
  decryptCredential,
} from "../../server/core/db/crypto";

describe("Web Crypto 安全模块测试 (纯 JS/TS 零 C++ 依赖)", () => {
  it("生成指定长度随机 Salt 和 Token", () => {
    const salt = generateSalt(16);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);

    const token = generateToken(32);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("生成 8 位大写无歧义邀请码", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    // 不包含易混淆字符 0, O, 1, I
    expect(code).not.toMatch(/[01OI]/);
  });

  it("PBKDF2 密码哈希与恒定时间验证", async () => {
    const password = "MySecretPassword123!";
    const salt = generateSalt();

    const hash = await hashPassword(password, salt);
    expect(hash).toHaveLength(64); // 256 bits = 64 hex chars

    const isValid = await verifyPassword(password, salt, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("WrongPassword", salt, hash);
    expect(isInvalid).toBe(false);
  });

  it("AES-256-GCM 凭据加密与解密闭环", async () => {
    const plainText = "alist-my-secret-token-dx4600-ugos";
    const masterSecret = "my-encryption-key-for-test";

    const encrypted = await encryptCredential(plainText, masterSecret);
    expect(encrypted).toContain(":");
    expect(encrypted).not.toContain(plainText);

    const decrypted = await decryptCredential(encrypted, masterSecret);
    expect(decrypted).toBe(plainText);
  });

  it("AES-256-GCM 错误密钥解密应当抛出异常", async () => {
    const plainText = "aria2-rpc-secret-123456";
    const masterSecret = "correct-key";
    const wrongSecret = "wrong-key";

    const encrypted = await encryptCredential(plainText, masterSecret);
    await expect(decryptCredential(encrypted, wrongSecret)).rejects.toThrow();
  });

  it("自包含 HMAC-SHA256 Session 签名与验证闭环", async () => {
    const { signSessionToken, verifySessionToken } = await import("../../server/core/db/crypto");
    const userPayload = {
      id: "u_test_123",
      email: "test@qq.com",
      username: "Tester",
      role: "admin" as const,
    };

    const token = await signSessionToken(userPayload);
    expect(token).toContain(".");

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(userPayload.id);
    expect(verified?.email).toBe(userPayload.email);
    expect(verified?.role).toBe("admin");

    // 篡改 Token 签名应当验证失败
    const tampered = token.slice(0, -4) + "abcd";
    expect(await verifySessionToken(tampered)).toBeNull();
  });
});
