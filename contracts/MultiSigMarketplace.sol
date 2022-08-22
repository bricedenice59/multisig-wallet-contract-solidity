// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

error MultiSigMarketplace__OnlyOwner();
error MultiSigMarketplace__CtorNotEnoughOwners();
error MultiSigMarketplace__CtorTooManyOwners();
error MultiSigMarketplace__CtorListOfOwnersContainsInvalidAddress();
error MultiSigMarketplace__CtorListOfOwnersHasDuplicatedAddresses();
error MultiSigMarketplace__TxAlreadyExecuted();
error MultiSigMarketplace__TxDoesNotExist();
error MultiSigMarketplace__TxAlreadyConfirmed();
error MultiSigMarketplace__TxCannotExecute();
error MultiSigMarketplace__TxExecuteFailed();
error MultiSigMarketplace__TxAlreadySubmitted();

contract MultiSigMarketplace {
    using SafeMath for uint256;
    using SafeCast for uint256;

    event TxSubmitted(
        address indexed owner,
        uint256 indexed nonce,
        address indexed to,
        uint256 value,
        bytes data
    );
    event TxConfirmed(address indexed owner, uint256 indexed nonce);
    event TxExecuted(address indexed owner, uint indexed nonce);

    uint8 immutable i_percentageOwnersNeededForApproval = 80;

    address[] private s_owners;
    mapping(address => bool) private s_isOwner;
    mapping(uint256 => Tx) private s_transactions;
    mapping(uint256 => mapping(address => bool)) hasConfirmed;
    uint8 private s_nbOwnerConfirmationsNeededForApproval;

    struct Tx {
        address to;
        uint256 nonce;
        uint256 value;
        bytes data;
        bool executed;
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

    modifier onlyThisWallet() {
        require(msg.sender == address(this));
        _;
    }

    modifier onlyOwner() {
        if (!s_isOwner[msg.sender]) revert MultiSigMarketplace__OnlyOwner();
        _;
    }

    modifier txExists(uint256 nonce) {
        if (s_transactions[nonce].to == address(0))
            revert MultiSigMarketplace__TxDoesNotExist();
        _;
    }

    modifier txNotExecuted(uint256 nonce) {
        if (s_transactions[nonce].executed)
            revert MultiSigMarketplace__TxAlreadyExecuted();
        _;
    }

    modifier txNotConfirmed(uint256 nonce) {
        if (hasConfirmed[nonce][msg.sender])
            revert MultiSigMarketplace__TxAlreadyConfirmed();
        _;
    }

    function submitTx(
        address _to,
        uint256 _nonce,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner {
        //only one submission per nonce value
        if (s_transactions[_nonce].to != address(0))
            revert MultiSigMarketplace__TxAlreadySubmitted();

        s_transactions[_nonce] = Tx({
            to: _to,
            nonce: _nonce,
            value: _value,
            data: _data,
            executed: false,
            nbOwnerConfirmationsProcessed: 0
        });
        emit TxSubmitted(msg.sender, _nonce, _to, _value, _data);
    }

    function confirmTx(uint256 _nonce)
        external
        onlyOwner
        txExists(_nonce)
        txNotExecuted(_nonce)
        txNotConfirmed(_nonce)
    {
        Tx storage transaction = s_transactions[_nonce];
        transaction.nbOwnerConfirmationsProcessed += 1;
        hasConfirmed[_nonce][msg.sender] = true;

        emit TxConfirmed(msg.sender, _nonce);
    }

    function executeTx(uint256 _nonce)
        external
        onlyOwner
        txExists(_nonce)
        txNotExecuted(_nonce)
    {
        uint8 numberOfApprovalsNeeded = getNumberOfAdminsNeededForApproval();
        Tx storage transaction = s_transactions[_nonce];
        if (transaction.nbOwnerConfirmationsProcessed < numberOfApprovalsNeeded)
            revert MultiSigMarketplace__TxCannotExecute();
        transaction.executed = true;
        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        if (!success) revert MultiSigMarketplace__TxExecuteFailed();
        emit TxExecuted(msg.sender, _nonce);
    }

    function addOwner() external onlyThisWallet {}

    function removeOwner() external onlyThisWallet {}

    function getPercentageOfAdminsNeededForApproval()
        external
        pure
        returns (uint8 nbAdminsNeeded)
    {
        nbAdminsNeeded = i_percentageOwnersNeededForApproval;
    }

    function getNumberOfAdminsNeededForApproval()
        public
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
