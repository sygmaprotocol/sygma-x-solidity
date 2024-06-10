import { readFileSync } from "fs";

import type { NetworkConfig } from "../scripts/types";
import type { Bridge, Executor, SpectreProxy } from "../typechain-types";

const DEFAULT_CONFIG_PATH = "./scripts/environments/testnet.json";

export function getNetworksConfig(): {
  [key: string]: NetworkConfig;
} {
  let path: string = "";
  if (!path) {
    path = DEFAULT_CONFIG_PATH;
  }
  return JSON.parse(readFileSync(path).toString()) as unknown as {
    [key: string]: NetworkConfig;
  };
}

export async function setSpectreAddress(
  spectreProxyInstance: SpectreProxy,
  domainID: number,
  spectreAddress: string,
): Promise<void> {
  // check if we want to pass array and iterate
  await spectreProxyInstance.adminSetSpectreAddress(domainID, spectreAddress);
}

export async function setRouterAddress(
  bridgeInstance: Bridge,
  routerAddress: string,
): Promise<void> {
  await bridgeInstance.adminChangeRouterAddress(routerAddress);
}

export async function setExecutorAddress(
  bridgeInstance: Bridge,
  executorAddress: string,
): Promise<void> {
  await bridgeInstance.adminChangeRouterAddress(executorAddress);
}

export async function setResources(
  bridgeInstance: Bridge,
  handlerAddress: string,
  resourceID: string,
  contractAddress: string,
  args?: string,
): Promise<void> {
  await bridgeInstance.adminSetResource(
    handlerAddress,
    resourceID,
    contractAddress,
    args ?? "",
  );
}

export async function setVerifiers(
  executorInstance: Executor,
  securityModel: number,
  verifiersAddresses: Array<string>,
): Promise<void> {
  await executorInstance.adminSetVerifiers(securityModel, verifiersAddresses);
}

export async function changeSlotIndex(
  executorInstance: Executor,
  securityModel: number,
  slotIndex: number,
): Promise<void> {
  await executorInstance.adminChangeSlotIndex(securityModel, slotIndex);
}
