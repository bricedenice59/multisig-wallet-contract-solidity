# MultiSig Project

This project demonstrates a basic multisig wallet use case. It comes with a sample demo contract, a full comprehensive test file and also a script that deploys that contract.

Goal of the tests is to ensure that a user from the demo contract can only be blacklisted if a consensus to do so is reached.

The deployer of the demo contract is not allowed to change any user blacklisted state.

Multiple owners(in this test 3) have to confirm the transaction in order for the proposal to be executable and being executed.

Execution of the proposal tx will result in a change of the user structure boolean isBlacklisted from false to true.

Finally, adding or removing a owner from the multisig contract can only be achieved via a proposal transaction.

Try running tests with following tasks:

In order to deploy the contract, you need to define as many owners as you want by adding new owners private keys in your .env file
```shell
DEPLOYER_PRIVATE_KEY=.....
OWNER1_PRIVATE_KEY=.....
OWNER2_PRIVATE_KEY=.....
OWNER3_PRIVATE_KEY=.....
....
```

in your hardhat.config.js, for each test network you want to deploy to, define accounts like following

```shell
goerli: {
      url: GOERLI_RPC_URL,
      accounts: [
        DEPLOYER_ACCOUNT,
        OWNER1_ACCOUNT,
        OWNER2_ACCOUNT,
        OWNER3_ACCOUNT,
      ],
      chainId: 5,
      .......
      ......
}
```

Add your accounts in the namedAccounts section
```shell
namedAccounts: {
    deployer: {
      default: 0,
    },
    owner1: {
      default: 1,
    },
    owner2: {
      default: 2,
    },
    owner3: {
      default: 3,
    },
  }
```

Check the file hardhat.config.js if you encounter troubles.

Try running tests with following tasks:

```shell
npm install
npx hardhat test
```
