// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

error MultiSigMarketplace__CtorNotEnoughOwners();
error MultiSigMarketplace__CtorTooManyOwners();
error MultiSigMarketplace__CtorListOfOwnersContainsInvalidAddress();
error MultiSigMarketplace__CtorListOfOwnersHasDuplicatedAddresses();

contract MultiSigMarketplace {
    using SafeMath for uint256;
    using SafeCast for uint256;

    uint8 immutable i_percentageOwnersNeededForApproval = 80;

    address[] private s_owners;
    mapping(address => bool) private s_isOwner;
    Tx[] private s_transactions;
    uint8 private s_nbOwnerConfirmationsNeededForApproval;

    struct Tx {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        mapping(address => bool) hasConfirmed;
        uint8 nbOwnerConfirmationsProcessed;
    }

    constructor(address[] memory listOfOwners) {
        if (listOfOwners.length <= 3)
            revert MultiSigMarketplace__CtorNotEnoughOwners();
        if (listOfOwners.length > type(uint8).max)
            revert MultiSigMarketplace__CtorTooManyOwners();

        for (uint8 i = 0; i < listOfOwners.length; i++) {
            address owner = listOfOwners[i];
            if (owner == address(0))
                revert MultiSigMarketplace__CtorListOfOwnersContainsInvalidAddress();
            if (s_isOwner[owner])
                revert MultiSigMarketplace__CtorListOfOwnersHasDuplicatedAddresses();
            s_isOwner[owner] = true;
        }
        s_owners = listOfOwners;

        uint256 nbOwnersCalculatedPercentage = listOfOwners
            .length
            .mul(i_percentageOwnersNeededForApproval)
            .div(100);
        s_nbOwnerConfirmationsNeededForApproval = SafeCast.toUint8(
            nbOwnersCalculatedPercentage
        );
    }

    function submitTx() external {}

    function confirmTx() external {}

    function executeTx() external {}

    function addOwner() external {}

    function removeOwner() external {}

    function getPercentageOfAdminsNeededForApproval()
        external
        pure
        returns (uint8 nbAdminsNeeded)
    {
        nbAdminsNeeded = i_percentageOwnersNeededForApproval;
    }

    function getNumberOfAdminsNeededForApproval()
        external
        view
        returns (uint8 nbAdminsNeeded)
    {
        nbAdminsNeeded = s_nbOwnerConfirmationsNeededForApproval;
    }

    function getOwnersAddresses()
        external
        view
        returns (address[] memory owners)
    {
        owners = s_owners;
    }
}
