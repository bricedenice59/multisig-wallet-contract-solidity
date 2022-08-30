const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const {
  getMockAllAdmins,
  getMockNbAdmins,
} = require("../test/content/mockdata/fetcher");

describe("Multisig contract deployment test", function () {
  describe("constructor", () => {
    it("Initialize multi-sig contract", async () => {
      const contract = await ethers.getContractFactory("MultiSig");

      //test adding 2 admins in contract
      const twoAdmins = getMockNbAdmins(2).data;
      await expect(contract.deploy(twoAdmins)).to.be.revertedWith(
        "MultiSig__CtorNotEnoughOwners()"
      );

      //test adding all admins in contract, in contract number of owner is limited to 20

      const allAdmins = getMockNbAdmins(21).data;
      await expect(contract.deploy(allAdmins)).to.be.revertedWith(
        "MultiSig__CtorTooManyOwners()"
      );

      const nbAdmins = 15;
      //test adding 15 + 1 invalid admins in contract
      var admins = getMockNbAdmins(nbAdmins).data;
      const invalidAddressAdmin = "0x0000000000000000000000000000000000000000";
      admins.push(invalidAddressAdmin);
      await expect(contract.deploy(admins)).to.be.revertedWith(
        "MultiSig__OwnerInvalidAddress()"
      );

      //test adding 15 + a duplicate admin in contract
      admins = getMockNbAdmins(nbAdmins).data;
      const adminAddressAtIndex3 = admins[3];
      admins.push(adminAddressAtIndex3);
      await expect(contract.deploy(admins)).to.be.revertedWith(
        "MultiSig__CtorListOfOwnersHasDuplicatedAddresses()"
      );

      //finally, add successfully a number of
      admins = getMockNbAdmins(nbAdmins).data;
      const deployedMultisigContract = await contract.deploy(admins);
      console.log(
        `deployed multisig contract at ${deployedMultisigContract.address}`
      );
      const ownerAddresses =
        await deployedMultisigContract.getOwnersAddresses();

      assert.equal(ownerAddresses.length, admins.length);
      for (let i = 0; i < ownerAddresses.length; i++) {
        assert.equal(ownerAddresses[i].toLowerCase(), admins[i]);
      }
      const percentageOfAdminsNeededForApproval =
        await deployedMultisigContract.getPercentageOfOwnersRequiredForApproval();
      const nbOfAdminsNeededForApproval_fromContract =
        await deployedMultisigContract.getNumberOfOwnersRequiredForApproval();

      const nbOfAdminsNeededForApproval_fromTest = Math.floor(
        (ownerAddresses.length * percentageOfAdminsNeededForApproval) / 100
      );

      assert.equal(
        nbOfAdminsNeededForApproval_fromContract,
        nbOfAdminsNeededForApproval_fromTest
      );
    });
  });

  describe("Test Multisig Submit/Confirm/Execute functions", () => {
    var owner1, owner2, owner3, user1, user2;
    var deployedDemoContract;
    var deployedMultiSigContract;
    var provider;
    var argsTxSubmitted;
    var txNonce;
    before(async function () {
      var accounts = await ethers.getSigners();
      owner1 = accounts[1];
      owner2 = accounts[2];
      owner3 = accounts[3];
      //deploy a multisig contract with 3 accounts; deployer is owner1
      const multiSigContract = await ethers.getContractFactory("MultiSig");
      deployedMultiSigContract = await multiSigContract
        .connect(owner1)
        .deploy([owner1.address, owner2.address, owner3.address]);
      console.log(
        `deployed multisig contract at ${deployedMultiSigContract.address}`
      );
      provider = deployedMultiSigContract.provider;

      user1 = accounts[4];
      user2 = accounts[5];
      //deploy the demo contract using 2 users and the address of the previously deployed multisig contract
      //deployer of the demo contract is user1
      const demoContract = await ethers.getContractFactory("Demo");
      deployedDemoContract = await demoContract
        .connect(user1)
        .deploy(
          [user1.address, user2.address],
          deployedMultiSigContract.address
        );
    });

    it("User2 from demo contract has been initialized with blacklisted=false", async () => {
      const user = await deployedDemoContract.getUserAtIndex(user2.address);
      assert.equal(user.isBlacklisted, false);
    });

    it("Deployer(user1) from demo contract CANNOT blacklist user2", async () => {
      await expect(
        deployedDemoContract.connect(user1).freezeUser(user2.address)
      ).to.be.reverted;
    });

    it("Make a proposal(freeze user2) from demo contract by submitting a tx", async () => {
      //prepare payload
      var abiFragmentFreezeUser = ["function freezeUser(address user)"];
      var iAddOwner = new ethers.utils.Interface(abiFragmentFreezeUser);
      const payloadFreezeUser = iAddOwner.encodeFunctionData("freezeUser", [
        user2.address,
      ]);

      //prepare tx submission to interact with demo contract
      argsTxSubmitted = {
        _to: deployedDemoContract.address,
        _value: 0,
        _data: payloadFreezeUser,
      };
      //owner 2 sends a transaction proposal
      await expect(
        deployedMultiSigContract
          .connect(owner2)
          .submitTx(
            argsTxSubmitted._to,
            argsTxSubmitted._value,
            argsTxSubmitted._data
          )
      )
        .to.emit(deployedMultiSigContract, "TxSubmitted")
        .withArgs(
          owner2.address,
          1,
          argsTxSubmitted._to,
          argsTxSubmitted._value,
          argsTxSubmitted._data
        );

      txNonce = await deployedMultiSigContract.getTransactionCount();

      //test if a tx has been successfully created
      const txCreated = await deployedMultiSigContract.getTransaction(txNonce);
      assert.equal(txCreated.to, argsTxSubmitted._to);
      assert.equal(txCreated.nonce.toString(), txNonce.toString());
      assert.equal(txCreated.data, argsTxSubmitted._data);
      assert.equal(txCreated.executed, false);
      assert.equal(txCreated.nbOwnerConfirmationsProcessed, 0);
    });

    it("Owner2 confirms a proposal by confirming a tx", async () => {
      await expect(deployedMultiSigContract.connect(owner2).confirmTx(txNonce))
        .to.emit(deployedMultiSigContract, "TxConfirmed")
        .withArgs(owner2.address, owner2.address, txNonce);

      //test if tx has been successfully confirmed
      const tx = await deployedMultiSigContract.getTransaction(txNonce);

      assert.equal(tx.to, argsTxSubmitted._to);
      assert.equal(tx.executed, false);
      assert.equal(tx.nbOwnerConfirmationsProcessed, 1);
    });

    it("Owner2 tries to execute proposal tx and should fail as the number of required owners having confirmed has not been reached", async () => {
      await expect(
        deployedMultiSigContract.connect(owner2).executeTx(txNonce)
      ).to.be.revertedWith("MultiSig__TxCannotExecute");
    });

    it("Owner3 tries to execute proposal tx and should fail as the number of required owners having confirmed has not been reached", async () => {
      await expect(
        deployedMultiSigContract.connect(owner3).executeTx(txNonce)
      ).to.be.revertedWith("MultiSig__TxCannotExecute");
    });

    it("Owner1 also confirms the proposal by confirming a tx", async () => {
      await expect(deployedMultiSigContract.connect(owner1).confirmTx(txNonce))
        .to.emit(deployedMultiSigContract, "TxConfirmed")
        .withArgs(owner1.address, owner2.address, txNonce);

      //test if tx has been successfully confirmed
      const tx = await deployedMultiSigContract.getTransaction(txNonce);

      assert.equal(tx.to, argsTxSubmitted._to);
      assert.equal(tx.executed, false);
      assert.equal(tx.nbOwnerConfirmationsProcessed, 2);
    });

    it("User2 from demo contract should NOT BE blacklisted at that stage as the proposal has not been yet executed", async () => {
      const user = await deployedDemoContract.getUserAtIndex(user2.address);
      assert.equal(user.isBlacklisted, false);
    });

    it("Owner1 can execute proposal tx as the number of required owners having confirmed has been reached", async () => {
      await expect(deployedMultiSigContract.connect(owner1).executeTx(txNonce))
        .to.emit(deployedMultiSigContract, "TxExecuted")
        .withArgs(owner1.address, owner2.address, txNonce);

      //test if tx has been successfully executed
      const tx = await deployedMultiSigContract.getTransaction(txNonce);
      assert.equal(tx.nonce.toString(), txNonce.toString());
      assert.equal(tx.to, argsTxSubmitted._to);
      assert.equal(tx.executed, true);
    });

    it("Proposal has been executed and User2 from demo contract IS NOW blacklisted", async () => {
      const user = await deployedDemoContract.getUserAtIndex(user2.address);
      assert.equal(user.isBlacklisted, true);
    });
  });

  describe("Test AddOwner and RemoveOwner functions", () => {
    var owner2, owner2, owner3, user1, user2;
    var deployedMultiSigContract;
    var provider;
    var argsTxSubmitted;
    var ownersInMultiSigContract;
    var nbOfOwnersRequiredForApproval;
    before(async function () {
      var accounts = await ethers.getSigners();
      owner1 = accounts[1];
      owner2 = accounts[2];
      owner3 = accounts[3];
      //deploy a multisig contract with 3 accounts; deployer is owner1
      const multiSigContract = await ethers.getContractFactory("MultiSig");
      deployedMultiSigContract = await multiSigContract
        .connect(owner2)
        .deploy([owner1.address, owner2.address, owner3.address]);
      console.log(
        `deployed multisig contract at ${deployedMultiSigContract.address}`
      );

      provider = deployedMultiSigContract.provider;

      user1 = accounts[4];
      user2 = accounts[5];

      //Retrieves all owners from the contract
      ownersInMultiSigContract =
        await deployedMultiSigContract.getOwnersAddresses();
      assert.equal(ownersInMultiSigContract.length, 3);

      nbOfOwnersRequiredForApproval =
        await deployedMultiSigContract.getNumberOfOwnersRequiredForApproval();
      assert.equal(nbOfOwnersRequiredForApproval.toString(), "2");
    });

    it("Deployer of the multisig contract CANNOT add/remove a owner", async () => {
      await expect(
        deployedMultiSigContract.connect(owner2).addOwner(user1.address)
      ).to.be.reverted;
      await expect(
        deployedMultiSigContract.connect(owner2).removeOwner(owner2.address)
      ).to.be.reverted;
    });
    it("Random account CANNOT add/remove a owner", async () => {
      await expect(
        deployedMultiSigContract.connect(user2).addOwner(user1.address)
      ).to.be.reverted;
      await expect(
        deployedMultiSigContract.connect(user2).removeOwner(owner2.address)
      ).to.be.reverted;
    });
    it("Adding a new owner can only be achieved by submitting a new proposal", async () => {
      //----------send transation-----------
      //prepare payload
      var abiFragmentAddOwner = ["function addOwner(address newOwner)"];
      var iAddOwner = new ethers.utils.Interface(abiFragmentAddOwner);
      const payloadAddOwner = iAddOwner.encodeFunctionData("addOwner", [
        "0x06Cfb38C30775505C934A1bA364bfFEDfbFAfE37",
      ]);

      //prepare tx submission to interact with the multisig contract itself
      argsTxSubmitted = {
        _to: deployedMultiSigContract.address,
        _value: 0,
        _data: payloadAddOwner,
      };
      //owner 2 sends a transaction proposal
      await expect(
        deployedMultiSigContract
          .connect(owner2)
          .submitTx(
            argsTxSubmitted._to,
            argsTxSubmitted._value,
            argsTxSubmitted._data
          )
      )
        .to.emit(deployedMultiSigContract, "TxSubmitted")
        .withArgs(
          owner2.address,
          1,
          argsTxSubmitted._to,
          argsTxSubmitted._value,
          argsTxSubmitted._data
        );

      //----------transation sent-----------

      const txNonce = await deployedMultiSigContract.getTransactionCount();

      //----------confirmation of owners----------
      //owner2 confirms tx
      await expect(deployedMultiSigContract.connect(owner2).confirmTx(txNonce))
        .to.emit(deployedMultiSigContract, "TxConfirmed")
        .withArgs(owner2.address, owner2.address, txNonce);

      //owner3 confirms tx
      await expect(deployedMultiSigContract.connect(owner3).confirmTx(txNonce))
        .to.emit(deployedMultiSigContract, "TxConfirmed")
        .withArgs(owner3.address, owner2.address, txNonce);
      //----------confirmation txs sent-----------

      //----------execute tx----------------
      await expect(deployedMultiSigContract.connect(owner3).executeTx(txNonce))
        .to.emit(deployedMultiSigContract, "TxExecuted")
        .withArgs(owner3.address, owner2.address, txNonce);
      //----------execute tx sent-----------

      //Retrieves all owners from the contract
      const allOwnersAfterProposalExecuted =
        await deployedMultiSigContract.getOwnersAddresses();

      //user1 is a new owner of the multisig wallet?
      assert(
        allOwnersAfterProposalExecuted.length,
        ownersInMultiSigContract + 1
      );
      assert(allOwnersAfterProposalExecuted[3], user1.address);

      const nbOfOwnersNeededForApproval_afterNewOwnerAdded_fromContract =
        await deployedMultiSigContract.getNumberOfOwnersRequiredForApproval();
      const percentageOfAdminsNeededForApproval =
        await deployedMultiSigContract.getPercentageOfOwnersRequiredForApproval();
      const nbOfOwnersNeededForApproval_afterNewOwnerAdded_fromCalculation =
        Math.floor(
          (allOwnersAfterProposalExecuted.length *
            percentageOfAdminsNeededForApproval) /
            100
        );
      assert(
        nbOfOwnersNeededForApproval_afterNewOwnerAdded_fromContract.toString(),
        nbOfOwnersNeededForApproval_afterNewOwnerAdded_fromCalculation.toString()
      );
    });

    it("contract returns a correct number of transactions", async () => {
      const nbTxToSubmit = 15;
      //prepare payload
      var abiFragmentAddOwner = ["function func(uint256 test)"];
      var iAddOwner = new ethers.utils.Interface(abiFragmentAddOwner);
      const payloadAddOwner = iAddOwner.encodeFunctionData("func", [
        "0x06Cfb38C30775505C934A1bA364bfFEDfbFAfE37",
      ]);

      //prepare tx submission to interact with the multisig contract itself
      argsTxSubmitted = {
        _to: deployedMultiSigContract.address,
        _value: 0,
        _data: payloadAddOwner,
      };
      for (let index = 0; index < nbTxToSubmit; index++) {
        await deployedMultiSigContract
          .connect(owner2)
          .submitTx(
            argsTxSubmitted._to,
            argsTxSubmitted._value,
            argsTxSubmitted._data
          );
      }
      const txCount = await deployedMultiSigContract.getTransactionCount();
      assert(txCount.toString(), nbTxToSubmit);
    });
  });
});
