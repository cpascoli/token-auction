import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-contract-sizer";
import "hardhat-docgen";

const config : HardhatUserConfig = {  
  
  defaultNetwork: "hardhat",

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

};

export default config;
