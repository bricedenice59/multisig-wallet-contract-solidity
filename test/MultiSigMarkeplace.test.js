const { assert, expect } = require("chai");
const { ethers, getNamedAccounts } = require("hardhat");
const {
  getMockAllAdmins,
  getMockNbAdmins,
} = require("../test/content/mockdata/fetcher");

describe("Marketplace contract test", function () {
  describe("constructor", () => {
    it("Initialize multi-sig contract", async () => {
      const contract = await ethers.getContractFactory("MultiSigMarketplace");

      //test adding 2 admins in contract
      const twoAdmins = getMockNbAdmins(2).data;
      await expect(contract.deploy(twoAdmins)).to.be.revertedWith(
        "MultiSigMarketplace__CtorNotEnoughOwners()"
      );

      //test adding all admins in contract
      //mock data shows 260 distinct addresses, but contract has been on purposed, limited to uint8 max
      const allAdmins = getMockAllAdmins().data.admins;
      await expect(contract.deploy(allAdmins)).to.be.revertedWith(
        "MultiSigMarketplace__CtorTooManyOwners()"
      );

      const nbAdmins = 15;
      //test adding 15 + 1 invalid admins in contract
      var admins = getMockNbAdmins(nbAdmins).data;
      const invalidAddressAdmin = "0x0000000000000000000000000000000000000000";
      admins.push(invalidAddressAdmin);
      await expect(contract.deploy(admins)).to.be.revertedWith(
        "MultiSigMarketplace__CtorListOfOwnersContainsInvalidAddress()"
      );

      //test adding 15 + a duplicate admin in contract
      admins = getMockNbAdmins(nbAdmins).data;
      const adminAddressAtIndex3 = admins[3];
      admins.push(adminAddressAtIndex3);
      await expect(contract.deploy(admins)).to.be.revertedWith(
        "MultiSigMarketplace__CtorListOfOwnersHasDuplicatedAddresses()"
      );

      //finally, add successfully a number of
      admins = getMockNbAdmins(nbAdmins).data;
      deployedMultisigContract = await contract.deploy(admins);
      const ownerAddresses =
        await deployedMultisigContract.getOwnersAddresses();

      assert.equal(ownerAddresses.length, admins.length);
      for (let i = 0; i < ownerAddresses.length; i++) {
        assert.equal(ownerAddresses[i].toLowerCase(), admins[i]);
      }
      const percentageOfAdminsNeededForApproval =
        await deployedMultisigContract.getPercentageOfAdminsNeededForApproval();
      const nbOfAdminsNeededForApproval_fromContract =
        await deployedMultisigContract.getNumberOfAdminsNeededForApproval();

      const nbOfAdminsNeededForApproval_fromTest = Math.floor(
        (ownerAddresses.length * percentageOfAdminsNeededForApproval) / 100
      );

      assert.equal(
        nbOfAdminsNeededForApproval_fromContract,
        nbOfAdminsNeededForApproval_fromTest
      );
    });
  });
});
