// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

import "../interfaces/IERCHandler.sol";

/**
    @title Function used across handler contracts.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with the Bridge contract.
 */
abstract contract ERCHandlerHelpers is IERCHandler {
    address public immutable _bridgeAddress;
    address public immutable _routerAddress;
    address public immutable _executorAddress;

    uint8 public constant DEFAULT_DECIMALS = 18;

    struct Decimals {
        bool isSet;
        uint8 externalDecimals;
    }

    struct ERCTokenContractProperties {
        bytes32 resourceID;
        bool isWhitelisted;
        bool isBurnable;
        Decimals decimals;
    }

    error SenderNotBridgeContract();
    error SenderNotExecutorContract();
    error SenderNotRouterContract();
    error ContractAddressNotWhitelisted(address contractAddress);
    error DepositAmountTooSmall(uint256 depositAmount);

    // resourceID => token contract address
    mapping(bytes32 => address) public _resourceIDToTokenContractAddress;

    // token contract address => ERCTokenContractProperties
    mapping(address => ERCTokenContractProperties) public _tokenContractAddressToTokenProperties;

    modifier onlyBridge() {
        _onlyBridge();
        _;
    }

    modifier onlyRouter() {
        _onlyRouter();
        _;
    }

    modifier onlyExecutor() {
        _onlyExecutor();
        _;
    }

    function _onlyBridge() private view {
        if (msg.sender != _bridgeAddress) revert SenderNotBridgeContract();
    }

    function _onlyExecutor() private view {
        if (msg.sender != _executorAddress) revert SenderNotExecutorContract();
    }

    function _onlyRouter() private view {
        if (msg.sender != _routerAddress) revert SenderNotRouterContract();
    }


    /**
        @param bridgeAddress Contract address of previously deployed Bridge.
        @param routerAddress Contract address of previously deployed Router.
        @param executorAddress Contract address of previously deployed Executor.
     */
    constructor(address bridgeAddress, address routerAddress, address executorAddress) {
        _bridgeAddress = bridgeAddress;
        _routerAddress = routerAddress;
        _executorAddress = executorAddress;
    }

    /**
        @notice First verifies {contractAddress} is whitelisted, then sets
        {_tokenContractAddressToTokenProperties[contractAddress].isBurnable} to true.
        @param contractAddress Address of contract to be used when making or executing deposits.
     */
    function setBurnable(address contractAddress) external override onlyBridge {
        _setBurnable(contractAddress);
    }

    function _setResource(bytes32 resourceID, address contractAddress) internal {
        _resourceIDToTokenContractAddress[resourceID] = contractAddress;
        _tokenContractAddressToTokenProperties[contractAddress].resourceID = resourceID;
        _tokenContractAddressToTokenProperties[contractAddress].isWhitelisted = true;
        _tokenContractAddressToTokenProperties[contractAddress].isBurnable = false;
    }

    function _setBurnable(address contractAddress) internal {
        if (!_tokenContractAddressToTokenProperties[contractAddress].isWhitelisted)
            revert ContractAddressNotWhitelisted(contractAddress);
        _tokenContractAddressToTokenProperties[contractAddress].isBurnable = true;
    }

    /**
        @notice First verifies {contractAddress} is whitelisted,
        then sets {_tokenContractAddressToTokenProperties[contractAddress].decimals.externalDecimals} to it's
        decimals value and {_tokenContractAddressToTokenProperties[contractAddress].decimals.isSet} to true.
        @param contractAddress Address of contract to be used when making or executing deposits.
        @param externalDecimals Decimal places of token that is transferred.
     */
    function _setDecimals(address contractAddress, uint8 externalDecimals) internal {
        if (!_tokenContractAddressToTokenProperties[contractAddress].isWhitelisted)
            revert ContractAddressNotWhitelisted(contractAddress);
        _tokenContractAddressToTokenProperties[contractAddress].decimals = Decimals({
            isSet: true,
            externalDecimals: externalDecimals
        });
    }

    /**
        @notice Converts token amount based on decimal places difference between the nework
        deposit is made on and bridge.
        @param tokenAddress Address of contract to be used when executing proposals.
        @param amount Decimals value to be set for {contractAddress}.
    */
    function convertToExternalBalance(address tokenAddress, uint256 amount) internal view returns (uint256) {
        Decimals memory decimals = _tokenContractAddressToTokenProperties[tokenAddress].decimals;
        if (!decimals.isSet) {
            return amount;
        } else if (decimals.externalDecimals >= DEFAULT_DECIMALS) {
            return amount * (10 ** (decimals.externalDecimals - DEFAULT_DECIMALS));
        } else {
            return amount / (10 ** (DEFAULT_DECIMALS - decimals.externalDecimals));
        }
    }

    /**
        @notice Converts token amount based on decimal places difference between the bridge and nework
        deposit is executed on.
        @param tokenAddress Address of contract to be used when executing proposals.
        @param amount Decimals value to be set for {contractAddress}.
    */
    function convertToInternalBalance(address tokenAddress, uint256 amount) internal view returns (uint256) {
        Decimals memory decimals = _tokenContractAddressToTokenProperties[tokenAddress].decimals;
        uint256 convertedBalance;
        if (!decimals.isSet) {
            return amount;
        } else if (decimals.externalDecimals >= DEFAULT_DECIMALS) {
            convertedBalance = amount / (10 ** (decimals.externalDecimals - DEFAULT_DECIMALS));
        } else {
            convertedBalance = amount * (10 ** (DEFAULT_DECIMALS - decimals.externalDecimals));
        }

        if (convertedBalance == 0) {
            revert DepositAmountTooSmall(amount);
        }

        return convertedBalance;
    }
}
