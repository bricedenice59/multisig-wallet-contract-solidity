// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

error MultiSigMarketplace__OnlyOwner();
error MultiSigMarketplace__CtorNotEnoughOwners();
error MultiSigMarketplace__CtorTooManyOwners();
error MultiSigMarketplace__OwnerInvalidAddress();
error MultiSigMarketplace__CtorListOfOwnersHasDuplicatedAddresses();
error MultiSigMarketplace__TxAlreadyExecuted();
error MultiSigMarketplace__TxDoesNotExist();
error MultiSigMarketplace__TxAlreadyConfirmed();
error MultiSigMarketplace__TxCannotExecute();
error MultiSigMarketplace__TxExecuteFailed();
error MultiSigMarketplace__TxAlreadySubmitted();
error MultiSigMarketplace__AddOwnerFailed();
error MultiSigMarketplace__RemoveOwnerFailed();

/** @title A multisignature wallet contract
 *  @author Brice Grenard
 *  @notice This contract is a mutlisig wallet that is being used for the marketplace contract I have been working on.
 *  It allows any contract's owner to make a proposal and anyone including the proposal's author is welcomed to confirm it.
 *  If a proposal has gained enough confirmation, the transaction can be executed.
 */
contract MultiSigMarketplace {
    using SafeMath for uint256;

    /* events */
    event TxSubmitted(
        address indexed owner,
        uint256 indexed nonce,
        address indexed to,
        uint256 value,
        bytes data
    );
    event TxConfirmed(address indexed owner, uint256 indexed nonce);
    event TxExecuted(address indexed owner, uint indexed nonce);
    event MultiSigOwnerAdded(address indexed owner, uint256 indexed timestamp);
    event MultiSigOwnerRemoved(
        address indexed owner,
        uint256 indexed timestamp
    );

    uint8 immutable i_minimumOwnersCount = 3;
    uint8 immutable i_maximumOwnersCount = 20;
    //80% of owners required to approve a transaction, in this contract approve fct is executeTx()
    uint8 immutable i_percentageOwnersNeededForApproval = 80;

    //array of owner addresses stored in contract
    address[] private s_owners;
    //mapping that allows to track if an address is a owner
    mapping(address => bool) private s_isOwner;
    //for a given transaction nonce, returns the transaction object associated
    mapping(uint256 => Tx) private s_transactions;
    //for a given transaction nonce, track if a owner address has confirmed a transaction
    mapping(uint256 => mapping(address => bool)) hasConfirmed;
    //calculated number of owners required to execute a transaction
    uint256 private s_nbOwnerConfirmationsNeededForApproval;

    //A transaction object
    struct Tx {
        address to;
        uint256 nonce;
        uint256 value;
        bytes data;
        bool executed;
        uint8 nbOwnerConfirmationsProcessed;
    }

    // Modifier
    /**
     * Prevents any single owner to interact with the here-below functions decorated with this modifier
     * It is used in addOwner and removeOwner functions
     * The goal is to force proposal on adding/removing a user using this multisig wallet
     */
    modifier onlyThisWallet() {
        require(msg.sender == address(this));
        _;
    }

    // Modifier
    /**
     * Allows only owners registered into this contract to use functions decorated with this modifier
     */
    modifier onlyOwner() {
        if (!s_isOwner[msg.sender]) revert MultiSigMarketplace__OnlyOwner();
        _;
    }

    // Modifier
    /**
     * Prevents the confirmation of a non-existing transaction
     */
    modifier txExists(uint256 nonce) {
        if (s_transactions[nonce].to == address(0))
            revert MultiSigMarketplace__TxDoesNotExist();
        _;
    }

    // Modifier
    /**
     * Prevents the execution of a transaction that has already been executed
     */
    modifier txNotExecuted(uint256 nonce) {
        if (s_transactions[nonce].executed)
            revert MultiSigMarketplace__TxAlreadyExecuted();
        _;
    }

    // Modifier
    /**
     * Prevents the execution of a transaction that has already been confirmed
     */
    modifier txNotConfirmed(uint256 nonce) {
        if (hasConfirmed[nonce][msg.sender])
            revert MultiSigMarketplace__TxAlreadyConfirmed();
        _;
    }

    // Constructor
    /**
     * Initialize the contract with a pre-defined list of owners
     * Calculate the number of owners required to execute a transaction
     */
    constructor(address[] memory listOfOwners) {
        if (listOfOwners.length < i_minimumOwnersCount)
            revert MultiSigMarketplace__CtorNotEnoughOwners();
        if (listOfOwners.length > i_maximumOwnersCount)
            revert MultiSigMarketplace__CtorTooManyOwners();

        for (uint8 i = 0; i < listOfOwners.length; i++) {
            address owner = listOfOwners[i];
            if (owner == address(0))
                revert MultiSigMarketplace__OwnerInvalidAddress();
            if (s_isOwner[owner])
                revert MultiSigMarketplace__CtorListOfOwnersHasDuplicatedAddresses();
            s_isOwner[owner] = true;
        }
        s_owners = listOfOwners;
        s_nbOwnerConfirmationsNeededForApproval = getNumberOfAdminsNeededForApproval();
    }

    /**
     * Submit a proposal (transaction)
     * The proposal is for this use case a contract function call passed into the _data parameter
     * I may later use the value for funds withdrawal proposal
     */
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

    /**
     * Confirm a proposal (transaction)
     * Every owner stored in this contract may confirm the proposal
     */
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

    /**
     * Execute a proposal (transaction) if enough owners confirmed it.
     * Any owner stored in this contract may confirm the proposal, even if one has not confirmed it.
     */
    function executeTx(uint256 _nonce)
        external
        onlyOwner
        txExists(_nonce)
        txNotExecuted(_nonce)
    {
        uint256 numberOfApprovalsNeeded = getNumberOfAdminsNeededForApproval();
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

    /**
     * Add a new owner to this contract.
     * A single owner from this contract cannot add a new owner, he/her must send a proposal.
     */
    function addOwner(address newOwner) external onlyThisWallet {
        if (newOwner == address(0))
            revert MultiSigMarketplace__OwnerInvalidAddress();
        if (s_owners.length == type(uint8).max)
            revert MultiSigMarketplace__AddOwnerFailed();
        if (s_isOwner[newOwner]) revert MultiSigMarketplace__AddOwnerFailed();

        s_owners.push(newOwner);

        //update number of approvals needed for executing a transaction
        s_nbOwnerConfirmationsNeededForApproval = getNumberOfAdminsNeededForApproval();

        emit MultiSigOwnerAdded(newOwner, block.timestamp);
    }

    /**
     * Remove an exising owner from this contract.
     * A single owner from this contract cannot remove an existing owner, he/her must send a proposal.
     */
    function removeOwner(address owner) external onlyThisWallet {
        if (owner == address(0))
            revert MultiSigMarketplace__OwnerInvalidAddress();
        if (s_owners.length == i_minimumOwnersCount)
            revert MultiSigMarketplace__RemoveOwnerFailed();

        uint256 index = ownersArrayIndexOf(owner);
        ownersArrayRemoveAtIndex(index);
        s_isOwner[owner] = false;

        //update number of approvals needed for executing a transaction
        s_nbOwnerConfirmationsNeededForApproval = getNumberOfAdminsNeededForApproval();

        emit MultiSigOwnerRemoved(owner, block.timestamp);
    }

    /**
     * Get immutable percentage variable of owners required for a transaction execution.
     */
    function getPercentageOfOwnersNeededForApproval()
        external
        pure
        returns (uint8 nbAdminsNeeded)
    {
        nbAdminsNeeded = i_percentageOwnersNeededForApproval;
    }

    /**
     * Get a calculated value representing a number of owners required for a transaction execution.
     */
    function getNumberOfAdminsNeededForApproval()
        public
        view
        returns (uint256 nbAdminsNeeded)
    {
        uint256 nbOwnersCalculatedPercentage = s_owners
            .length
            .mul(i_percentageOwnersNeededForApproval)
            .div(100);
        nbAdminsNeeded = nbOwnersCalculatedPercentage;
    }

    /**
     * Returns a list of all owners stored in this contract.
     */
    function getOwnersAddresses()
        external
        view
        returns (address[] memory owners)
    {
        owners = s_owners;
    }

    /**
     * Returns the index of a given address in the owners array
     */
    function ownersArrayIndexOf(address value) public view returns (uint256) {
        uint i = 0;
        while (s_owners[i] != value) {
            i++;
        }
        return i;
    }

    /**
     * Remove a value from the owners array
     */
    function ownersArrayRemoveAtIndex(uint _index) public {
        require(_index < s_owners.length, "index out of bound");

        for (uint i = _index; i < s_owners.length - 1; i++) {
            s_owners[i] = s_owners[i + 1];
        }
        s_owners.pop();
    }
}
