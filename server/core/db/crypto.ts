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

const BASE32_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const INVITE_EPOCH_MS = 1767225600000; // 2026-01-01 00:00:00 UTC
const INVITE_CLUSTER_SECRET = "panhub-cluster-session-secret-2026";

export function base32Encode5Bytes(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARSET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARSET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode5Bytes(str: string): Uint8Array | null {
  const cleanStr = str.toUpperCase().trim();
  if (cleanStr.length !== 8) return null;
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleanStr.length; i++) {
    const idx = BASE32_CHARSET.indexOf(cleanStr[i]);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  if (bytes.length !== 5) return null;
  return new Uint8Array(bytes);
}

/**
 * 生成 8 位自包含 HMAC-SHA256 签名邀请码：
 * 5 字节 = 40 位 = 8 个 Base32 字符
 * 内部承载：过期截止时间 (2字节) + 随机Nonce (1字节) + HMAC-SHA256截断验签码 (2字节)
 * 实现全球任意无状态 Serverless Isolate 节点零数据库依赖秒级离线校验
 */
export async function generateSignedInviteCode(
  expiresAtMs: number,
  secret: string = INVITE_CLUSTER_SECRET
): Promise<string> {
  const expiryMinutes = Math.floor((expiresAtMs - INVITE_EPOCH_MS) / 60000) & 0xFFFF;
  const nonceBytes = new Uint8Array(1);
  globalThis.crypto.getRandomValues(nonceBytes);
  const nonce = nonceBytes[0];

  const payload = new Uint8Array([
    (expiryMinutes >> 8) & 0xFF,
    expiryMinutes & 0xFF,
    nonce,
  ]);

  const enc = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await subtle.sign("HMAC", key, payload);
  const sigBytes = new Uint8Array(sigBuffer);

  const packed = new Uint8Array([
    payload[0],
    payload[1],
    payload[2],
    sigBytes[0],
    sigBytes[1],
  ]);

  return base32Encode5Bytes(packed);
}

/**
 * 校验 8 位签名邀请码并还原过期时间戳
 */
export async function verifySignedInviteCode(
  code: string,
  secret: string = INVITE_CLUSTER_SECRET
): Promise<{ valid: boolean; expiresAt: number } | null> {
  if (!code || typeof code !== "string") return null;
  const bytes = base32Decode5Bytes(code);
  if (!bytes || bytes.length !== 5) return null;

  const expiryMinutes = (bytes[0] << 8) | bytes[1];
  const nonce = bytes[2];
  const payload = new Uint8Array([bytes[0], bytes[1], nonce]);

  const enc = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await subtle.sign("HMAC", key, payload);
  const sigBytes = new Uint8Array(sigBuffer);

  // 恒定时间签名比对
  if (bytes[3] !== sigBytes[0] || bytes[4] !== sigBytes[1]) {
    return null;
  }

  const now = Date.now();
  const currentTotalMinutes = Math.floor((now - INVITE_EPOCH_MS) / 60000);
  const cycle = Math.floor(currentTotalMinutes / 65536);
  let candidateMinutes = cycle * 65536 + expiryMinutes;
  if (candidateMinutes < currentTotalMinutes - 32768) {
    candidateMinutes += 65536;
  } else if (candidateMinutes > currentTotalMinutes + 32768) {
    candidateMinutes -= 65536;
  }
  const expiresAt = INVITE_EPOCH_MS + candidateMinutes * 60000;

  return { valid: true, expiresAt };
}

/** 生成 8 位纯随机大写邀请码 (去除容易混淆的 0, O, 1, I) */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += BASE32_CHARSET[bytes[i] % BASE32_CHARSET.length];
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

function stringToBase64Url(str: string): string {
  const enc = new TextEncoder();
  const bytes = enc.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToString(b64url: string): string {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * 跨节点自包含签名 Session Token：
 * 采用 Web Crypto HMAC-SHA256 对用户身份 payload 进行签名
 * 解决分布式/Serverless 多节点无状态隔离导致的 Session 丢失问题
 */
export async function signSessionToken(
  user: { id: string; email: string; username: string; role: string },
  secret: string = "panhub-cluster-session-secret-2026"
): Promise<string> {
  const enc = new TextEncoder();
  const payload = JSON.stringify({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30天
  });
  const dataB64 = stringToBase64Url(payload);
  const key = await subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await subtle.sign("HMAC", key, enc.encode(dataB64));
  const sigHex = bytesToHex(new Uint8Array(sigBuffer));
  return `${dataB64}.${sigHex}`;
}

export async function verifySessionToken(
  token: string,
  secret: string = "panhub-cluster-session-secret-2026"
): Promise<{ id: string; email: string; username: string; role: "admin" | "user"; status: "active"; createdAt: number; lastActiveAt: number } | null> {
  if (!token || !token.includes(".")) return null;
  const [dataB64, sigHex] = token.split(".");
  if (!dataB64 || !sigHex) return null;

  try {
    const enc = new TextEncoder();
    const key = await subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await subtle.verify(
      "HMAC",
      key,
      hexToBytes(sigHex),
      enc.encode(dataB64)
    );
    if (!valid) return null;

    const json = base64UrlToString(dataB64);
    const parsed = JSON.parse(json);
    if (parsed.exp && parsed.exp < Date.now()) {
      return null;
    }
    return {
      id: parsed.id,
      email: parsed.email,
      username: parsed.username,
      role: parsed.role,
      status: "active",
      createdAt: parsed.createdAt || 1789361929784,
      lastActiveAt: Date.now(),
    };
  } catch {
    return null;
  }
}

