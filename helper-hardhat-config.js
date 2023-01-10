// for network configurations (different contract addresses depending on which network we are)
const networkConfig = {
  default: {
    name: "hardhat",
    keepersUpdateInterval: "30",
  },
  31337: {
    name: "localhost",
  },
  5: {
    name: "goerli",
  },

  1: {
    name: "mainnet",
    keepersUpdateInterval: "30",
  },
};

const developmentChains = ["hardhat", "localhost"];

module.exports = {
  networkConfig,
  developmentChains,
};
