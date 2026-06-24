import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";

/**
 * Hardhat configuration for Sepolia deployment.
 * Uses environment variables: SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY
 */
const config = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  }
};

export default config;
