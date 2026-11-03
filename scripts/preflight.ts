// Runs before a mainnet deployment. It deploys to a throwaway chain, reads the real
// metadata back, and refuses to continue unless it points at things that exist.
import { network } from "hardhat";
import { EXTERNAL_URL, GATEWAY, ROYALTY_BPS } from "../ignition/modules/Feed.js";

const { viem } = await network.create();
const feed = await viem.deployContract("Feed", [GATEWAY, EXTERNAL_URL, ROYALTY_BPS]);
const token = JSON.parse(
  Buffer.from((await feed.read.tokenURI([1n])).split(",")[1], "base64").toString("utf8"),
);

const failures: string[] = [];
const trait = (name: string): string =>
  token.attributes.find((a: { trait_type: string }) => a.trait_type === name).value;

if (JSON.stringify(token).includes("PLACEHOLDER")) failures.push("the metadata still contains placeholders");

const commit = trait("Source commit");
if (/^[0-9a-f]{40}$/.test(commit)) {
  const repo = trait("Source repository").replace("https://github.com/", "");
  const res = await fetch(`https://api.github.com/repos/${repo}/commits/${commit}`);
  if (!res.ok) failures.push(`commit ${commit} is not on GitHub (${res.status})`);
} else {
  failures.push(`source commit is not a full 40-character hash: ${commit}`);
}

async function checkMedia(label: string, url: string, expected: RegExp) {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-0" } });
    await res.body?.cancel();
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) failures.push(`${label}: ${url} returned ${res.status}`);
    else if (!expected.test(type)) failures.push(`${label}: ${url} has Content-Type "${type}"`);
    else console.log(`ok  ${label}  ${res.status}  ${type}  ${url}`);
  } catch (error) {
    failures.push(`${label}: ${url} could not be reached (${error})`);
  }
}

await checkMedia("image", token.image, /^image\/(png|jpeg)/);
await checkMedia("video", token.animation_url, /^video\//);
await checkMedia("external_url", token.external_url, /^text\/html/);

if (failures.length > 0) {
  console.error("\nNOT READY TO DEPLOY:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nPreflight passed.");
