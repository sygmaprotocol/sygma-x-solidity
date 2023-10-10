import fs from "fs";
import { resolve } from "path";
import { keccak256 } from "ethers";

const BRIDGE_CONTRACT_PATH = resolve(__dirname, "../src/contracts/Bridge.sol");
const ARTIFACTS_PATH = resolve(
  __dirname,
  "../artifactsFoundry/Bridge.sol/Bridge.json",
);

export function getRemappings(): string[][] {
  return fs
    .readFileSync("remappings.txt", "utf8")
    .split("\n")
    .filter(Boolean) // remove empty lines
    .map((line) => line.trim().split("="));
}

export function generateAccessControlFuncSignatures(): {
  function: string;
  hash: string;
}[] {
  const bridgeAbiJson = JSON.parse(fs.readFileSync(ARTIFACTS_PATH).toString());
  const bridgeContractMethods = bridgeAbiJson.metadata.output.userdoc
    .methods as { [key: string]: string };
  const bridgeContract = fs.readFileSync(BRIDGE_CONTRACT_PATH);

  // regex that will match all functions that have "onlyAllowed" modifier
  const regex = RegExp(
    "function\\s+(?:(?!_onlyAllowed|function).)+onlyAllowed",
    "gs",
  );

  let a;
  const b: Array<string> = [];
  // fetch all functions that have "onlyAllowed" modifier from "Bridge.sol"
  while ((a = regex.exec(bridgeContract.toString())) !== null) {
    // filter out only function name from matching (onlyAllowed) functions
    b.push(a[0].split(/[\s()]+/)[1]);
  }

  let accessControlFuncSignatures = [];
  // filter out from Bridge ABI functions signatures with "onlyAllowed" modifier
  accessControlFuncSignatures = Object.keys(bridgeContractMethods)
    .filter((el1) => b.some((el2) => el1.includes(el2)))
    .map((func) => ({
      function: func,
      hash: keccak256(Buffer.from(func)).substring(0, 10),
    }));

  console.table(accessControlFuncSignatures);

  return accessControlFuncSignatures;
}
