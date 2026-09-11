// server/core/db/crypto.ts
// 现代纯 Web Crypto API 安全加解密库 (纯 JS/TS，零 C++ 原生模块依赖，100% 兼容 CF Workers)

const subtle = globalThis.crypto?.subtle;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** 生成随机 Salt (Hex 字符串，默认 16 字节) */
export function generateSalt(byteLength: number = 16): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** 生成高熵 Session Token (默认 32 字节 Hex 字符串) */
export function generateToken(byteLength: number = 32): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** 生成 8 位纯随机大写邀请码 (去除容易混淆的 0, O, 1, I) */
export function generateInviteCode(): string {
  const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

/**
 * 基于 Web Crypto PBKDF2 的安全密码哈希
 * 迭代次数 100,000 次，SHA-256，输出 256 位哈希
 */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const passBytes = enc.encode(password);
  const saltBytes = hexToBytes(saltHex);

  const baseKey = await subtle.importKey(
    "raw",
    passBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    256
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

/** 恒定时间安全密码比对 (防时序侧信道攻击) */
export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHashHex: string
): Promise<boolean> {
  const actualHashHex = await hashPassword(password, saltHex);
  if (actualHashHex.length !== expectedHashHex.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < actualHashHex.length; i++) {
    mismatch |= actualHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  }
  return mismatch === 0;
}

/** 从主密钥字符串派生 AES-256-GCM 密钥 */
async function deriveAesKey(masterSecret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const secretBytes = enc.encode(masterSecret || "panhub-default-fallback-secret-2026");
  const hashBuffer = await subtle.digest("SHA-256", secretBytes);
  return await subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * 零知识凭据加密：AES-256-GCM
 * 输出格式：iv(12字节Base64):ciphertext(含Tag的Base64)
 */
export async function encryptCredential(
  plainText: string,
  masterSecret: string
): Promise<string> {
  if (!plainText) return "";
  const key = await deriveAesKey(masterSecret);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const enc = new TextEncoder();
  const plainBytes = enc.encode(plainText);

  const cipherBuffer = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    plainBytes
  );

  const ivB64 = bytesToBase64(iv);
  const cipherB64 = bytesToBase64(new Uint8Array(cipherBuffer));
  return `${ivB64}:${cipherB64}`;
}

/**
 * 零知识凭据解密：AES-256-GCM
 */
export async function decryptCredential(
  encryptedText: string,
  masterSecret: string
): Promise<string> {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted format, expected iv:ciphertext");
  }

  const [ivB64, cipherB64] = parts;
  const iv = base64ToBytes(ivB64);
  const cipherBytes = base64ToBytes(cipherB64);

  const key = await deriveAesKey(masterSecret);
  const plainBuffer = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    cipherBytes
  );

  const dec = new TextDecoder();
  return dec.decode(plainBuffer);
}
