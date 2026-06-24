import hre from "hardhat";
import { updateDeploymentEnv } from "./updateEnv.js";
import { exportContractAbi } from "./exportAbi.js";

/**
 * Deploy VaultPointer contract lên Sepolia testnet
 * Script sẽ:
 * 1. Compile contract
 * 2. Deploy instance mới
 * 3. Cập nhật .env với contract address
 * 4. Export ABI cho frontend
 */
async function main() {
  console.log("🔨 Deploying VaultPointer contract to Sepolia...");
  
  // Lấy contract factory
  const VaultPointer = await hre.ethers.getContractFactory("VaultPointer");
  
  // Deploy contract
  const vaultPointer = await VaultPointer.deploy();
  await vaultPointer.waitForDeployment();

  // Lấy địa chỉ contract đã deploy
  const deployedAddress = await vaultPointer.getAddress();
  
  console.log("✅ VaultPointer deployed successfully!");
  console.log(`📍 Contract Address: ${deployedAddress}`);
  console.log(`🌐 Sepolia Explorer: https://sepolia.etherscan.io/address/${deployedAddress}`);

  // Cập nhật .env với contract address
  console.log("\n📝 Updating .env file...");
  await updateDeploymentEnv(deployedAddress);
  console.log("✅ .env updated with contract address");

  // Export ABI cho frontend sử dụng
  console.log("\n📤 Exporting ABI...");
  await exportContractAbi("VaultPointer");
  console.log("✅ ABI exported to src/contracts/VaultPointer.abi.json");

  console.log("\n✨ Deployment complete!");
}

main().catch((error) => {
  console.error("❌ Error during deployment:", error);
  process.exitCode = 1;
});
