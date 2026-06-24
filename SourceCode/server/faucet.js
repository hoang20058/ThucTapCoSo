import http from "http";
import { Wallet, JsonRpcProvider, parseEther } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3001;
const PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

// In-memory rate limiting database: googleUid -> { count, date }
const rateLimits = new Map();

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle funding API
  if (req.method === "POST" && req.url === "/api/fund") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        if (!body) {
          return sendJson(res, 400, { success: false, error: "Empty request body" });
        }

        const { address, uid } = JSON.parse(body);

        if (!address || !uid) {
          return sendJson(res, 400, { success: false, error: "Cần cung cấp address và uid của tài khoản Google" });
        }

        // Resolve Private Key for funding
        const adminPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;
        const rpcUrl = process.env.VITE_RPC_URL || PUBLIC_SEPOLIA_RPC;

        if (!adminPrivateKey) {
          console.error("ADMIN_PRIVATE_KEY/DEPLOYER_PRIVATE_KEY is missing in env");
          return sendJson(res, 500, {
            success: false,
            error: "Hệ thống chưa cấu hình ví tài trợ. Vui lòng liên hệ Admin."
          });
        }

        const provider = new JsonRpcProvider(rpcUrl);
        const adminWallet = new Wallet(adminPrivateKey, provider);

        // Check target balance
        const balance = await provider.getBalance(address);
        const balanceEth = Number(balance) / 1e18; // Wei to ETH

        // If target has enough gas (> 0.001 ETH), skip funding
        if (balanceEth >= 0.001) {
          return sendJson(res, 200, {
            success: true,
            message: "Ví của bạn đã có đủ gas để thực hiện giao dịch.",
            balance: balanceEth,
            funded: false
          });
        }

        // Apply calendar-day rate limit per Google UID (maximum 3 requests/day)
        const todayString = new Date().toDateString();
        const userLimit = rateLimits.get(uid) || { count: 0, date: todayString };

        if (userLimit.date !== todayString) {
          userLimit.count = 0;
          userLimit.date = todayString;
        }

        if (userLimit.count >= 3) {
          return sendJson(res, 429, {
            success: false,
            error: "Bạn đã vượt quá giới hạn nhận gas hôm nay (tối đa 3 lần/ngày)."
          });
        }

        // Check Admin Wallet balance
        const adminBalance = await provider.getBalance(adminWallet.address);
        if (adminBalance < parseEther("0.003")) {
          console.error(`Admin wallet ${adminWallet.address} has low balance: ${Number(adminBalance) / 1e18} ETH`);
          return sendJson(res, 500, {
            success: false,
            error: "Ví tài trợ của trạm xăng đang hết tiền Sepolia ETH. Vui lòng thử lại sau."
          });
        }

        console.log(`Bắt đầu chuyển 0.002 ETH tới ví ảo ${address}...`);
        const tx = await adminWallet.sendTransaction({
          to: address,
          value: parseEther("0.002")
        });

        // Update user rate limit counts
        userLimit.count += 1;
        rateLimits.set(uid, userLimit);

        console.log(`Đang chờ xác nhận giao dịch chuyển gas: ${tx.hash}`);
        await tx.wait();

        console.log(`Chuyển gas thành công tới ${address}`);
        return sendJson(res, 200, {
          success: true,
          message: "Đã tài trợ phí gas (0.002 Sepolia ETH) thành công vào ví ảo của bạn.",
          txHash: tx.hash,
          funded: true
        });
      } catch (error) {
        console.error("Faucet error:", error);
        return sendJson(res, 500, {
          success: false,
          error: `Trạm xăng gặp lỗi: ${error.message || "Không xác định"}`
        });
      }
    });
  } else {
    return sendJson(res, 404, { success: false, error: "Endpoint not found" });
  }
});

server.listen(PORT, () => {
  console.log(`JIT Gas Station Faucet listening on port ${PORT}`);
});
