import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition";
import "solidity-coverage";
import * as dotenv from "dotenv";
dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "";
const AMOY_PRIVATE_KEY = process.env.AMOY_PRIVATE_KEY || "";
const AMOY_API_KEY = process.env.AMOY_API_KEY || "";

const config: HardhatUserConfig = {

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500
      },
      viaIR: true
    }
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    amoy: {
      url: AMOY_RPC_URL,
      accounts: AMOY_PRIVATE_KEY ? [AMOY_PRIVATE_KEY] : [],
      chainId: 80002,
    }
  },

  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      amoy: AMOY_API_KEY
    }
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "EUR",
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: "ETH",
    gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
    showTimeSpent: true,
    src: "./contracts"
  }

}

export default config;