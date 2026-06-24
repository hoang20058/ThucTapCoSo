async function hashText(text) {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeInputSecret(value) {
  return String(value ?? "");
}

function normalizeStoredSecret(storedValue) {
  if (typeof storedValue !== "string") return "";

  const trimmed = storedValue.trim();
  if (!trimmed) return "";
  if (trimmed === "null" || trimmed === "undefined") return "";

  // Handle legacy values accidentally persisted as JSON strings, e.g. "\"sha256:...\""
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === "string" ? parsed.trim() : trimmed.slice(1, -1).trim();
    } catch {
      return trimmed.slice(1, -1).trim();
    }
  }

  return trimmed;
}

async function hashSecret(text) {
  const normalized = normalizeInputSecret(text);
  return `sha256:${await hashText(normalized)}`;
}

async function verifySecret(text, storedValue) {
  const normalizedStored = normalizeStoredSecret(storedValue);
  const normalizedInput = normalizeInputSecret(text);

  if (!normalizedStored) return false;
  if (normalizedStored.startsWith("sha256:")) {
    return normalizedStored === (await hashSecret(normalizedInput));
  }
  return normalizedStored === normalizedInput;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const PBKDF2_ITERATIONS = 310000;
export const PBKDF2_SALT_BYTES = 16;
export const AES_GCM_IV_BYTES = 12;
export const AES_GCM_KEY_BITS = 256;
const AES_CIPHER_VERSION = 1;
const AES_EXPORT_ALGORITHM = "AES-256-GCM";
const PASSWORD_VERIFIER_ALGORITHM = "PBKDF2-SHA256";
const PASSWORD_VERIFIER_VERSION = 1;

export class CryptoOperationError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = "CryptoOperationError";
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function ensureCryptoApis() {
  if (!globalThis.crypto?.subtle) {
    throw new CryptoOperationError("UNAVAILABLE", "Web Crypto API is not available in this environment.");
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(base64Value, fieldName = "value") {
  if (typeof base64Value !== "string" || !base64Value.trim()) {
    throw new CryptoOperationError("INVALID_INPUT", `Expected non-empty base64 string for ${fieldName}.`);
  }

  const normalized = base64Value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  let binary = "";
  try {
    binary = atob(padded);
  } catch (cause) {
    throw new CryptoOperationError("INVALID_INPUT", `Invalid base64 value for ${fieldName}.`, cause);
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function ensureBytes(value, fieldName) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === "string") return base64ToBytes(value, fieldName);
  throw new CryptoOperationError("INVALID_INPUT", `Expected bytes (Uint8Array/ArrayBuffer/base64) for ${fieldName}.`);
}

function ensureAesKey(key) {
  if (!(key instanceof CryptoKey)) {
    throw new CryptoOperationError("INVALID_KEY", "Encryption key must be a CryptoKey.");
  }
  if (key.algorithm?.name !== "AES-GCM") {
    throw new CryptoOperationError("INVALID_KEY", "Encryption key must use AES-GCM.");
  }
}

function randomBytes(length) {
  ensureCryptoApis();
  const size = Number(length);
  if (!Number.isInteger(size) || size <= 0) {
    throw new CryptoOperationError("INVALID_INPUT", "Random byte length must be a positive integer.");
  }
  return crypto.getRandomValues(new Uint8Array(size));
}

export function generateSalt(size = PBKDF2_SALT_BYTES) {
  return bytesToBase64(randomBytes(size));
}



async function derivePasswordBits(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations,
      salt
    },
    keyMaterial,
    256
  );
}

function normalizePasswordVerifier(storedValue) {
  if (!storedValue) return null;

  if (typeof storedValue === "string") {
    const trimmed = normalizeStoredSecret(storedValue);
    if (!trimmed) return null;

    if (trimmed.startsWith("sha256:")) {
      return { legacyHash: trimmed };
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") return parsed;
      return null;
    } catch {
      return { legacyHash: trimmed };
    }
  }

  if (typeof storedValue === "object") {
    return storedValue;
  }

  return null;
}

async function createPasswordVerifier(password, options = {}) {
  ensureCryptoApis();

  const normalizedPassword = normalizeInputSecret(password);
  if (!normalizedPassword) {
    throw new CryptoOperationError("INVALID_INPUT", "Password is required to create a verifier.");
  }

  const iterations = Number.isInteger(options.iterations) && options.iterations > 0
    ? options.iterations
    : PBKDF2_ITERATIONS;
  const salt = typeof options.salt === "string" && options.salt.trim() ? options.salt.trim() : generateSalt();
  const saltBytes = ensureBytes(salt, "salt");

  const bits = await derivePasswordBits(normalizedPassword, saltBytes, iterations);

  return {
    version: PASSWORD_VERIFIER_VERSION,
    algorithm: PASSWORD_VERIFIER_ALGORITHM,
    iterations,
    salt: bytesToBase64(saltBytes),
    hash: bytesToBase64(new Uint8Array(bits))
  };
}

async function verifyPasswordVerifier(password, storedValue) {
  const normalizedPassword = normalizeInputSecret(password);
  const verifier = normalizePasswordVerifier(storedValue);
  if (!verifier || !normalizedPassword) return false;

  if (verifier.legacyHash) {
    return verifySecret(normalizedPassword, verifier.legacyHash);
  }

  if (verifier.algorithm !== PASSWORD_VERIFIER_ALGORITHM) {
    throw new CryptoOperationError("UNSUPPORTED_ALGORITHM", `Unsupported verifier algorithm: ${String(verifier.algorithm)}.`);
  }

  const version = Number(verifier.version ?? PASSWORD_VERIFIER_VERSION);
  if (version !== PASSWORD_VERIFIER_VERSION) {
    throw new CryptoOperationError("UNSUPPORTED_VERSION", `Unsupported verifier version: ${String(verifier.version)}.`);
  }

  const iterations = Number.isInteger(verifier.iterations) && verifier.iterations > 0
    ? verifier.iterations
    : PBKDF2_ITERATIONS;

  const saltBytes = ensureBytes(verifier.salt, "verifier.salt");
  const expectedHashBytes = ensureBytes(verifier.hash, "verifier.hash");
  const bits = await derivePasswordBits(normalizedPassword, saltBytes, iterations);
  const actualHashBytes = new Uint8Array(bits);

  if (actualHashBytes.length !== expectedHashBytes.length) return false;

  let mismatch = 0;
  for (let index = 0; index < actualHashBytes.length; index += 1) {
    mismatch |= actualHashBytes[index] ^ expectedHashBytes[index];
  }
  return mismatch === 0;
}

export async function deriveKey(password, salt, options = {}) {
  ensureCryptoApis();

  const normalizedPassword = normalizeInputSecret(password);
  if (!normalizedPassword) {
    throw new CryptoOperationError("INVALID_INPUT", "Password is required to derive an encryption key.");
  }

  const saltBytes = ensureBytes(salt, "salt");
  if (saltBytes.length < PBKDF2_SALT_BYTES) {
    throw new CryptoOperationError(
      "INVALID_INPUT",
      `Salt must be at least ${PBKDF2_SALT_BYTES} bytes for PBKDF2 key derivation.`
    );
  }

  const iterations = Number.isInteger(options.iterations) && options.iterations > 0
    ? options.iterations
    : PBKDF2_ITERATIONS;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(normalizedPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations,
      salt: saltBytes
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: AES_GCM_KEY_BITS
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(data, key, options = {}) {
  ensureCryptoApis();
  ensureAesKey(key);

  const payloadType = typeof data === "string" ? "text" : "json";
  const plainText = payloadType === "text" ? data : JSON.stringify(data ?? null);
  const plainBytes = textEncoder.encode(plainText);

  const ivBytes = options.iv ? ensureBytes(options.iv, "iv") : randomBytes(AES_GCM_IV_BYTES);
  if (ivBytes.length !== AES_GCM_IV_BYTES) {
    throw new CryptoOperationError("INVALID_INPUT", `IV must be exactly ${AES_GCM_IV_BYTES} bytes for AES-GCM.`);
  }

  let cipherBuffer;
  try {
    cipherBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: ivBytes
      },
      key,
      plainBytes
    );
  } catch (cause) {
    throw new CryptoOperationError("ENCRYPT_FAILED", "Failed to encrypt data with AES-GCM.", cause);
  }

  return {
    version: AES_CIPHER_VERSION,
    algorithm: AES_EXPORT_ALGORITHM,
    payloadType,
    iv: bytesToBase64(ivBytes),
    cipherText: bytesToBase64(new Uint8Array(cipherBuffer))
  };
}

export async function decrypt(payload, key) {
  ensureCryptoApis();
  ensureAesKey(key);

  if (!payload || typeof payload !== "object") {
    throw new CryptoOperationError("INVALID_PAYLOAD", "Encrypted payload must be an object.");
  }

  const version = Number(payload.version ?? AES_CIPHER_VERSION);
  if (version !== AES_CIPHER_VERSION) {
    throw new CryptoOperationError("UNSUPPORTED_VERSION", `Unsupported cipher payload version: ${String(payload.version)}.`);
  }

  const algorithm = payload.algorithm ?? AES_EXPORT_ALGORITHM;
  if (algorithm !== AES_EXPORT_ALGORITHM) {
    throw new CryptoOperationError("UNSUPPORTED_ALGORITHM", `Unsupported cipher algorithm: ${String(algorithm)}.`);
  }

  const payloadType = payload.payloadType ?? "json";
  if (payloadType !== "json" && payloadType !== "text") {
    throw new CryptoOperationError("INVALID_PAYLOAD", `Unsupported payload type: ${String(payloadType)}.`);
  }

  const ivBytes = ensureBytes(payload.iv, "payload.iv");
  if (ivBytes.length !== AES_GCM_IV_BYTES) {
    throw new CryptoOperationError("INVALID_PAYLOAD", `Encrypted payload IV must be exactly ${AES_GCM_IV_BYTES} bytes.`);
  }

  const cipherBytes = ensureBytes(payload.cipherText, "payload.cipherText");

  let plainBuffer;
  try {
    plainBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes
      },
      key,
      cipherBytes
    );
  } catch (cause) {
    throw new CryptoOperationError(
      "DECRYPT_FAILED",
      "Failed to decrypt payload (wrong password/key, corrupted ciphertext, or IV mismatch).",
      cause
    );
  }

  const plainText = textDecoder.decode(plainBuffer);
  if (payloadType === "text") return plainText;

  try {
    return JSON.parse(plainText);
  } catch (cause) {
    throw new CryptoOperationError("INVALID_PAYLOAD", "Decrypted payload is not valid JSON.", cause);
  }
}

export function generatePassword(length = 16, options = {}) {
  const {
    lowercase = true,
    uppercase = true,
    numbers = true,
    symbols = true
  } = options;

  const pools = [];
  if (lowercase) pools.push("abcdefghijklmnopqrstuvwxyz");
  if (uppercase) pools.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  if (numbers) pools.push("0123456789");
  if (symbols) pools.push("!@#$%^&*()-_=+[]{};:,.?/\\|~");

  const charset = pools.join("") || "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const result = [];

  for (let index = 0; index < length; index += 1) {
    result.push(charset[Math.floor(Math.random() * charset.length)]);
  }

  return result.join("");
}
