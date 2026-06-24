const FAUCET_API_URL = "http://localhost:3001/api/fund";

export const faucetService = {
  /**
   * Ensures the target wallet address has gas by hitting the backend faucet.
   * @param {string} walletAddress Address of the virtual wallet
   * @param {string} googleUid Google Auth UID
   * @param {function} onProgress Optional callback to output status updates to UI
   * @returns {Promise<boolean>} True if balance verified / funded successfully
   */
  async ensureGas(walletAddress, googleUid, onProgress = null) {
    if (!walletAddress || !googleUid) {
      throw new Error("Address and Google UID are required to request gas funding.");
    }

    try {
      if (onProgress) {
        onProgress("Đang kiểm tra và tài trợ phí Gas tự động...");
      } else {
        console.log(`Checking JIT gas funding status for ${walletAddress}...`);
      }

      const response = await fetch(FAUCET_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          address: walletAddress,
          uid: googleUid
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        if (result.funded) {
          if (onProgress) {
            onProgress("Bơm Gas thành công (0.002 Sepolia ETH)! Đang thực hiện giao dịch...");
          }
          console.log(`Gas funded successfully, TxHash: ${result.txHash}`);
        } else {
          console.log("Wallet has sufficient gas, skipping JIT funding.");
        }
        return true;
      } else {
        throw new Error(result.error || "Không thể cấp Gas");
      }
    } catch (error) {
      console.error("JIT Funding failed:", error);
      throw new Error("Hệ thống tạm thời không thể tài trợ phí Gas, vui lòng thử lại sau.");
    }
  }
};
