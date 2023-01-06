// in the utils folder we are going to include all of the functions that can be applied to several deployment scripts

const { run } = require("hardhat");

/**
 * @notice script to verify a contract when it has been deployed to the blockchain
 * @dev this function allows are contract to get verified (green check) when we deploy it to the blockchain,
 *      this helps provide transparency with the information flow of our contract
 */

async function verify(contractAddress, args) {
  console.log("Verifying contract...");

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already Verified!");
    } else {
      console.log(e);
    }
  }
}

module.exports = { verify };
