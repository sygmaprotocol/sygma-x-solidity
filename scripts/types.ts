export enum DEPLOYMENTS {
  AccessSegregator = "AccessControlSegregator",
  SpectreProxy = "SpectreProxy",
  Bridge = "Bridge",
  Router = "Router",
  Executor = "Executor",
  ERC20Handler = "ERC20Handler",
}

export type Token = {
  name: string;
  symbol: string;
  address: string;
  resourceID: string;
  feeType: string;
  strategy: "lr" | "mb";
  decimals: string;
};

export enum FeeHandlerType {
  BASIC = "basic",
  PERCENTAGE = "percentage",
  UNDEFINED = "undefined",
}

export type NetworkConfig = {
  domainID: string;
  specterAddress: string;
  routerAddress: string;
  executorAddress: string;
  verifiersAddresses: Array<string>;
  slotIndex: number;
  securityModel: number;
  access: {
    feeRouterAdmin: string;
    feeHandlerAdmin: string;
    accessControl: {
      [key: string]: string;
    };
  };
  erc20: Array<Token>;
  permissionlessGeneric: {
    resourceID: string;
    feeType: FeeHandlerType;
  };
};
