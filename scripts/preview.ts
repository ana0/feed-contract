// Deploys to a throwaway in-memory chain and writes out exactly what the contract
// returns, decoded, so the metadata can be read before anything is deployed.
import { writeFileSync } from "node:fs";
import { network } from "hardhat";
import { EXTERNAL_URL, GATEWAY, ROYALTY_BPS } from "../ignition/modules/Feed.js";

const { viem } = await network.create();
const publicClient = await viem.getPublicClient();
const feed = await viem.deployContract("Feed", [GATEWAY, EXTERNAL_URL, ROYALTY_BPS]);

const decode = (uri: string) =>
  JSON.parse(Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf8"));

const preview = {
  tokenURI: decode(await feed.read.tokenURI([1n])),
  contractURI: decode(await feed.read.contractURI()),
};

const text = JSON.stringify(preview, null, 2);
writeFileSync("METADATA_PREVIEW.json", text + "\n");
console.log(text);

const hash = (await publicClient.getContractEvents({ abi: feed.abi, address: feed.address, fromBlock: 0n }))[0]
  ?.transactionHash;
if (hash) {
  const { gasUsed } = await publicClient.getTransactionReceipt({ hash });
  console.log(`\nDeployment gas: ${gasUsed}`);
}
