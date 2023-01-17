const { assert, expect } = require("chai")
const { time } = require("@nomicfoundation/hardhat-network-helpers")
const { deployments, ethers, getNamedAccounts } = require("hardhat")

describe("AuctionV1", async function () {
    // variable that we will need for our test
    let auctionv1,
        deployer,
        bidder1,
        bidder2,
        bidder3,
        auctionItems,
        initialBids,
        startTime,
        endTime
    // we declare some default send values for testing placing bids
    const sendValue1 = ethers.utils.parseEther("1")
    const sendValue2 = ethers.utils.parseEther("2")
    const sendValue3 = ethers.utils.parseEther("3")
    const sendValue4 = ethers.utils.parseEther("4")

    // setting up our contract and variables for testing
    beforeEach(async function () {
        // importing the account we created in hardhat.config for our hre testing
        deployer = (await getNamedAccounts()).deployer
        // creates some fake accounts
        accounts = await ethers.getSigners()
        bidder1 = accounts[1]
        bidder2 = accounts[2]
        bidder3 = accounts[3]

        // deploy our auction contract using hardhat deploy
        await deployments.fixture(["all"])

        // this gets us the most recently deployed version of the contract
        auctionv1 = await ethers.getContract("AuctionV1", deployer)

        // setting the variables we will be using
        auctionItems = ["first", "second"]
        initialBids = [1, 2]
        startTime = await time.latest()
        // setting endTime plus 5 to allow for several operations (like multple bids) before auction inds
        endTime = startTime + 20
    })

    describe("Constructor", async function () {
        it("sets the the owner of the contract as the address who deployed it", async function () {
            const owner = await auctionv1.getOwner()
            assert.equal(owner, deployer)
        })
    })

    describe("Initalize Auction", async function () {
        it("reverts if you are not the owner", async function () {
            // we create an aux signer account and connect it to the SC to try to initalize an auction
            const accounts = await ethers.getSigners()
            const auctionV1ConnectedContract = await auctionv1.connect(accounts[1])
            await expect(
                auctionV1ConnectedContract.initAuction(
                    auctionItems,
                    initialBids,
                    startTime,
                    endTime
                )
            ).to.be.revertedWithCustomError(auctionv1, "AuctionV1__NotOwner")
        })

        it("reverts if you pass an empty items array", async function () {
            // removing the first item so it remains empty
            const auxAuctionItems = []
            await expect(
                auctionv1.initAuction(auxAuctionItems, initialBids, startTime, endTime)
            ).to.be.revertedWithCustomError(auctionv1, "AuctionV1__EmptyList")
        })

        it("reverts if the length of the arrays of items and initial bids is not the same", async function () {
            // creating an array with only one value while the inital bids value has two values
            const auxAuctionItems = ["only one"]
            await expect(
                auctionv1.initAuction(auxAuctionItems, initialBids, startTime, endTime)
            ).to.be.revertedWithCustomError(auctionv1, "AuctionV1__WrongArraySize")
        })

        it("reverts if the start time is a larger value than the end time", async function () {
            // making the value of start time bigger than the end time value
            startTime += endTime
            await expect(
                auctionv1.initAuction(auctionItems, initialBids, startTime, endTime)
            ).to.be.revertedWithCustomError(auctionv1, "AuctionV1__WrongTimeValues")
        })

        it("reverts if there is a duplicate item in the auction list", async function () {
            // setting the second value in the array the same as the first
            auctionItems[1] = "first"
            await expect(
                auctionv1.initAuction(auctionItems, initialBids, startTime, endTime)
            ).to.be.revertedWithCustomError(auctionv1, "AuctionV1__DuplicateItems")
        })

        // since for the next tests we need a valid init auction function we can save some space by declaring this beforea each
        beforeEach(async function () {
            await auctionv1.initAuction(auctionItems, initialBids, startTime, endTime)
        })

        it("sets the mapping duplicate values of the items to true", async function () {
            for (let i = 1; i < auctionItems.length; i++) {
                const noDuplicates = await auctionv1.getDuplicateValue(auctionItems[i])
                assert.equal(noDuplicates, true)
            }
        })

        it("sets the initial bid of each item accordingly", async function () {
            for (let i = 1; i < auctionItems.length; i++) {
                const highestBid = await auctionv1.getHighestBid(auctionItems[i])
                assert.equal(highestBid, initialBids[i])
            }
        })
    })

    describe("Place Bid", async function () {
        let startAuction
        beforeEach(async function () {
            startAuction = await auctionv1.initAuction(
                auctionItems,
                initialBids,
                startTime,
                endTime
            )
        })

        it("reverts if you are the owner", async function () {
            await expect(auctionv1.placeBid(auctionItems[0])).to.be.revertedWithCustomError(
                auctionv1,
                "AuctionV1__Owner"
            )
        })

        it("reverts if the auction has ended", async function () {
            // increasing block.timestamp to be bigger than end time value
            await time.increaseTo(endTime + 2)
            await expect(
                auctionv1.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
            ).to.be.revertedWithCustomError(auctionv1, "AuctionV1__AuctionEnded")
        })

        it("reverts if the bid is not higher than the highest bid", async function () {
            await auctionv1.connect(bidder1).placeBid(auctionItems[0], { value: sendValue3 })
            await expect(
                auctionv1.connect(bidder2).placeBid(auctionItems[0], { value: sendValue2 })
            ).to.be.revertedWithCustomError(auctionv1, "AuctionV1__BidTooLow")
        })

        it("returns previous highest bid to its bidder", async function () {
            // saving the initial balance of the bidder
            let startingBidderBalance = await auctionv1.provider.getBalance(bidder1.address)
            // placing a bid with the account we saved the balance
            const initBid = await auctionv1
                .connect(bidder1)
                .placeBid(auctionItems[0], { value: sendValue2 })
            // saving the balance of the account after placing the bid
            let endingBidderBalance = await auctionv1.provider.getBalance(bidder1.address)
            // we have to account for gas use while placing the bid to be able
            // to properly compare starting and ending values of the bidder at the end
            const initBidReceipt = await initBid.wait(1)
            const { gasUsed, effectiveGasPrice } = initBidReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            // placing a higher bid with another user
            await auctionv1.connect(bidder3).placeBid(auctionItems[0], { value: sendValue3 })

            // initial bid minus what he spent on gas to place that bid
            // should be equal to the balance after placing that bid plus the amount of eth he bidded
            assert.equal(
                startingBidderBalance.sub(gasCost).toString(),
                endingBidderBalance.add(sendValue2).toString()
            )
        })

        it("adds new highest bidder to the item struct", async function () {
            // we place a new highest bid on an item X
            await auctionv1.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
            // we get the highest bidder using get function for that item X
            const highestBidder = await auctionv1.getHighestBidder(auctionItems[0])
            // compare the value of the address with which we manually placed a bid
            // and the value that the getHighestBidder view function returns from the SC
            assert.equal(bidder1.address, highestBidder)
        })

        // adds bid to item struct
        it("adds new highest bid to the item struct", async function () {
            // we place a new highest bid on an item X
            const txnreceipt = await auctionv1
                .connect(bidder1)
                .placeBid(auctionItems[0], { value: sendValue2 })
            // we get the highest bidd using get function for that item X
            const highestBid = await auctionv1.getHighestBid(auctionItems[0])
            // compare the msg.value with which we manually placed a bid [sendValue2]
            // and the value that the getHighestBidder view function returns from the SC
            assert.equal(txnreceipt.value.toString(), highestBid.toString())
        })

        it("emits an event when a new highest bid is placed", async function () {
            await expect(
                auctionv1.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
            ).to.emit(auctionv1, "NewBid")
        })
    })

    describe("Get Highest Bidders", async function () {
        let startAuction2
        beforeEach(async function () {
            // creating an auction
            startAuction2 = await auctionv1.initAuction(
                auctionItems,
                initialBids,
                startTime,
                endTime
            )
            // placing a 2eth bid on "first" with bidder 1
            await auctionv1.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })

            // placing a 4eth bid on "second" with bidder 2
            await auctionv1.connect(bidder2).placeBid(auctionItems[1], { value: sendValue4 })
        })

        // we already checked that the onlyOwner modifier works during the initialize auction test so no need to test it again

        it("reverts if the auction is still live", async function () {
            await expect(auctionv1.getHighestBidders()).to.be.revertedWithCustomError(
                auctionv1,
                "AuctionV1__AuctionLive"
            )
        })

        it("returns all the highest bidders", async function () {
            // we set the block.timestamp higher than the endTime
            await time.increaseTo(endTime + 2)
            const highestBidders = await auctionv1.getHighestBidders()
            // compare the value the function returns to the ones we set in the beforeEach
            assert.equal(highestBidders[0], bidder1.address)
            assert.equal(highestBidders[1], bidder2.address)
        })
    })
})
