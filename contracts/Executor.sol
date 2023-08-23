// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./interfaces/IBlockStorage.sol";
import "./libraries/StorageProof.sol";

contract Executor is Ownable {
    uint8   public immutable _domainID;
    uint256 public _slotIndex;
    address public _router;

    struct Proposal {
        uint8   originDomainID;
        uint8   securityModel;
        uint64  depositNonce;
        bytes32 resourceID;
        bytes   data;
        bytes proof;
    }

    // securityModel => block header storage addresse
    mapping(uint8 => address) public _securityModels;
    // origin domainID => nonces set => used deposit nonces
    mapping(uint8 => mapping(uint256 => uint256)) public usedNonces;

    event ProposalExecution(
        uint8   originDomainID,
        uint64  depositNonce
    );

    error DepositToCurrentDomain();
    error EmptyProposalsArray();


    function _msgSender() internal override view returns (address) {
        address signer = msg.sender;
        return signer;
    }

    /**
        @notice Initializes Bridge, creates and grants {_msgSender()} the admin role, sets access control
        contract for bridge and sets the inital state of the Bridge to paused.
        @param domainID ID of chain the Bridge contract exists on.
     */
    constructor (uint8 domainID, address securityModel, address router, uint256 slotIndex) {
        _domainID = domainID;
        _securityModels[1] = securityModel;
        _slotIndex = slotIndex;
        _router = router;
    }

    /**
        @notice Executes a deposit proposal using a specified handler contract (only if signature is signed by MPC).
        @notice Failed executeProposal from handler don't revert, emits {FailedHandlerExecution} event.
        @param proposal Proposal which consists of:
        - originDomainID ID of chain deposit originated from.
        - resourceID ResourceID to be used when making deposits.
        - depositNonce ID of deposit generated by origin Bridge contract.
        - data Data originally provided when deposit was made.
        @notice Emits {ProposalExecution} event.
        @notice Behaviour of this function is different for {PermissionedGenericHandler} and other specific ERC handlers.
        In the case of ERC handler, when execution fails, the handler will terminate the function with revert.
        In the case of {PermissionedGenericHandler}, when execution fails, the handler will emit a failure event and terminate the function normally.
     */
    function executeProposal(Proposal memory proposal) public {
        Proposal[] memory proposalArray = new Proposal[](1);
        proposalArray[0] = proposal;

        executeProposals(proposalArray);
    }

    /**
        @notice Executes a batch of deposit proposals using a specified handler contract for each proposal (only if signature is signed by MPC).
        @notice If executeProposals fails it doesn't revert, emits {FailedHandlerExecution} event.
        @param proposals Array of Proposal which consists of:
        - originDomainID ID of chain deposit originated from.
        - resourceID ResourceID to be used when making deposits.
        - depositNonce ID of deposit generated by origin Bridge contract.
        - data Data originally provided when deposit was made.
        @notice Emits {ProposalExecution} event for each proposal in the batch.
        @notice Behaviour of this function is different for {PermissionedGenericHandler} and other specific handlers.
        In the case of ERC handler, when execution fails, the handler will terminate the function with revert.
        In the case of {PermissionedGenericHandler}, when execution fails, the handler will emit a failure event and terminate the function normally.
     */
    function executeProposals(Proposal[] memory proposals) public {
        if (proposals.length == 0) revert EmptyProposalsArray();

        for (uint256 i = 0; i < proposals.length; i++) {
            if(isProposalExecuted(proposals[i].originDomainID, proposals[i].depositNonce)) {
                continue;
            }

            require(verify(proposals[i]));

            usedNonces[proposals[i].originDomainID][proposals[i].depositNonce / 256] |= 1 << (proposals[i].depositNonce % 256);
            emit ProposalExecution(proposals[i].originDomainID, proposals[i].depositNonce);
        }
    }

    /**
        @notice Returns a boolean value.
        @param domainID ID of chain deposit originated from.
        @param depositNonce ID of deposit generated by origin Bridge contract.
        @return Boolean value depending if deposit nonce has already been used or not.
     */
    function isProposalExecuted(uint8 domainID, uint256 depositNonce) public view returns (bool) {
        return usedNonces[domainID][depositNonce / 256] & (1 << (depositNonce % 256)) != 0;
    }

    function verify(Proposal memory proposal)
        internal
        view
        returns (bool)
    {
        bytes32 stateRoot;
        bytes32 storageRoot;
        bytes32 transferHash;

        (uint blockNumber, bytes[] memory accountProof, bytes[] memory storageProof) = abi.decode(proposal.proof, (uint, bytes[], bytes[]));


        IBlockStorage blockStorage = IBlockStorage(_securityModels[proposal.securityModel]);
        stateRoot = blockStorage.getStateRoot(proposal.originDomainID, blockNumber);
        storageRoot = StorageProof.getStorageRoot(accountProof, _router, stateRoot);
        transferHash = keccak256(
            abi.encode(
                proposal.originDomainID,
                _domainID,
                blockNumber,
                proposal.securityModel,
                proposal.depositNonce,
                proposal.resourceID,
                keccak256(proposal.data)
            )
        );
        bytes32 slotKey = keccak256(
            abi.encode(keccak256(abi.encode(proposal.depositNonce, _slotIndex)))
        );
        bytes32 slotValue = StorageProof.getStorageValue(slotKey, storageRoot, storageProof);
        if (slotValue != transferHash) {
            revert(Strings.toString(uint256(transferHash)));
        }

        return true;
    }
}
