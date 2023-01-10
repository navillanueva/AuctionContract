require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy"); // we need to include this package so we can run the "deploy" command
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("dotenv").config();

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "key";

module.exports = {
  defaultNetwork: "hardhat",
  solidity: "0.8.17",
  networks: {
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1,
    },
    goerli: {
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 5,
      blockConfirmations: 6,
    },
  },
  // we create a set of accounts for our hre (hardhat runtime environment) so we can test locally
  // the chain id for goerli testnet is 5
  namedAccounts: {
    deployer: {
      default: 0,
      5: 0,
    },
    bidder1: {
      default: 1,
    },
    bidder2: {
      default: 2,
    },
    bidder3: {
      default: 3,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};
