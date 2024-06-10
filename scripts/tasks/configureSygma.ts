import { task } from "hardhat/config";

import { getNetworksConfig } from "../../test/deployments";
import { DEPLOYMENTS } from "../types";

const EMPTY_SET_RESOURCE_DATA = "0x";

task("configure-sygma", "Configures all Sygma contracts after deployments")
  .addParam("file", "Environment for which you want to configure Sygma")
  .setAction(async (_, hre) => {
    const networksConfig = getNetworksConfig();
    const currentNetworkConfig = networksConfig[hre.network.name];
    // remove the current network from networks config
    delete networksConfig[hre.network.name];

    const accessSegregatorDeployment = await hre.deployments.get(
      DEPLOYMENTS.AccessSegregator,
    );
    const accessControlInstance = await hre.ethers.getContractAt(
      DEPLOYMENTS.AccessSegregator,
      accessSegregatorDeployment.address,
    );

    const spectreProxyDeployment = await hre.deployments.get(
      DEPLOYMENTS.SpectreProxy,
    );
    const spectreProxyInstance = await hre.ethers.getContractAt(
      DEPLOYMENTS.SpectreProxy,
      spectreProxyDeployment.address,
    );

    const bridgeDeployment = await hre.deployments.get(DEPLOYMENTS.Bridge);
    const bridgeInstance = await hre.ethers.getContractAt(
      DEPLOYMENTS.Bridge,
      bridgeDeployment.address,
    );

    const erc20HandlerDeployment = await hre.deployments.get(
      DEPLOYMENTS.ERC20Handler,
    );
    const erc20HandlerInstance = await hre.ethers.getContractAt(
      DEPLOYMENTS.ERC20Handler,
      erc20HandlerDeployment.address,
    );

    const executorDeployment = await hre.deployments.get(DEPLOYMENTS.Executor);
    const executorInstance = await hre.ethers.getContractAt(
      DEPLOYMENTS.Executor,
      executorDeployment.address,
    );

    await spectreProxyInstance.adminSetSpectreAddress(
      currentNetworkConfig.domainID,
      currentNetworkConfig.specterAddress,
    );

    await bridgeInstance.adminChangeRouterAddress(
      currentNetworkConfig.routerAddress,
    );

    await bridgeInstance.adminChangeExecutorAddress(
      currentNetworkConfig.executorAddress,
    );

    for (const network of Object.values(networksConfig)) {
      await executorInstance.adminChangeSlotIndex(
        network.domainID,
        network.slotIndex,
      );

      await executorInstance.adminSetVerifiers(
        network.securityModel,
        network.verifiersAddresses,
      );
    }

    for (const erc20Token of currentNetworkConfig.erc20) {
      const erc20HandlerAddress = await erc20HandlerInstance.getAddress();
      const erc20TokenInstance = await hre.ethers.getContractAt(
        "ERC20PresetMinterPauser",
        erc20Token.address,
      );

      await bridgeInstance.adminSetResource(
        erc20HandlerAddress,
        erc20Token.resourceID,
        await erc20TokenInstance.getAddress(),
        EMPTY_SET_RESOURCE_DATA,
      );

      // strategy can be either mb (mint/burn) or lr (lock/release)
      if (erc20Token.strategy == "mb") {
        await erc20TokenInstance.grantRole(
          await erc20TokenInstance.MINTER_ROLE(),
          erc20HandlerAddress,
        );
        await bridgeInstance.adminSetBurnable(
          erc20HandlerAddress,
          erc20Token.address,
        );
      }
    }

    // check json config if func access right should be renounced
    const reannounceAdminAddress = process.env.FUNCTIONS_ACCESS_ADMIN_ADDRESS;
    if (reannounceAdminAddress) {
      for (const [func, admin] of Object.entries(
        currentNetworkConfig.access.accessControl,
      )) {
        console.log("Granting access for function %s to %s", func, admin);
        await accessControlInstance.grantAccess(func, admin);
        console.log(
          `Granted all admin functions rights to: ${reannounceAdminAddress}`,
        );
        await accessControlInstance.grantAccess(func, admin);
      }
    }
    console.log("Sygma-x successfully configured");
  });
