// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only

import { assert, expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployBridge, createResourceID } from "../../helpers";
import type {
  Bridge,
  ERC20PresetMinterPauser,
  FeeHandlerRouter,
} from "../../../typechain-types";

describe("FeeHandlerRouter", () => {
  const originDomainID = 1;
  const destinationDomainID = 2;

  let bridgeInstance: Bridge;
  let ERC20MintableInstance: ERC20PresetMinterPauser;
  let feeHandlerRouterInstance: FeeHandlerRouter;
  let feeHandlerAccount: HardhatEthersSigner;
  let nonAdminAccount: HardhatEthersSigner;

  let resourceID: string;

  beforeEach(async () => {
    [, feeHandlerAccount, nonAdminAccount] = await ethers.getSigners();

    bridgeInstance = await deployBridge(originDomainID);
    const ERC20MintableContract = await ethers.getContractFactory(
      "ERC20PresetMinterPauser",
    );
    ERC20MintableInstance = await ERC20MintableContract.deploy("Token", "TOK");
    const FeeHandlerRouterContract =
      await ethers.getContractFactory("FeeHandlerRouter");
    feeHandlerRouterInstance = await FeeHandlerRouterContract.deploy(
      await bridgeInstance.getAddress(),
    );

    resourceID = createResourceID(
      await ERC20MintableInstance.getAddress(),
      originDomainID,
    );
  });

  it("should successfully set handler to resourceID", async () => {
    assert.deepEqual(
      await feeHandlerRouterInstance._domainResourceIDToFeeHandlerAddress(
        destinationDomainID,
        resourceID,
      ),
      "0x0000000000000000000000000000000000000000",
    );
    await feeHandlerRouterInstance.adminSetResourceHandler(
      destinationDomainID,
      resourceID,
      feeHandlerAccount.getAddress(),
    );
    const newFeeHandler =
      await feeHandlerRouterInstance._domainResourceIDToFeeHandlerAddress(
        destinationDomainID,
        resourceID,
      );
    assert.deepEqual(newFeeHandler, await feeHandlerAccount.getAddress());
  });

  it("should require admin role to set handler for resourceID", async () => {
    await expect(
      feeHandlerRouterInstance
        .connect(nonAdminAccount)
        .adminSetResourceHandler(
          destinationDomainID,
          resourceID,
          feeHandlerAccount.getAddress(),
        ),
    ).to.be.revertedWith("sender doesn't have admin role");
  });
});
