import { ethers } from "hardhat";
import { type Signer } from "ethers";
import { deployBridgeContracts } from "../test/helpers";
import type {
  Bridge,
  ERC20,
  ERC20Handler,
  Executor,
  PermissionlessGenericHandler,
  Router,
  TestStore,
} from "../typechain-types";

setupLocalBridge(Number(process.env["DOMAIN"]), process.env["ROUTER"])
  .then(() => console.log("Deployed contracts!"))
  .catch((err) => console.error(err));

export async function setupLocalBridge(
  domainID: number,
  routerAddress?: string,
): Promise<void> {
  const [bridge, router, executor] = await deployBridgeContracts(
    domainID,
    routerAddress,
  );
  console.log("Bridge address: ", await bridge.getAddress());
  console.log("Executor address: ", await executor.getAddress());
  console.log("Router address: ", await router.getAddress());

  const [permissionlessHandler, testStore] = await setupGeneric(
    bridge,
    executor,
  );
  console.log(
    "Generic handler address: ",
    await permissionlessHandler.getAddress(),
  );
  console.log("Test store address: ", await testStore.getAddress());
  const [erc20Handler, erc20] = await setupERC20(bridge, router, executor);
  console.log("ERC20 handler address: ", await erc20Handler.getAddress());
  console.log("ERC20 address: ", await erc20.getAddress());
}

export async function setupERC20(
  bridge: Bridge,
  router: Router,
  executor: Executor,
  initialTokenAmount = 1000000000000000,
  resourceID = "0x0000000000000000000000000000000000000000000000000000000000000000",
): Promise<[ERC20Handler, ERC20]> {
  const [admin] = await ethers.getSigners();
  const erc20HandlerFactory = await ethers.getContractFactory("ERC20Handler");
  const erc20HandlerInstance = await erc20HandlerFactory.deploy(
    await bridge.getAddress(),
    await router.getAddress(),
    await executor.getAddress(),
  );
  const erc20Factory = await ethers.getContractFactory(
    "ERC20PresetMinterPauserDecimals",
  );
  const erc20Instance = await erc20Factory.deploy("ERC20", "ERC20", 18);
  await erc20Instance.mint(
    await erc20HandlerInstance.getAddress(),
    initialTokenAmount,
  );
  await erc20Instance.mint(await admin.getAddress(), initialTokenAmount);
  await bridge.adminSetResource(
    await erc20HandlerInstance.getAddress(),
    resourceID,
    await erc20Instance.getAddress(),
    "0x",
  );
  return [erc20HandlerInstance, erc20Instance];
}

export async function setupGeneric(
  bridge: Bridge,
  executor: Executor,
  signer?: Signer,
  resourceID = "0x0000000000000000000000000000000000000000000000000000000000000005",
): Promise<[PermissionlessGenericHandler, TestStore]> {
  const genericFactory = await ethers.getContractFactory(
    "PermissionlessGenericHandler",
    signer,
  );
  const genericInstance = await genericFactory.deploy(
    await bridge.getAddress(),
    await executor.getAddress(),
  );
  await bridge.adminSetResource(
    await genericInstance.getAddress(),
    resourceID,
    await genericInstance.getAddress(),
    resourceID,
  );

  const testStore = await ethers.getContractFactory("TestStore", signer);
  const testStoreInstance = await testStore.deploy();
  return [genericInstance, testStoreInstance];
}
