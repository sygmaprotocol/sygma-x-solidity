// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only

import { ethers } from "hardhat";
import { expect } from "chai";

describe("BasicFeeHandler - [constructor]", () => {
  it("[sanity] should revert deploying BasicFeeHandler contract if zero address is provided in constructor", async () => {
    const BasicFeeHandlerContract =
      await ethers.getContractFactory("BasicFeeHandler");
    await expect(
      BasicFeeHandlerContract.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWithCustomError(
      BasicFeeHandlerContract,
      "ZeroAddressProvided",
    );
  });
});
