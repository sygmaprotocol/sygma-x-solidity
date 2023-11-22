// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Context.sol";


import "./interfaces/IBridge.sol";
import "./interfaces/IHandler.sol";


/**
    @title Facilitates proposal executions.
    @author ChainSafe Systems.
 */
contract Executor is Context {
    using ECDSA for bytes32;

    IBridge public immutable _bridge;

    // origin domainID => nonces set => used deposit nonces
    mapping(uint8 => mapping(uint256 => uint256)) public usedNonces;

    struct Proposal {
        uint8 originDomainID;
        uint64 depositNonce;
        bytes32 resourceID;
        bytes data;
    }

    event ProposalExecution(uint8 originDomainID, uint64 depositNonce, bytes32 dataHash, bytes handlerResponse);
    event FailedHandlerExecution(bytes lowLevelData, uint8 originDomainID, uint64 depositNonce);

    error EmptyProposalsArray();
    error BridgeIsPaused();

    modifier whenBridgeNotPaused() {
        if (_bridge.paused()) revert BridgeIsPaused();
        _;
    }

    constructor(address bridge) {
        _bridge = IBridge(bridge);
    }


    /**
        @notice Executes a batch of deposit proposals using a specified handler contract for each proposal
        @notice If executeProposals fails it doesn't revert, emits {FailedHandlerExecution} event.
        @param proposals Array of Proposal which consists of:
        - originDomainID ID of chain deposit originated from.
        - resourceID ResourceID to be used when making deposits.
        - depositNonce ID of deposit generated by origin Bridge contract.
        - data Data originally provided when deposit was made.
        @notice Emits {ProposalExecution} event for each proposal in the batch.
        @notice Behaviour: when execution fails, the handler will terminate the function with revert.
     */
    function executeProposals(Proposal[] memory proposals) public whenBridgeNotPaused {
        if (proposals.length == 0) revert EmptyProposalsArray();

        for (uint256 i = 0; i < proposals.length; i++) {
            if (isProposalExecuted(proposals[i].originDomainID, proposals[i].depositNonce)) {
                continue;
            }

            address handler = IBridge(_bridge)._resourceIDToHandlerAddress(proposals[i].resourceID);
            bytes32 dataHash = keccak256(abi.encodePacked(handler, proposals[i].data));

            IHandler depositHandler = IHandler(handler);

            usedNonces[proposals[i].originDomainID][proposals[i].depositNonce / 256] |=
                1 <<
                (proposals[i].depositNonce % 256);
            try depositHandler.executeProposal(proposals[i].resourceID, proposals[i].data) returns (
                bytes memory handlerResponse
            ) {
                emit ProposalExecution(
                    proposals[i].originDomainID,
                    proposals[i].depositNonce,
                    dataHash,
                    handlerResponse
                );
            } catch (bytes memory lowLevelData) {
                emit FailedHandlerExecution(lowLevelData, proposals[i].originDomainID, proposals[i].depositNonce);
                usedNonces[proposals[i].originDomainID][proposals[i].depositNonce / 256] &= ~(1 <<
                    (proposals[i].depositNonce % 256));
                continue;
            }
        }
    }


    /**
        @notice Executes a deposit proposal using a specified handler contract
        @notice Failed executeProposal from handler don't revert, emits {FailedHandlerExecution} event.
        @param proposal Proposal which consists of:
        - originDomainID ID of chain deposit originated from.
        - resourceID ResourceID to be used when making deposits.
        - depositNonce ID of deposit generated by origin Bridge contract.
        - data Data originally provided when deposit was made.
        @notice Emits {ProposalExecution} event.
        @notice Behaviour: when execution fails, the handler will terminate the function with revert.
     */
    function executeProposal(Proposal memory proposal) public {
        Proposal[] memory proposalArray = new Proposal[](1);
        proposalArray[0] = proposal;

        executeProposals(proposalArray);
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
}
