/**
 * @dev script to run locally when we are running "yarn hardhat node"
 */

const { ethers } = require("hardhat")

async function initAuctionV2() {
    const auctionv2 = await ethers.getContract("AuctionV2")
    const items = ["rock", "paper", "scissor"]
    const initialBids = [1, 2, 3]
    const startTime = await auctionv2.getTime()
    const endTime = startTime.add(20)
    await auctionv2.initAuction(items, initialBids, startTime, endTime)
    console.log("Created an auction verion 2")
}

initAuctionV2()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
