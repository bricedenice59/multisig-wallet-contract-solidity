// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

error Demo__UserDoesNotExist();

/** @title A demo to only allow entities from a multisig wallet to blacklist/un-blacklist a user
 *  @author Brice Grenard
 */
contract Demo {
    struct User {
        address _address;
        bool isBlacklisted;
    }
    mapping(address => User) private s_users;
    address s_multiSigWallet;

    // Function
    /**
     * For this demo, just initialize a list of users
     * for simplicity reasons, there is no check on correct addresses or duplicates
     */
    constructor(address[] memory listOfUsers, address multiSigWallet) {
        for (uint256 i = 0; i < listOfUsers.length; i++) {
            address userAddress = listOfUsers[i];
            User memory user = User({
                _address: userAddress,
                isBlacklisted: false
            });
            s_users[userAddress] = user;
        }
        s_multiSigWallet = multiSigWallet;
    }

    modifier onlyMultiSigWallet() {
        require(msg.sender == address(s_multiSigWallet));
        _;
    }

    // Function
    /**
     * set user account frozen/unfrozen
     */
    function setFreezeUser(address _address, bool isFrozen) private {
        User storage user = s_users[_address];
        if (user._address == address(0)) revert Demo__UserDoesNotExist();

        user.isBlacklisted = isFrozen;
    }

    // Function
    /**
     * Freeze user account
     */
    function freezeUser(address user) external onlyMultiSigWallet {
        setFreezeUser(user, true);
    }

    // Function
    /**
     * Unfreeze user account
     */
    function unFreezeUser(address user) external onlyMultiSigWallet {
        setFreezeUser(user, false);
    }

    function getUserAtIndex(address _address)
        external
        view
        returns (User memory user)
    {
        user = s_users[_address];
    }

    fallback() external {}
}
