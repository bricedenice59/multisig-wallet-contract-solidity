const { ethers, network } = require("hardhat");
const {
    updateContractAddresses,
    updateContractAbis,
} = require("../../marketplace-utils/utils/updateContractsAbisAndAdresses");

const chainId = network.config.chainId.toString();
module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        const contractName = "MultiSig";
        const contract = await ethers.getContract(contractName);
        console.log("updating front end contracts constants");

        var contractAddress = contract.address;
        var abi = contract.interface.format(ethers.utils.FormatTypes.json);
        updateContractAddresses(contractName, contractAddress, chainId);
        updateContractAbis(contractName, abi, chainId);
    }
};

module.exports.tags = ["all", "updateFrontend"];
