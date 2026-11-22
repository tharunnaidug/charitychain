import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" }
  },
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1", chainId: 31337, hardfork: "cancun" },
    localhost: { type: "http", chainType: "l1", url: "http://127.0.0.1:8545", chainId: 31337 }
  },
  test: { mocha: { timeout: 30000 } }
});
