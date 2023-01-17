const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

// async nameless function
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts() // is a way of getting the accounts
    const chainId = network.config.chainId

    log(deployer)

    const auctionv2 = await deploy("AuctionV2", {
        from: deployer,
        log: true,
        waitConfirmations: network.config.blockConfrimations || 1,
    })

    console.log(`AuctionV2 deployed by ${deployer} to ${auctionv2.address}`)

    if (!developmentChains.includes(network.name) /** && process.env.ETHERSCAN_API_KEY */) {
        log("Verifying...")
        await verify(auctionv2.address)
    }

    log("-----------------------------------")
}

module.exports.tags = ["all", "v2"]
