require("dotenv").config();
const { network } = require("hardhat");
const { verify } = require("../../marketplace-utils/utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer, owner1, owner2, owner3 } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const listOfOwners = [owner1, owner2, owner3];
    const args = listOfOwners;

    log("---------Deploying contract....-------------");
    console.log("owners passed in contract constructor are following:");
    console.log(listOfOwners);
    var deploymentResult = await deploy("MultiSig", {
        from: deployer,
        gasLimit: network.config.gasLimit,
        args: [args],
        log: true,
        waitConfirmations: network.config.blockConfirmationsForContractVerification || 1,
    });

    //only verifies on testnets
    if (chainId != 31337 && process.env.ETHERSCAN_API_KEY) {
        log("Verifing contract on Etherscan!");
        log("----------------------");
        await verify(deploymentResult.address, [args]);
        log("--------Verify Done--------------");
    }

    log("Contract deployed!");
    log("----------------------");
};
