import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export const GATEWAY = "https://isthisa.computer";
export const EXTERNAL_URL = "https://feed.isthisa.com";
export const ROYALTY_BPS = 500n; // 5%

export default buildModule("Feed", (m) => {
  const feed = m.contract("Feed", [GATEWAY, EXTERNAL_URL, ROYALTY_BPS]);
  return { feed };
});
