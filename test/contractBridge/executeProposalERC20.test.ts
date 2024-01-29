// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only

import { ethers } from "hardhat";
import { assert, expect } from "chai";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployBridgeContracts, createERCDepositData } from "../helpers";

import { accountProof1, storageProof1 } from "../testingProofs";

import type {
  Bridge,
  Router,
  Executor,
  ERC20Handler,
  ERC20PresetMinterPauser,
  BlockStorage,
} from "../../typechain-types";

describe("Bridge - [execute proposal - ERC20]", () => {
  const originDomainID = 1;
  const destinationDomainID = 2;

  const initialTokenAmount = 100;
  const depositAmount = 10;
  const expectedDepositNonce = 1;
  const feeData = "0x";
  const emptySetResourceData = "0x";
  const securityModel = 1;
  const slot = 5090531;
  const routerAddress = "0x1a60efB48c61A79515B170CA61C84DD6dCA80418";
  const stateRoot =
    "0xdf5a6882ccba1fd513c68a254fa729e05f769b2fa312011e1f5c38cde69964c7";

  let bridgeInstance: Bridge;
  let routerInstance: Router;
  let executorInstance: Executor;
  let ERC20MintableInstance: ERC20PresetMinterPauser;
  let ERC20HandlerInstance: ERC20Handler;
  let blockStorageInstance: BlockStorage;
  let depositorAccount: HardhatEthersSigner;
  let recipientAccount: HardhatEthersSigner;
  let relayer1: HardhatEthersSigner;

  let resourceID: string;
  let depositData: string;
  let depositProposalData: string;

  let proposal: {
    originDomainID: number;
    securityModel: number;
    depositNonce: number;
    resourceID: string;
    data: string;
    storageProof: Array<string>;
  };

  beforeEach(async () => {
    [, depositorAccount, recipientAccount, relayer1] =
      await ethers.getSigners();

    [bridgeInstance, routerInstance, executorInstance, blockStorageInstance] =
      await deployBridgeContracts(destinationDomainID, routerAddress);
    const ERC20MintableContract = await ethers.getContractFactory(
      "ERC20PresetMinterPauser",
    );
    ERC20MintableInstance = await ERC20MintableContract.deploy("Token", "TOK");
    const ERC20HandlerContract =
      await ethers.getContractFactory("ERC20Handler");
    ERC20HandlerInstance = await ERC20HandlerContract.deploy(
      await bridgeInstance.getAddress(),
      await routerInstance.getAddress(),
      await executorInstance.getAddress(),
    );

    resourceID =
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    await Promise.all([
      ERC20MintableInstance.mint(depositorAccount, initialTokenAmount),
      ERC20MintableInstance.mint(
        await ERC20HandlerInstance.getAddress(),
        initialTokenAmount,
      ),
      bridgeInstance.adminSetResource(
        await ERC20HandlerInstance.getAddress(),
        resourceID,
        await ERC20MintableInstance.getAddress(),
        emptySetResourceData,
      ),
    ]);

    await ERC20MintableInstance.connect(depositorAccount).approve(
      await ERC20HandlerInstance.getAddress(),
      depositAmount,
    );

    depositData = createERCDepositData(
      depositAmount,
      20,
      await recipientAccount.getAddress(),
    );

    depositProposalData = createERCDepositData(
      depositAmount,
      20,
      await recipientAccount.getAddress(),
    );

    proposal = {
      originDomainID: originDomainID,
      securityModel: securityModel,
      depositNonce: expectedDepositNonce,
      resourceID: resourceID,
      data: depositProposalData,
      storageProof: storageProof1[0].proof,
    };

    await blockStorageInstance.storeStateRoot(originDomainID, slot, stateRoot);
  });

  it("isProposalExecuted returns false if depositNonce is not used", async () => {
    const destinationDomainID = await bridgeInstance._domainID();

    assert.isFalse(
      await executorInstance.isProposalExecuted(
        destinationDomainID,
        expectedDepositNonce,
      ),
    );
  });

  it("should revert ERC20 executeProposal if Bridge is paused", async () => {
    assert.isFalse(await bridgeInstance.paused());
    await expect(bridgeInstance.adminPauseTransfers()).not.to.be.reverted;
    assert.isTrue(await bridgeInstance.paused());
    await expect(
      routerInstance
        .connect(depositorAccount)
        .deposit(
          originDomainID,
          resourceID,
          securityModel,
          depositData,
          feeData,
        ),
    ).to.be.revertedWithCustomError(executorInstance, "BridgeIsPaused()");
  });

  it("should create and execute executeProposal successfully", async () => {
    // depositorAccount makes initial deposit of depositAmount
    assert.isFalse(await bridgeInstance.paused());
    await expect(
      routerInstance
        .connect(depositorAccount)
        .deposit(
          originDomainID,
          resourceID,
          securityModel,
          depositData,
          feeData,
        ),
    ).not.to.be.reverted;
    await expect(
      executorInstance
        .connect(relayer1)
        .executeProposal(proposal, accountProof1, slot),
    ).not.to.be.reverted;

    // check that deposit nonce has been marked as used in bitmap
    assert.isTrue(
      await executorInstance.isProposalExecuted(
        originDomainID,
        expectedDepositNonce,
      ),
    );

    // check that tokens are transferred to recipient address
    const recipientBalance =
      await ERC20MintableInstance.balanceOf(recipientAccount);
    assert.strictEqual(recipientBalance, BigInt(depositAmount));
  });

  it("should skip executing proposal if deposit nonce is already used", async () => {
    // depositorAccount makes initial deposit of depositAmount
    assert.isFalse(await bridgeInstance.paused());
    await expect(
      routerInstance
        .connect(depositorAccount)
        .deposit(
          originDomainID,
          resourceID,
          securityModel,
          depositData,
          feeData,
        ),
    ).not.to.be.reverted;

    await expect(
      executorInstance
        .connect(depositorAccount)
        .connect(relayer1)
        .executeProposal(proposal, accountProof1, slot),
    ).not.not.be.reverted;

    const skipExecuteTx = await executorInstance
      .connect(relayer1)
      .executeProposal(proposal, accountProof1, slot);
    // check that no ProposalExecution events are emitted
    await expect(skipExecuteTx).not.to.emit(
      executorInstance,
      "ProposalExecution",
    );
  });

  it("executeProposal event should be emitted with expected values", async () => {
    // depositorAccount makes initial deposit of depositAmount
    assert.isFalse(await bridgeInstance.paused());
    await expect(
      routerInstance
        .connect(depositorAccount)
        .deposit(
          originDomainID,
          resourceID,
          securityModel,
          depositData,
          feeData,
        ),
    ).not.to.be.reverted;

    const proposalTx = executorInstance
      .connect(relayer1)
      .executeProposal(proposal, accountProof1, slot);

    await expect(proposalTx)
      .to.emit(executorInstance, "ProposalExecution")
      .withArgs(originDomainID, expectedDepositNonce);

    // check that deposit nonce has been marked as used in bitmap
    assert.isTrue(
      await executorInstance.isProposalExecuted(
        originDomainID,
        expectedDepositNonce,
      ),
    );

    // check that tokens are transferred to recipient address
    const recipientBalance =
      await ERC20MintableInstance.balanceOf(recipientAccount);
    assert.strictEqual(recipientBalance, BigInt(depositAmount));
  });
});

// access seg: 0x18e2864e93f5920fEf54b4906c32B68DC74104d2
// bridge domainID=1: 0xbFD940A6316169a0774709BA46bb27138A436fB5
// bridge domainID=2: 0x63523D3139ea7d7ebc9220905Cb2bA3D7c3d0d62
// router2: 0x823E4FB060AEd9d5587e63d0B3324E28Ed1C78F8
// depositData2: 0x000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000014f39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// dest domainID=1 slot key: 0x7fc34355029a161f70aeee0386d9a2fb9a2518cf3f40dfaefce746c3a701bdb7
// account1 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
// account2 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
// account3 0x90F79bf6EB2c4f870365E785982E1f101E93b906
// account4 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
