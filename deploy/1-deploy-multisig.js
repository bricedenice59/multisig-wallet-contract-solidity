require("dotenv").config();
const { network } = require("hardhat");
const { verify } = require("../utils/verify");

const CONTRACT_REWARD_PERCENTAGE = 10;

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    const args = [CONTRACT_REWARD_PERCENTAGE];

    var deploymentResult = await deploy("Marketplace", {
        from: deployer,
        gasLimit: network.config.gasLimit,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmationsForContractVerification || 1,
    });

    //only verifies on testnets
    if (chainId != 31337 && process.env.ETHERSCAN_API_KEY) {
        log("Verifing contract on Etherscan!");
        log("----------------------");
        await verify(deploymentResult.address, args);
        log("--------Verify Done--------------");
    }

    log("Marketplace deployed!");
    log("----------------------");
};
