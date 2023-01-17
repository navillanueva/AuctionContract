const { assert, expect } = require("chai")
const { time } = require("@nomicfoundation/hardhat-network-helpers")
const { deployments, ethers, getNamedAccounts } = require("hardhat")

describe("AuctionV2", async function () {
    // variable that we will need for our test
    let auctionv2,
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
        auctionv2 = await ethers.getContract("AuctionV2", deployer)

        // setting the variables we will be using
        auctionItems = ["first", "second"]
        initialBids = [1, 2]
        startTime = await time.latest()
        // setting endTime plus 5 to allow for several operations (like multple bids) before auction inds
        endTime = startTime + 20
    })

    describe("Constructor", async function () {
        it("sets the the owner of the contract as the address who deployed it", async function () {
            const owner = await auctionv2.getOwner()
            assert.equal(owner, deployer)
        })
    })

    describe("Initalize Auction", async function () {
        it("reverts if you are not the owner", async function () {
            // we create an aux signer account and connect it to the SC to try to initalize an auction
            const accounts = await ethers.getSigners()
            const auctionV2ConnectedContract = await auctionv2.connect(accounts[1])
            await expect(
                auctionV2ConnectedContract.initAuction(
                    auctionItems,
                    initialBids,
                    startTime,
                    endTime
                )
            ).to.be.revertedWithCustomError(auctionv2, "AuctionV2__NotOwner")
        })

        it("reverts if you pass an empty items array", async function () {
            // removing the first item so it remains empty
            const auxAuctionItems = []
            await expect(
                auctionv2.initAuction(auxAuctionItems, initialBids, startTime, endTime)
            ).to.be.revertedWithCustomError(auctionv2, "AuctionV2__EmptyList")
        })

        it("reverts if the length of the arrays of items and initial bids is not the same", async function () {
            // creating an array with only one value while the inital bids value has two values
            const auxAuctionItems = ["only one"]
            await expect(
                auctionv2.initAuction(auxAuctionItems, initialBids, startTime, endTime)
            ).to.be.revertedWithCustomError(auctionv2, "AuctionV2__WrongArraySize")
        })

        it("reverts if the start time is a larger value than the end time", async function () {
            // making the value of start time bigger than the end time value
            startTime += endTime
            await expect(
                auctionv2.initAuction(auctionItems, initialBids, startTime, endTime)
            ).to.be.revertedWithCustomError(auctionv2, "AuctionV2__WrongTimeValues")
        })

        it("reverts if there is a duplicate item in the auction list", async function () {
            // setting the second value in the array the same as the first
            auctionItems[1] = "first"
            await expect(
                auctionv2.initAuction(auctionItems, initialBids, startTime, endTime)
            ).to.be.revertedWithCustomError(auctionv2, "AuctionV2__DuplicateItems")
        })

        // since for the next tests we need a valid init auction function we can save some space by declaring this beforea each
        beforeEach(async function () {
            await auctionv2.initAuction(auctionItems, initialBids, startTime, endTime)
        })

        it("sets the mapping duplicate values of the items to true", async function () {
            for (let i = 1; i < auctionItems.length; i++) {
                const noDuplicates = await auctionv2.getDuplicateValue(auctionItems[i])
                assert.equal(noDuplicates, true)
            }
        })

        it("sets the initial bid of each item accordingly", async function () {
            for (let i = 1; i < auctionItems.length; i++) {
                const highestBid = await auctionv2.getHighestBid(auctionItems[i])
                assert.equal(highestBid, initialBids[i])
            }
        })
    })

    describe("Place Bid", async function () {
        let startAuction
        beforeEach(async function () {
            startAuction = await auctionv2.initAuction(
                auctionItems,
                initialBids,
                startTime,
                endTime
            )
        })

        it("reverts if you are the owner", async function () {
            await expect(auctionv2.placeBid(auctionItems[0])).to.be.revertedWithCustomError(
                auctionv2,
                "AuctionV2__Owner"
            )
        })

        it("reverts if the auction has ended", async function () {
            // increasing block.timestamp to be bigger than end time value
            await time.increaseTo(endTime + 2)
            await expect(
                auctionv2.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
            ).to.be.revertedWithCustomError(auctionv2, "AuctionV2__AuctionEnded")
        })

        it("reverts if the bid is not higher than the highest bid", async function () {
            await auctionv2.connect(bidder1).placeBid(auctionItems[0], { value: sendValue3 })
            await expect(
                auctionv2.connect(bidder2).placeBid(auctionItems[0], { value: sendValue2 })
            ).to.be.revertedWithCustomError(auctionv2, "AuctionV2__BidTooLow")
        })

        it("returns previous highest bid to its bidder", async function () {
            // saving the initial balance of the bidder
            let startingBidderBalance = await auctionv2.provider.getBalance(bidder1.address)
            // placing a bid with the account we saved the balance
            const initBid = await auctionv2
                .connect(bidder1)
                .placeBid(auctionItems[0], { value: sendValue2 })
            // saving the balance of the account after placing the bid
            let endingBidderBalance = await auctionv2.provider.getBalance(bidder1.address)
            // we have to account for gas use while placing the bid to be able
            // to properly compare starting and ending values of the bidder at the end
            const initBidReceipt = await initBid.wait(1)
            const { gasUsed, effectiveGasPrice } = initBidReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            // placing a higher bid with another user
            await auctionv2.connect(bidder3).placeBid(auctionItems[0], { value: sendValue3 })

            // initial bid minus what he spent on gas to place that bid
            // should be equal to the balance after placing that bid plus the amount of eth he bidded
            assert.equal(
                startingBidderBalance.sub(gasCost).toString(),
                endingBidderBalance.add(sendValue2).toString()
            )
        })

        it("adds new highest bidder to the item struct", async function () {
            // we place a new highest bid on an item X
            await auctionv2.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
            // we get the highest bidder using get function for that item X
            const highestBidder = await auctionv2.getHighestBidder(auctionItems[0])
            // compare the value of the address with which we manually placed a bid
            // and the value that the getHighestBidder view function returns from the SC
            assert.equal(bidder1.address, highestBidder)
        })

        // adds bid to item struct
        it("adds new highest bid to the item struct", async function () {
            // we place a new highest bid on an item X
            const txnreceipt = await auctionv2
                .connect(bidder1)
                .placeBid(auctionItems[0], { value: sendValue2 })
            // we get the highest bidd using get function for that item X
            const highestBid = await auctionv2.getHighestBid(auctionItems[0])
            // compare the msg.value with which we manually placed a bid [sendValue2]
            // and the value that the getHighestBidder view function returns from the SC
            assert.equal(txnreceipt.value.toString(), highestBid.toString())
        })

        it("emits an event when a new highest bid is placed", async function () {
            await expect(
                auctionv2.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
            ).to.emit(auctionv2, "NewBid")
        })
    })

    describe("checkUpkeep", function () {
        beforeEach(async function () {
            // creating an auction
            await auctionv2.initAuction(auctionItems, initialBids, startTime, endTime)
        })
        it("returns false if users haven't placed new bids", async () => {
            await time.increaseTo(endTime + 2)
            const { upkeepNeeded } = await auctionv2.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
            assert(!upkeepNeeded)
        })

        it("returns false if enough time hasn't passed", async () => {
            await auctionv2.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
            const { upkeepNeeded } = await auctionv2.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
            assert(!upkeepNeeded)
        })

        it("returns false if auction isn't open", async () => {
            await auctionv2.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
            await time.increaseTo(endTime + 2)
            // performing upkeep to change value of auction state to calculating
            await auctionv2.performUpkeep([])
            const auctionState = await auctionv2.getAuctionState() // stores the new state
            const { upkeepNeeded } = await auctionv2.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
            assert.equal(auctionState.toString() == "1", upkeepNeeded == false)
        })

        it("returns true if enough time has passed, players have bidded and is open", async () => {
            await auctionv2.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
            await time.increaseTo(endTime + 2)
            const { upkeepNeeded } = await auctionv2.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
            assert(upkeepNeeded)
        })
    })

    describe("Perform Upkeep", async function () {
        beforeEach(async function () {
            // creating an auction
            await auctionv2.initAuction(auctionItems, initialBids, startTime, endTime)
            await auctionv2.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })
        })

        it("can only run if checkupkeep is true", async () => {
            await time.increaseTo(endTime + 2)
            const tx = await auctionv2.performUpkeep("0x")
            assert(tx)
        })

        it("reverts if checkup is false", async () => {
            await expect(auctionv2.performUpkeep("0x")).to.be.revertedWithCustomError(
                auctionv2,
                "AuctionV2__UpkeepNotNeeded"
            )
        })

        it("updates the raffle state and emits a requestId", async () => {
            // Too many asserts in this test!
            await time.increaseTo(endTime + 2)
            const txResponse = await auctionv2.performUpkeep("0x") // emits requestId
            const txReceipt = await txResponse.wait(1) // waits 1 block
            const auctionState = await auctionv2.getAuctionState() // updates state
            assert(auctionState == 1) // 0 = open, 1 = calculating
        })
    })

    describe("Get Highest Bidders", async function () {
        let startAuction2
        beforeEach(async function () {
            // creating an auction
            startAuction2 = await auctionv2.initAuction(
                auctionItems,
                initialBids,
                startTime,
                endTime
            )
            // placing a 2eth bid on "first" with bidder 1
            await auctionv2.connect(bidder1).placeBid(auctionItems[0], { value: sendValue2 })

            // placing a 4eth bid on "second" with bidder 2
            await auctionv2.connect(bidder2).placeBid(auctionItems[1], { value: sendValue4 })
        })

        // we already checked that the onlyOwner modifier works during the initialize auction test so no need to test it again

        it("reverts if the auction is still live", async function () {
            await expect(auctionv2.getHighestBidders()).to.be.revertedWithCustomError(
                auctionv2,
                "AuctionV2__AuctionLive"
            )
        })
        /** 
    it("returns all the highest bidders", async function () {
      // we set the block.timestamp higher than the endTime
      await time.increaseTo(endTime + 2);
      const highestBidders = await auctionv2.getHighestBidders();
      // compare the value the function returns to the ones we set in the beforeEach
      assert.equal(highestBidders[0], bidder1.address);
      assert.equal(highestBidders[1], bidder2.address);
    });
    */
    })
})

module.exports.tags = ["v2"]
