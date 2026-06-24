export const ErrorCodes = {
  IPFS_UPLOAD_FAILED: "ipfs_upload_failed",
  IPFS_FETCH_FAILED: "ipfs_fetch_failed",
  INVALID_CID: "invalid_cid",
  NETWORK_MISMATCH: "network_mismatch",
  CONTRACT_ADDRESS_MISSING: "contract_address_missing",
  USER_REJECTED: "user_rejected",
  GAS_ESTIMATION_FAILED: "gas_estimation_failed",
  INSUFFICIENT_FUNDS: "insufficient_funds",
  TRANSACTION_FAILED: "transaction_failed",
  INVALID_ADDRESS: "invalid_address",
  RPC_ERROR: "rpc_error",
  METAMASK_NOT_DETECTED: "metamask_not_detected",
  ETHEREUM_NOT_AVAILABLE: "ethereum_not_available",
  SYNC_FAILED: "sync_failed",
  DECRYPTION_FAILED: "decryption_failed",
  INVALID_MASTER_PASSWORD: "invalid_master_password",
  LOCAL_SAVE_FAILED: "local_save_failed"
};

export const ErrorMessages = {
  [ErrorCodes.IPFS_UPLOAD_FAILED]: "Không thể upload dữ liệu lên IPFS. Dữ liệu đã được giữ local nếu có thể.",
  [ErrorCodes.IPFS_FETCH_FAILED]: "Không thể tải dữ liệu từ IPFS. Hãy kiểm tra mạng rồi thử lại.",
  [ErrorCodes.INVALID_CID]: "CID IPFS không hợp lệ.",
  [ErrorCodes.NETWORK_MISMATCH]: "Vui lòng chuyển MetaMask sang đúng mạng Sepolia Testnet.",
  [ErrorCodes.CONTRACT_ADDRESS_MISSING]: "Địa chỉ smart contract chưa được cấu hình trong .env.",
  [ErrorCodes.USER_REJECTED]: "Bạn đã từ chối giao dịch trong MetaMask. Form vẫn được giữ để bạn thử lại.",
  [ErrorCodes.GAS_ESTIMATION_FAILED]: "Không thể ước tính gas cho giao dịch. Hãy thử lại sau.",
  [ErrorCodes.INSUFFICIENT_FUNDS]: "Ví không đủ Sepolia ETH để trả gas. Hãy nạp faucet testnet rồi thử lại.",
  [ErrorCodes.TRANSACTION_FAILED]: "Giao dịch blockchain thất bại hoặc bị revert.",
  [ErrorCodes.INVALID_ADDRESS]: "Địa chỉ ví không hợp lệ.",
  [ErrorCodes.RPC_ERROR]: "RPC hoặc mạng Sepolia đang không ổn định. Hệ thống sẽ thử lại nếu có thể.",
  [ErrorCodes.METAMASK_NOT_DETECTED]: "Không tìm thấy MetaMask. Dữ liệu vẫn có thể lưu local.",
  [ErrorCodes.ETHEREUM_NOT_AVAILABLE]: "Ethereum provider chưa sẵn sàng.",
  [ErrorCodes.SYNC_FAILED]: "Không thể đồng bộ dữ liệu từ blockchain. Ứng dụng sẽ dùng dữ liệu local.",
  [ErrorCodes.DECRYPTION_FAILED]: "Không thể giải mã dữ liệu đồng bộ. Master password có thể không khớp.",
  [ErrorCodes.INVALID_MASTER_PASSWORD]: "Master password không chính xác.",
  [ErrorCodes.LOCAL_SAVE_FAILED]: "Không thể lưu dữ liệu local trên trình duyệt này."
};

export class VaultServiceError extends Error {
  constructor(code, message = null, details = null) {
    super(message || ErrorMessages[code] || "Unknown vault service error");
    this.name = "VaultServiceError";
    this.code = code;
    this.details = details;
  }
}

export function normalizeError(error, fallbackCode = ErrorCodes.TRANSACTION_FAILED) {
  if (error instanceof VaultServiceError) return error;

  const message = String(error?.shortMessage || error?.reason || error?.message || "");
  const lowerMessage = message.toLowerCase();
  const providerCode = error?.code ?? error?.info?.error?.code ?? error?.data?.code;

  if (providerCode === 4001 || providerCode === "ACTION_REJECTED" || lowerMessage.includes("user rejected")) {
    return new VaultServiceError(ErrorCodes.USER_REJECTED, ErrorMessages[ErrorCodes.USER_REJECTED], error);
  }

  if (
    providerCode === "INSUFFICIENT_FUNDS" ||
    lowerMessage.includes("insufficient funds") ||
    lowerMessage.includes("insufficient balance")
  ) {
    return new VaultServiceError(ErrorCodes.INSUFFICIENT_FUNDS, ErrorMessages[ErrorCodes.INSUFFICIENT_FUNDS], error);
  }

  if (lowerMessage.includes("network") || lowerMessage.includes("chain") || lowerMessage.includes("wrong network")) {
    return new VaultServiceError(ErrorCodes.NETWORK_MISMATCH, ErrorMessages[ErrorCodes.NETWORK_MISMATCH], error);
  }

  if (lowerMessage.includes("timeout") || lowerMessage.includes("gateway") || lowerMessage.includes("rpc")) {
    return new VaultServiceError(ErrorCodes.RPC_ERROR, ErrorMessages[ErrorCodes.RPC_ERROR], error);
  }

  if (lowerMessage.includes("revert") || lowerMessage.includes("execution reverted")) {
    return new VaultServiceError(ErrorCodes.TRANSACTION_FAILED, ErrorMessages[ErrorCodes.TRANSACTION_FAILED], error);
  }

  return new VaultServiceError(fallbackCode, message || ErrorMessages[fallbackCode], error);
}

export function getUserFriendlyMessage(error) {
  const normalized = normalizeError(error, error?.code || ErrorCodes.TRANSACTION_FAILED);
  return ErrorMessages[normalized.code] || normalized.message || "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

export function isRetryableError(error) {
  const normalized = normalizeError(error, error?.code || ErrorCodes.RPC_ERROR);

  if (
    [
      ErrorCodes.USER_REJECTED,
      ErrorCodes.INSUFFICIENT_FUNDS,
      ErrorCodes.NETWORK_MISMATCH,
      ErrorCodes.CONTRACT_ADDRESS_MISSING,
      ErrorCodes.INVALID_ADDRESS,
      ErrorCodes.INVALID_CID,
      ErrorCodes.DECRYPTION_FAILED
    ].includes(normalized.code)
  ) {
    return false;
  }

  if (
    [
      ErrorCodes.IPFS_UPLOAD_FAILED,
      ErrorCodes.IPFS_FETCH_FAILED,
      ErrorCodes.RPC_ERROR,
      ErrorCodes.GAS_ESTIMATION_FAILED,
      ErrorCodes.TRANSACTION_FAILED,
      ErrorCodes.SYNC_FAILED
    ].includes(normalized.code)
  ) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return ["timeout", "econnrefused", "enotfound", "gateway", "temporarily", "rate limit"].some((token) =>
    message.includes(token)
  );
}

export function validateCID(cid) {
  if (!cid || typeof cid !== "string") {
    throw new VaultServiceError(ErrorCodes.INVALID_CID, "CID must be a non-empty string");
  }

  const trimmed = cid.trim();
  const isV0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmed);
  const isV1 = /^b[a-z2-7]{20,}$/i.test(trimmed);

  if (!isV0 && !isV1) {
    throw new VaultServiceError(ErrorCodes.INVALID_CID, `Invalid CID format: ${trimmed}`);
  }

  return trimmed;
}

export function validateEthereumAddress(address) {
  if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new VaultServiceError(ErrorCodes.INVALID_ADDRESS, "Invalid Ethereum address");
  }

  return address;
}

export async function validateNetworkMatch() {
  if (!globalThis.window?.ethereum) {
    throw new VaultServiceError(ErrorCodes.ETHEREUM_NOT_AVAILABLE);
  }

  try {
    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    const currentChainId = Number.parseInt(chainIdHex, 16);
    const expectedChainId = Number.parseInt(import.meta.env.VITE_NETWORK_CHAIN_ID || "11155111", 10);

    if (currentChainId !== expectedChainId) {
      throw new VaultServiceError(
        ErrorCodes.NETWORK_MISMATCH,
        `Expected chain ${expectedChainId}, got ${currentChainId}`
      );
    }

    return currentChainId;
  } catch (error) {
    if (error instanceof VaultServiceError) throw error;
    throw normalizeError(error, ErrorCodes.RPC_ERROR);
  }
}

export async function retryAsync(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 800,
    maxDelayMs = 8000,
    backoffMultiplier = 2,
    shouldRetry = isRetryableError,
    onRetry
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn({ attempt, maxRetries });
    } catch (error) {
      lastError = error;
      const normalized = normalizeError(error, error?.code || ErrorCodes.RPC_ERROR);

      if (!shouldRetry(normalized) || attempt === maxRetries) {
        throw normalized;
      }

      const delay = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs);
      onRetry?.({ attempt, maxRetries, delay, error: normalized });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
