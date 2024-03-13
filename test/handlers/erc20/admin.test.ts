// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only

import { ethers } from "hardhat";
import { expect } from "chai";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type {
  Bridge,
  Router,
  Executor,
  ERC20Handler,
  ERC20Handler__factory,
  ERC20PresetMinterPauser,
} from "../../../typechain-types";
import {
  createERCDepositData,
  createResourceID,
  deployBridgeContracts,
} from "../../helpers";

describe("ERC20Handler - [constructor]", function () {
  const domainID = 1;
  const routerAddress = "0x1a60efB48c61A79515B170CA61C84DD6dCA80418";
  const depositAmount = 10;

  let depositData: string;
  let resourceID: string;

  let bridgeInstance: Bridge;
  let routerInstance: Router;
  let executorInstance: Executor;
  let ERC20HandlerContract: ERC20Handler__factory;
  let ERC20MintableInstance: ERC20PresetMinterPauser;
  let ERC20HandlerInstance: ERC20Handler;
  let depositorAccount: HardhatEthersSigner;
  let recipientAccount: HardhatEthersSigner;

  beforeEach(async () => {
    [, depositorAccount, recipientAccount] = await ethers.getSigners();
    [bridgeInstance, routerInstance, executorInstance] =
      await deployBridgeContracts(domainID, routerAddress);

    const ERC20MintableContract = await ethers.getContractFactory(
      "ERC20PresetMinterPauser",
    );
    ERC20MintableInstance = await ERC20MintableContract.deploy("Token", "TOK");
    ERC20HandlerContract = await ethers.getContractFactory("ERC20Handler");
    ERC20HandlerInstance = await ERC20HandlerContract.deploy(
      await bridgeInstance.getAddress(),
      await routerInstance.getAddress(),
      await executorInstance.getAddress(),
    );

    resourceID = createResourceID(
      await ERC20MintableInstance.getAddress(),
      domainID,
    );

    depositData = createERCDepositData(
      depositAmount,
      20,
      await recipientAccount.getAddress(),
    );
  });

  it("[sanity] should revert if deposit is not called by Router", async () => {
    await expect(
      ERC20HandlerInstance.deposit(resourceID, depositorAccount, depositData),
    ).to.be.revertedWith("sender must be router contract");
  });

  it("[sanity] should revert if deposit is not called by Router", async () => {
    await expect(
      ERC20HandlerInstance.executeProposal(resourceID, depositData),
    ).to.be.revertedWith("sender must be executor contract");
  });

  it("[sanity] should revert if deposit is not called by Router", async () => {
    await expect(
      ERC20HandlerInstance.setResource(
        resourceID,
        await ERC20MintableInstance.getAddress(),
        "0x",
      ),
    ).to.be.revertedWith("sender must be bridge contract");
  });

  it("[sanity] should revert if deposit is not called by Router", async () => {
    await expect(
      ERC20HandlerInstance.setBurnable(await ERC20HandlerInstance.getAddress()),
    ).to.be.revertedWith("sender must be bridge contract");
  });

  it("[sanity] should revert if deposit is not called by Router", async () => {
    await expect(ERC20HandlerInstance.withdraw("0x")).to.be.revertedWith(
      "sender must be bridge contract",
    );
  });
});
