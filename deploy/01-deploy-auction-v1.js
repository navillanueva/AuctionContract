const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

// async nameless function
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts(); // is a way of getting the accounts
  const chainId = network.config.chainId;

  log(deployer);

  const auctionv1 = await deploy("AuctionV1", {
    from: deployer,
    log: true,
    waitConfirmations: network.config.blockConfrimations || 1,
  });

  if (
    !developmentChains.includes(
      network.name
    ) /** && process.env.ETHERSCAN_API_KEY */
  ) {
    await verify(auctionv1.address);
  }

  log("-----------------------------------");
};

module.exports.tags = ["all", "fundme"];
