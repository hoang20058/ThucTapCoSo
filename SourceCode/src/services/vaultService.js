import {
  PBKDF2_ITERATIONS,
  CryptoOperationError,
  deriveKey,
  encrypt,
  decrypt,
  generateSalt
} from "../utils/crypto";
import { fetchFromIPFS, uploadToIPFS } from "./ipfsService";
import { getVaultCidFromChain, updateVaultCidOnChain, getBlockchainSigner } from "./blockchainService";
import {
  ErrorCodes,
  VaultServiceError,
  getUserFriendlyMessage,
  isRetryableError,
  normalizeError,
  retryAsync,
  validateEthereumAddress
} from "../utils/errorHandling";

const DB_VERSION = 1;
const STORE_VAULT = "vaultEncrypted";
const STORE_META = "vaultMeta";
const RECORD_ID = "primary";
const META_KEY_SALT = "kdfSaltV1";
const META_KEY_MIGRATED = "migratedFromLocalStorageV1";
const META_KEY_LAST_SYNCED_CID = "lastSyncedCid";
const META_KEY_PENDING_SYNC = "pendingSyncV1";
const EXPORT_FORMAT = "vault-ciphertext-v1";

const databases = {};

export async function getIdentityAddress(identity) {
  if (!identity) return null;
  if (identity.address) return identity.address;
  if (identity.uid) {
    const signer = await getBlockchainSigner("google", identity.uid);
    return await signer.getAddress();
  }
  return null;
}

function ensureIndexedDbAvailable() {
  if (!globalThis.indexedDB) {
    throw new VaultServiceError(ErrorCodes.LOCAL_SAVE_FAILED, "IndexedDB is not available");
  }
}

function openDatabase(userAddress) {
  ensureIndexedDbAvailable();
  if (!userAddress) {
    throw new VaultServiceError(ErrorCodes.LOCAL_SAVE_FAILED, "userAddress is required to open database");
  }
  const dbName = `vault-db-${userAddress.toLowerCase()}`;
  if (databases[dbName]) return databases[dbName];

  databases[dbName] = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_VAULT)) {
        db.createObjectStore(STORE_VAULT, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new VaultServiceError(ErrorCodes.LOCAL_SAVE_FAILED));
  });

  return databases[dbName];
}

function txPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new VaultServiceError(ErrorCodes.LOCAL_SAVE_FAILED));
    transaction.onabort = () => reject(transaction.error || new VaultServiceError(ErrorCodes.LOCAL_SAVE_FAILED));
  });
}

function reqPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new VaultServiceError(ErrorCodes.LOCAL_SAVE_FAILED));
  });
}

async function getMeta(db, key) {
  const tx = db.transaction(STORE_META, "readonly");
  const record = await reqPromise(tx.objectStore(STORE_META).get(key));
  await txPromise(tx);
  return record?.value;
}

async function setMeta(db, key, value) {
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put({ key, value, updatedAt: Date.now() });
  await txPromise(tx);
}

async function deleteMeta(db, key) {
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).delete(key);
  await txPromise(tx);
}

async function getVaultRecord(db) {
  const tx = db.transaction(STORE_VAULT, "readonly");
  const record = await reqPromise(tx.objectStore(STORE_VAULT).get(RECORD_ID));
  await txPromise(tx);
  return record || null;
}

async function putVaultRecord(db, payload) {
  const tx = db.transaction(STORE_VAULT, "readwrite");
  tx.objectStore(STORE_VAULT).put({ id: RECORD_ID, payload, updatedAt: Date.now() });
  await txPromise(tx);
}

function normalizeVaultArray(vaults) {
  return Array.isArray(vaults) ? vaults : [];
}

function normalizeSaveOptions(optionsOrSkipIpfs = {}) {
  if (typeof optionsOrSkipIpfs === "boolean") {
    return { skipWeb3: optionsOrSkipIpfs };
  }

  return {
    skipWeb3: Boolean(optionsOrSkipIpfs.skipWeb3 || optionsOrSkipIpfs.skipIpfs),
    onProgress: typeof optionsOrSkipIpfs.onProgress === "function" ? optionsOrSkipIpfs.onProgress : null
  };
}

function emitProgress(onProgress, stage, message, meta = {}) {
  onProgress?.({ stage, message, ...meta });
}

async function resolveOrCreateSalt(db, preferredSalt = null) {
  if (preferredSalt) {
    await setMeta(db, META_KEY_SALT, preferredSalt);
    return preferredSalt;
  }
  const existingSalt = await getMeta(db, META_KEY_SALT);
  if (typeof existingSalt === "string" && existingSalt.trim()) {
    return existingSalt.trim();
  }

  const nextSalt = generateSalt();
  await setMeta(db, META_KEY_SALT, nextSalt);
  return nextSalt;
}

function ensureEncryptionKey(encryptionKey) {
  if (!(encryptionKey instanceof CryptoKey)) {
    throw new Error("Phiên đang khóa. Vui lòng mở khóa trước khi thay đổi vault.");
  }
}

async function deriveVaultKey(password, db) {
  const normalizedSecret = String(password ?? "").trim();
  if (!normalizedSecret) {
    throw new Error("Master password is required to access encrypted vault data");
  }

  const salt = await resolveOrCreateSalt(db);
  return deriveKey(normalizedSecret, salt, { iterations: PBKDF2_ITERATIONS });
}

async function persistLocalVault(db, encryptedPayload) {
  await resolveOrCreateSalt(db);
  await putVaultRecord(db, encryptedPayload);
}

function canFallbackToLocal(error, disallowFallback = false) {
  if (disallowFallback) return false;
  const normalized = normalizeError(error, ErrorCodes.SYNC_FAILED);
  return isRetryableError(normalized);
}

export const vaultService = {
  async checkUserRegistration(userAddress, providerType = "metamask") {
    if (!userAddress) return false;
    try {
      const { cid } = await getVaultCidFromChain(userAddress, providerType);
      return Boolean(cid && cid.trim());
    } catch (error) {
      console.error("checkUserRegistration error:", error);
      return false;
    }
  },

  async unlockAndSyncVault(password, userAddress, providerType = "metamask", uid = null) {
    const db = await openDatabase(userAddress);
    const { cid, error: chainError } = await getVaultCidFromChain(userAddress, providerType);
    if (chainError) {
      throw new VaultServiceError(ErrorCodes.SYNC_FAILED, `Blockchain error: ${chainError}`);
    }
    if (!cid) {
      throw new VaultServiceError(ErrorCodes.SYNC_FAILED, "Không tìm thấy dữ liệu Vault trên Blockchain cho tài khoản này.");
    }

    let payload;
    try {
      payload = await fetchFromIPFS(cid);
    } catch (ipfsError) {
      throw new VaultServiceError(
        ErrorCodes.IPFS_FETCH_FAILED,
        "Không thể tải dữ liệu từ IPFS. Vui lòng kiểm tra kết nối mạng.",
        ipfsError
      );
    }

    if (!payload || !payload.encryptedPayload || !payload.salt) {
      throw new VaultServiceError(
        ErrorCodes.DECRYPTION_FAILED,
        "Dữ liệu tải từ IPFS không hợp lệ hoặc bị hỏng."
      );
    }

    const { encryptedPayload, salt } = payload;
    const encryptionKey = await deriveKey(password, salt, { iterations: PBKDF2_ITERATIONS });

    let decrypted;
    try {
      decrypted = await decrypt(encryptedPayload, encryptionKey);
    } catch (cryptoError) {
      throw new CryptoOperationError(
        "DECRYPT_FAILED",
        "Master Password không chính xác.",
        cryptoError
      );
    }

    // Gotcha 1: Logic kiểm tra Tương thích ngược cực kỳ cẩn thận
    let vaultData;
    if (Array.isArray(decrypted)) {
      // Dữ liệu cũ
      vaultData = {
        userProfile: { fullName: "", dob: "", phone: "" },
        passwordEntries: decrypted
      };
    } else if (decrypted && typeof decrypted === "object" && "passwordEntries" in decrypted) {
      // Dữ liệu mới
      vaultData = decrypted;
    } else {
      vaultData = {
        userProfile: { fullName: "", dob: "", phone: "" },
        passwordEntries: []
      };
    }

    await resolveOrCreateSalt(db, salt);
    await putVaultRecord(db, encryptedPayload);
    await setMeta(db, META_KEY_LAST_SYNCED_CID, cid);
    await setMeta(db, META_KEY_MIGRATED, true);
    await deleteMeta(db, META_KEY_PENDING_SYNC);

    return {
      vaults: normalizeVaultArray(vaultData.passwordEntries),
      userProfile: vaultData.userProfile || { fullName: "", dob: "", phone: "" },
      encryptionKey
    };
  },

  async registerNewVault(password, userAddress, providerType = "metamask", uid = null, profileData = null) {
    const db = await openDatabase(userAddress);
    const salt = generateSalt();
    await resolveOrCreateSalt(db, salt);

    const encryptionKey = await deriveKey(password, salt, { iterations: PBKDF2_ITERATIONS });
    const userProfile = profileData || { fullName: "", dob: "", phone: "" };
    const rawVaultData = {
      userProfile,
      passwordEntries: []
    };
    const encryptedPayload = await encrypt(rawVaultData, encryptionKey);

    const ipfsPayload = {
      encryptedPayload,
      salt
    };

    const cid = await uploadToIPFS(ipfsPayload);

    const txResult = await updateVaultCidOnChain(cid, providerType, uid);
    if (!txResult.success) {
      throw new VaultServiceError(
        txResult.code || ErrorCodes.TRANSACTION_FAILED,
        txResult.error || "Ghi CID lên Blockchain thất bại",
        txResult.details
      );
    }

    await putVaultRecord(db, encryptedPayload);
    await setMeta(db, META_KEY_LAST_SYNCED_CID, cid);
    await setMeta(db, META_KEY_MIGRATED, true);
    await deleteMeta(db, META_KEY_PENDING_SYNC);

    return {
      vaults: [],
      userProfile,
      encryptionKey
    };
  },

  async deriveVaultKeyFromPassword(password, userAddress) {
    const db = await openDatabase(userAddress);
    const salt = await resolveOrCreateSalt(db);
    return deriveKey(String(password ?? ""), salt, { iterations: PBKDF2_ITERATIONS });
  },

  async hasVaultData(userAddress) {
    if (!userAddress) return false;
    const db = await openDatabase(userAddress);
    const record = await getVaultRecord(db);
    return Boolean(record?.payload);
  },

  async ensureVaultStorage(encryptionKey, userAddress, options = {}) {
    ensureEncryptionKey(encryptionKey);
    const db = await openDatabase(userAddress);
    const hasMigrated = Boolean(await getMeta(db, META_KEY_MIGRATED));
    const existingRecord = await getVaultRecord(db);

    if (existingRecord) {
      if (!hasMigrated) await setMeta(db, META_KEY_MIGRATED, true);
      return { migrated: false, count: 0 };
    }

    let migratedCount = 0;
    const legacyRawText = options.legacyVaultRawText;
    if (typeof legacyRawText === "string" && legacyRawText.trim()) {
      try {
        const parsed = JSON.parse(legacyRawText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await this.saveVaultsWithKey(parsed, encryptionKey, userAddress, { skipWeb3: true });
          migratedCount = parsed.length;
        }
      } catch {
        // Ignore malformed legacy payload and continue with an empty vault.
      }
    }

    if (migratedCount === 0) {
      await this.saveVaultsWithKey([], encryptionKey, userAddress, { skipWeb3: true });
    }

    await setMeta(db, META_KEY_MIGRATED, true);
    return { migrated: migratedCount > 0, count: migratedCount };
  },

  async loadVaultAndProfileWithKey(encryptionKey, userAddress) {
    ensureEncryptionKey(encryptionKey);
    const db = await openDatabase(userAddress);
    const record = await getVaultRecord(db);
    if (!record?.payload) {
      return { vaults: [], userProfile: { fullName: "", dob: "", phone: "" } };
    }

    const decrypted = await decrypt(record.payload, encryptionKey);
    let vaultData;
    if (Array.isArray(decrypted)) {
      // Dữ liệu cũ
      vaultData = {
        userProfile: { fullName: "", dob: "", phone: "" },
        passwordEntries: decrypted
      };
    } else if (decrypted && typeof decrypted === "object" && "passwordEntries" in decrypted) {
      // Dữ liệu mới
      vaultData = decrypted;
    } else {
      vaultData = {
        userProfile: { fullName: "", dob: "", phone: "" },
        passwordEntries: []
      };
    }
    return {
      vaults: normalizeVaultArray(vaultData.passwordEntries),
      userProfile: vaultData.userProfile || { fullName: "", dob: "", phone: "" }
    };
  },

  async loadVaultsWithKey(encryptionKey, userAddress) {
    const res = await this.loadVaultAndProfileWithKey(encryptionKey, userAddress);
    return res.vaults;
  },

  async saveVaultsWithKey(vaults, encryptionKey, userAddress, optionsOrSkipIpfs = {}) {
    ensureEncryptionKey(encryptionKey);

    const options = normalizeSaveOptions(optionsOrSkipIpfs);
    const normalizedVaults = normalizeVaultArray(vaults);
    const db = await openDatabase(userAddress);

    const userProfile = optionsOrSkipIpfs.userProfile || { fullName: "", dob: "", phone: "" };
    const rawVaultData = {
      userProfile,
      passwordEntries: normalizedVaults
    };

    emitProgress(options.onProgress, "encrypting", "Đang mã hóa vault...");
    const encryptedPayload = await encrypt(rawVaultData, encryptionKey);
    const salt = await resolveOrCreateSalt(db);
    const ipfsPayload = {
      encryptedPayload,
      salt
    };

    const canUseWeb3 =
      !options.skipWeb3 &&
      Boolean(import.meta.env.VITE_PINATA_JWT) &&
      Boolean(import.meta.env.VITE_VAULT_CONTRACT_ADDRESS);

    if (!canUseWeb3) {
      emitProgress(options.onProgress, "local", "Đang lưu local...");
      await persistLocalVault(db, encryptedPayload);
      return {
        vaults: normalizedVaults,
        sync: { status: "skipped", message: "Đã lưu local. Web3 sync chưa được cấu hình." }
      };
    }

    try {
      emitProgress(options.onProgress, "ipfs", "Đang upload IPFS...");
      const cid = await retryAsync(() => uploadToIPFS(ipfsPayload), {
        maxRetries: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        onRetry: ({ attempt, maxRetries }) =>
          emitProgress(options.onProgress, "retry", `Upload IPFS lỗi, đang thử lại ${attempt + 1}/${maxRetries}...`)
      });

      emitProgress(options.onProgress, "chain", "Đang chờ blockchain xác nhận giao dịch...");
      // Use explicitly passed providerType from context options
      const providerType = optionsOrSkipIpfs.providerType || "metamask";

      const txResult = await retryAsync(
        async () => {
          const uid = optionsOrSkipIpfs.uid || null;
          const result = await updateVaultCidOnChain(cid, providerType, uid);
          if (!result.success) {
            throw new VaultServiceError(result.code || ErrorCodes.TRANSACTION_FAILED, result.error, result.details);
          }
          return result;
        },
        {
          maxRetries: 3,
          initialDelayMs: 1500,
          backoffMultiplier: 2,
          onRetry: ({ attempt, maxRetries }) =>
            emitProgress(options.onProgress, "retry", `RPC chưa ổn định, đang thử lại ${attempt + 1}/${maxRetries}...`)
        }
      );

      emitProgress(options.onProgress, "local", "Đang cập nhật bản local...");
      await persistLocalVault(db, encryptedPayload);
      await setMeta(db, META_KEY_LAST_SYNCED_CID, cid);
      await deleteMeta(db, META_KEY_PENDING_SYNC);

      emitProgress(options.onProgress, "complete", "Đã lưu và đồng bộ blockchain.");
      return {
        vaults: normalizedVaults,
        sync: {
          status: "synced",
          cid,
          txHash: txResult.txHash,
          blockNumber: txResult.blockNumber,
          message: "Đã lưu local và cập nhật pointer blockchain."
        }
      };
    } catch (error) {
      const normalized = normalizeError(error, ErrorCodes.SYNC_FAILED);
      const disallowFallback = typeof optionsOrSkipIpfs === "object" && optionsOrSkipIpfs !== null
        ? Boolean(optionsOrSkipIpfs.disallowFallback)
        : false;

      if (!canFallbackToLocal(normalized, disallowFallback)) {
        emitProgress(options.onProgress, "failed", getUserFriendlyMessage(normalized), { error: normalized });
        throw normalized;
      }

      emitProgress(options.onProgress, "fallback", "Mạng Web3 lỗi. Đang lưu local để bạn không mất dữ liệu...");
      await persistLocalVault(db, encryptedPayload);
      await setMeta(db, META_KEY_PENDING_SYNC, {
        reason: normalized.code,
        message: getUserFriendlyMessage(normalized),
        updatedAt: Date.now()
      });

      return {
        vaults: normalizedVaults,
        sync: {
          status: "local_fallback",
          code: normalized.code,
          message: "Đã lưu local. Web3 sync sẽ cần thử lại khi mạng ổn định.",
          error: getUserFriendlyMessage(normalized)
        }
      };
    }
  },

  async syncVaultOnLogin(encryptionKey, userAddress, options = {}) {
    ensureEncryptionKey(encryptionKey);
    const db = await openDatabase(userAddress);
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;

    try {
      const validAddress = validateEthereumAddress(userAddress);
      emitProgress(onProgress, "chain", "Đang kiểm tra pointer trên blockchain...");

      const providerType = options.providerType || "metamask";

      const { cid, error, code } = await getVaultCidFromChain(validAddress, providerType);
      if (error || !cid) {
        return { synced: false, reason: error || "No CID on chain", code };
      }

      const localSyncedCid = await getMeta(db, META_KEY_LAST_SYNCED_CID);
      if (localSyncedCid === cid) {
        const res = await this.loadVaultAndProfileWithKey(encryptionKey, userAddress);
        return {
          synced: true,
          reason: "Already up-to-date",
          vaults: res.vaults,
          userProfile: res.userProfile
        };
      }

      emitProgress(onProgress, "ipfs", "Đang tải vault mới nhất từ IPFS...");
      const payloadFromIpfs = await retryAsync(() => fetchFromIPFS(cid), {
        maxRetries: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        onRetry: ({ attempt, maxRetries }) =>
          emitProgress(onProgress, "retry", `Tải IPFS lỗi, đang thử lại ${attempt + 1}/${maxRetries}...`)
      });

      if (!payloadFromIpfs || !payloadFromIpfs.encryptedPayload || !payloadFromIpfs.salt) {
        throw new VaultServiceError(
          ErrorCodes.DECRYPTION_FAILED,
          "Dữ liệu tải từ IPFS không hợp lệ hoặc bị hỏng."
        );
      }

      const { encryptedPayload, salt } = payloadFromIpfs;

      emitProgress(onProgress, "decrypting", "Đang giải mã dữ liệu đồng bộ...");
      let decrypted;
      try {
        decrypted = await decrypt(encryptedPayload, encryptionKey);
      } catch (error) {
        throw new VaultServiceError(
          ErrorCodes.DECRYPTION_FAILED,
          "Cannot decrypt synced vault. Master password may not match this on-chain data.",
          error
        );
      }

      let vaultData;
      if (Array.isArray(decrypted)) {
        vaultData = {
          userProfile: { fullName: "", dob: "", phone: "" },
          passwordEntries: decrypted
        };
      } else if (decrypted && typeof decrypted === "object" && "passwordEntries" in decrypted) {
        vaultData = decrypted;
      } else {
        vaultData = {
          userProfile: { fullName: "", dob: "", phone: "" },
          passwordEntries: []
        };
      }

      await resolveOrCreateSalt(db, salt);
      await putVaultRecord(db, encryptedPayload);
      await setMeta(db, META_KEY_LAST_SYNCED_CID, cid);
      await deleteMeta(db, META_KEY_PENDING_SYNC);

      return {
        synced: true,
        reason: "Synced from IPFS",
        cid,
        vaults: normalizeVaultArray(vaultData.passwordEntries),
        userProfile: vaultData.userProfile || { fullName: "", dob: "", phone: "" }
      };
    } catch (error) {
      const normalized = normalizeError(error, ErrorCodes.SYNC_FAILED);
      return {
        synced: false,
        reason: normalized.message,
        code: normalized.code,
        userMessage: getUserFriendlyMessage(normalized),
        canRetry: isRetryableError(normalized)
      };
    }
  },

  async rotateEncryptionKey(oldPassword, nextPassword, userAddress) {
    const db = await openDatabase(userAddress);
    const oldKey = await deriveVaultKey(oldPassword, db);
    const nextKey = await deriveVaultKey(nextPassword, db);
    const res = await this.loadVaultAndProfileWithKey(oldKey, userAddress);
    await this.saveVaultsWithKey(res.vaults, nextKey, userAddress, { skipWeb3: true, userProfile: res.userProfile });
    return { vaults: res.vaults, userProfile: res.userProfile, encryptionKey: nextKey };
  },

  async exportToJson(vaults, masterSecret) {
    const normalizedVaults = normalizeVaultArray(vaults);
    const exportSalt = generateSalt();
    const key = await deriveKey(String(masterSecret ?? ""), exportSalt, { iterations: PBKDF2_ITERATIONS });
    const cipher = await encrypt(normalizedVaults, key);

    return JSON.stringify(
      {
        format: EXPORT_FORMAT,
        kdf: {
          algorithm: "PBKDF2-SHA256",
          iterations: PBKDF2_ITERATIONS,
          salt: exportSalt
        },
        cipher
      },
      null,
      2
    );
  },

  async importFromJson(rawText, masterSecret) {
    const data = JSON.parse(rawText);

    if (Array.isArray(data)) {
      return data;
    }

    if (!data || typeof data !== "object" || data.format !== EXPORT_FORMAT) {
      throw new Error("Invalid vault import format");
    }

    const iterations = Number.isInteger(data.kdf?.iterations) && data.kdf.iterations > 0
      ? data.kdf.iterations
      : PBKDF2_ITERATIONS;
    const salt = data.kdf?.salt;
    const key = await deriveKey(String(masterSecret ?? ""), salt, { iterations });

    try {
      const decrypted = await decrypt(data.cipher, key);
      if (!Array.isArray(decrypted)) {
        throw new Error("Invalid vault import payload");
      }
      return decrypted;
    } catch (error) {
      if (error instanceof CryptoOperationError && error.code === "DECRYPT_FAILED") {
        throw new Error("Không thể giải mã file import. Master password sai hoặc dữ liệu bị hỏng.");
      }
      throw error;
    }
  }
};
