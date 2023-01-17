/**
 * @dev script to run locally when we are running "yarn hardhat node"
 */

const { ethers } = require("hardhat")

async function initAuctionV1() {
    const auctionv1 = await ethers.getContract("AuctionV1")
    const items = ["rock", "paper", "scissor"]
    const initialBids = [1, 2, 3]
    const startTime = await auction.getTime()
    const endTime = startTime.add(20)
    await auctionv1.initAuction(items, initialBids, startTime, endTime)
    console.log("Created an auction version 1")
}

initAuctionV1()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
