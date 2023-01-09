// this is the last step in the development journet

const { assert } = require("chai");
const { getNamedAccounts, ethers, network } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name) // staging test only run on testnets
  ? describe.skip // the question mark is a one-liner if
  : describe("AuctionV1", async function () {
      let auctionv1;
      let deployer;
      // we dont need the mock contract because we can access the real code (since staging test will be when contract is in a real testnet)
      // in the staging test we are assuming that the contract is already deployed
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        auctionv1 = await ethers.getContract("AuctionV1", deployer);
      });

      /** 
      it("allows people to fund and withdraw", async function () {
        await auctionv1.fund({ value: sendValue });
        await fundMe.withdraw();
        const endingBalance = await fundMe.provider.getBalance(fundMe.address);
        assert.equal(endingBalance.toString(), ethers.utils.parseEther("0"));
      });
      */
    });
