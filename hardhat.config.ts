import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-contract-sizer";
import "hardhat-docgen";
import "hardhat-contract-sizer";
import "hardhat-abi-exporter";
import { HardhatUserConfig } from "hardhat/config";

require('dotenv').config()


const { DEPLOYER_PRIVATE_KEY, RPC_URL_GOERLI, ETHERSCAN_API_KEY } = process.env;

const config : HardhatUserConfig = {  
  
  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      // provide each test account with 100 Ether
      accounts: { accountsBalance: "100000000000000000000" }
    },
    goerli: {
      url: RPC_URL_GOERLI,
      accounts: [DEPLOYER_PRIVATE_KEY ?? ""],
    }
  },

  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  gasReporter: {
    enabled: true,
    outputFile: "gas-report.txt",
    noColors: true,
    showTimeSpent: true,
    currency: 'USD',
    gasPrice: 200
  },

  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: true,
  },

  abiExporter: {
    path: './build/abi',
    clear: true,
    flat: true,
    spacing: 2,
  },

  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "",
  },
};

export default config;
