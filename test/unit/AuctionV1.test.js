const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");

describe("AuctionV1", async function () {
  // variable that we will need for our test
  let auctionv1;
  let deployer;
  let bidder1, bidder2, bidder3;
  let auctionItems;
  let startTime, endTime;

  // setting up our contract and variables for testing
  beforeEach(async function () {
    // we import our deployer and local accounts from the hardhat runtime environment
    deployer = (await getNamedAccounts()).deployer;
    accounts = await ethers.getSigners();
    bidder1 = accounts[1];
    bidder2 = accounts[2];
    bidder3 = accounts[3];

    // deploy our auction contract using hardhat deploy
    await deployments.fixture(["all"]);

    // this gets us the most recently deployed version of the contract
    auctionv1 = await ethers.getContract("AuctionV1", deployer);

    // setting the variables we will be using
    auctionItems = ["first", "second"];
    startTime = await auctionv1.getTime();
    endTime = startTime + 1000;
  });

  describe("constructor", async function () {
    it("sets the the owner of the contract as the address who deployed it", async function () {
      const owner = await auctionv1.getOwner();
      assert.equal(owner, deployer);
    });
  });

  describe("initalize Auction", async function () {
    it("fails if you pass an empty items array", async function () {
      // removing the first item so it remains empty
      const auxAuctionItems = [];
      await expect(
        auctionv1.initAuction(auxAuctionItems, startTime, endTime)
      ).to.be.revertedWith(
        "There has to be at least one item on the auction list"
      );
    });

    // this test fails even though the log shows startTime > endTime but it reverts
    // with "there has to be at least one item on the auction list"

    it("fails if the start time is a larger value than the end time", async function () {
      // making the value of start time bigger than the end time value
      startTime += 2000;
      console.log(startTime);
      console.log(endTime);
      console.log(auctionItems[0]);
      await expect(
        auctionv1.initAuction(auctionItems, startTime, endTime)
      ).to.be.revertedWith(
        "The start time value of the auction has to be smaller than the end time"
      );
    });

    // test for checking that the intial bid is set to 1 eth (basically same code than checking getHighestBids())
  });

  /**  describe("place bid", async function () {

   it("fails if the msg.value of the sender is smaller than the highest bid", async function (9 {}))

   it("updates the highest bid value correctly", async function (){})

   it("updates the highest bidder address correctly", async function (){})

    })

    describe("get highest bids", async function(){

    it("fails if the auction is still active", async function() {})

    it("returns the highest value for each item in the auction list array", async function () {})

    })
  */
});
