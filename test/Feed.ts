import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress } from "viem";

const GATEWAY = "https://isthisa.com";
const EXTERNAL_URL = "https://feed.isthisa.com";

const decode = (uri: string) => {
  const prefix = "data:application/json;base64,";
  assert.ok(uri.startsWith(prefix));
  return JSON.parse(Buffer.from(uri.slice(prefix.length), "base64").toString("utf8"));
};

describe("Feed", () => {
  let viem: any;
  let deployer: any, collector: any, stranger: any, nextOwner: any;

  before(async () => {
    ({ viem } = await network.create());
    [deployer, collector, stranger, nextOwner] = await viem.getWalletClients();
  });

  const deploy = () => viem.deployContract("Feed", [GATEWAY, EXTERNAL_URL, 500n]);
  const as = (feed: any, wallet: any) =>
    viem.getContractAt("Feed", feed.address, { client: { wallet } });
  const sold = async () => {
    const feed = await deploy();
    await feed.write.transferFrom([deployer.account.address, collector.account.address, 1n]);
    return feed;
  };

  describe("minting", () => {
    it("mints token 1, and only token 1, to the deployer", async () => {
      const feed = await deploy();
      assert.equal(await feed.read.ownerOf([1n]), getAddress(deployer.account.address));
      assert.equal(await feed.read.balanceOf([deployer.account.address]), 1n);
      assert.equal(await feed.read.name(), "FEED");
      assert.equal(await feed.read.symbol(), "FEED");
      assert.equal("mint" in feed.write, false);
    });
  });

  describe("metadata", () => {
    it("returns valid JSON with the expected fields and URLs", async () => {
      const feed = await deploy();
      const token = decode(await feed.read.tokenURI([1n]));
      assert.equal(token.name, "FEED");
      assert.equal(token.created_by, "Sarah Friend");
      assert.ok(token.image.startsWith("https://isthisa.com/ipfs/"));
      assert.ok(token.animation_url.startsWith("https://isthisa.com/ipfs/"));
      assert.equal(token.external_url, EXTERNAL_URL);
      assert.match(token.description, /^FEED is an artwork by Sarah Friend/);
      assert.equal(token.description.split("\n\n").length, 4);
      const traits = token.attributes.map((a: any) => a.trait_type);
      assert.deepEqual(traits, ["Artist", "Year", "License", "Source repository", "Source commit"]);
    });

    it("reverts tokenURI for a token that does not exist", async () => {
      const feed = await deploy();
      await assert.rejects(feed.read.tokenURI([2n]));
    });

    it("returns contract metadata that follows the royalty and domain", async () => {
      const feed = await deploy();
      let collection = decode(await feed.read.contractURI());
      assert.equal(collection.name, "FEED");
      assert.equal(collection.external_link, EXTERNAL_URL);
      assert.equal(collection.seller_fee_basis_points, 500);
      assert.equal(getAddress(collection.fee_recipient), getAddress(deployer.account.address));

      await feed.write.setRoyalty([nextOwner.account.address, 250n]);
      await feed.write.setGateway(["https://example.org"]);
      collection = decode(await feed.read.contractURI());
      assert.equal(collection.seller_fee_basis_points, 250);
      assert.equal(getAddress(collection.fee_recipient), getAddress(nextOwner.account.address));
      assert.ok(collection.image.startsWith("https://example.org/ipfs/"));
    });

    it("stays valid JSON, with no injected fields, whatever the URLs contain", async () => {
      const feed = await deploy();
      const hostile = 'https://x.com","name":"HIJACKED\\\n';
      await feed.write.setGateway([hostile]);
      await feed.write.setExternalUrl([hostile]);
      const token = decode(await feed.read.tokenURI([1n]));
      const collection = decode(await feed.read.contractURI());
      assert.equal(token.name, "FEED");
      assert.equal(collection.name, "FEED");
      assert.equal(token.external_url, hostile);
      assert.ok(token.image.startsWith(hostile + "/ipfs/"));
    });
  });

  describe("owner permissions", () => {
    it("starts with the deployer as owner", async () => {
      const feed = await deploy();
      assert.equal(await feed.read.owner(), getAddress(deployer.account.address));
    });

    it("keeps the owner when the token is sold", async () => {
      const feed = await sold();
      assert.equal(await feed.read.owner(), getAddress(deployer.account.address));
      await feed.write.setGateway(["https://new.example"]);
      await feed.write.setExternalUrl(["https://live.example"]);
      await feed.write.setRoyalty([deployer.account.address, 750n]);
      assert.equal(await feed.read.gateway(), "https://new.example");
      assert.equal(await feed.read.externalUrl(), "https://live.example");
      const [, amount] = await feed.read.royaltyInfo([1n, 10_000n]);
      assert.equal(amount, 750n);
    });

    it("gives the token holder and strangers no permissions", async () => {
      const feed = await sold();
      for (const wallet of [collector, stranger]) {
        const theirs = await as(feed, wallet);
        await assert.rejects(theirs.write.setGateway(["https://evil.example"]));
        await assert.rejects(theirs.write.setExternalUrl(["https://evil.example"]));
        await assert.rejects(theirs.write.setRoyalty([wallet.account.address, 0n]));
        await assert.rejects(theirs.write.transferOwnership([wallet.account.address]));
      }
    });

    it("moves every permission with transferOwnership", async () => {
      const feed = await deploy();
      await feed.write.transferOwnership([nextOwner.account.address]);
      assert.equal(await feed.read.owner(), getAddress(nextOwner.account.address));

      await assert.rejects(feed.write.setGateway(["https://old.example"]));
      await assert.rejects(feed.write.setExternalUrl(["https://old.example"]));
      await assert.rejects(feed.write.setRoyalty([deployer.account.address, 0n]));

      const theirs = await as(feed, nextOwner);
      await theirs.write.setGateway(["https://next.example"]);
      await theirs.write.setExternalUrl(["https://next.example/live"]);
      await theirs.write.setRoyalty([nextOwner.account.address, 100n]);
      assert.equal(await feed.read.gateway(), "https://next.example");
      assert.equal(await feed.read.externalUrl(), "https://next.example/live");
      const [receiver, amount] = await feed.read.royaltyInfo([1n, 10_000n]);
      assert.equal(receiver, getAddress(nextOwner.account.address));
      assert.equal(amount, 100n);
    });

    it("rejects transferring ownership to the zero address", async () => {
      const feed = await deploy();
      await assert.rejects(
        feed.write.transferOwnership(["0x0000000000000000000000000000000000000000"]),
      );
    });
  });

  describe("gateway and external URL", () => {
    it("changes only the domain, leaving the CID path as it was", async () => {
      const feed = await deploy();
      const pathOf = (url: string) => url.slice(url.indexOf("/ipfs/"));
      const before = decode(await feed.read.tokenURI([1n]));
      await feed.write.setGateway(["https://new.example"]);
      const after = decode(await feed.read.tokenURI([1n]));
      assert.ok(after.image.startsWith("https://new.example/ipfs/"));
      assert.equal(pathOf(after.image), pathOf(before.image));
      assert.equal(pathOf(after.animation_url), pathOf(before.animation_url));
      assert.deepEqual(after.attributes, before.attributes);
      assert.equal(after.description, before.description);
    });

    it("emits refresh events", async () => {
      const feed = await deploy();
      const publicClient = await viem.getPublicClient();
      await feed.write.setGateway(["https://new.example"]);
      const metadata = await publicClient.getContractEvents({
        abi: feed.abi, address: feed.address, eventName: "MetadataUpdate", fromBlock: 0n,
      });
      const collection = await publicClient.getContractEvents({
        abi: feed.abi, address: feed.address, eventName: "ContractURIUpdated", fromBlock: 0n,
      });
      assert.equal(metadata.length, 1);
      assert.equal(metadata[0].args._tokenId, 1n);
      assert.equal(collection.length, 1);
    });
  });

  describe("royalties", () => {
    it("starts at 5% to the deployer", async () => {
      const feed = await deploy();
      const [receiver, amount] = await feed.read.royaltyInfo([1n, 10_000n]);
      assert.equal(receiver, getAddress(deployer.account.address));
      assert.equal(amount, 500n);
    });

    it("lets the owner move the receiver without the owner changing", async () => {
      const feed = await deploy();
      await feed.write.setRoyalty([stranger.account.address, 500n]);
      const [receiver] = await feed.read.royaltyInfo([1n, 10_000n]);
      assert.equal(receiver, getAddress(stranger.account.address));
      assert.equal(await feed.read.owner(), getAddress(deployer.account.address));
    });

    it("rejects more than 100%, and the zero address as receiver", async () => {
      const feed = await deploy();
      await assert.rejects(feed.write.setRoyalty([deployer.account.address, 10_001n]));
      await assert.rejects(
        feed.write.setRoyalty(["0x0000000000000000000000000000000000000000", 500n]),
      );
    });
  });

  describe("token transfers", () => {
    it("stays freely transferable", async () => {
      const feed = await sold();
      await (await as(feed, collector)).write.transferFrom([
        collector.account.address, stranger.account.address, 1n,
      ]);
      assert.equal(await feed.read.ownerOf([1n]), getAddress(stranger.account.address));
    });
  });

  describe("interfaces", () => {
    for (const [name, id] of [
      ["ERC-165", "0x01ffc9a7"],
      ["ERC-721", "0x80ac58cd"],
      ["ERC-721 Metadata", "0x5b5e139f"],
      ["ERC-2981", "0x2a55205a"],
      ["ERC-4906", "0x49064906"],
    ] as const) {
      it(`reports ${name}`, async () => {
        const feed = await deploy();
        assert.equal(await feed.read.supportsInterface([id]), true);
      });
    }
    it("does not report an unknown interface", async () => {
      const feed = await deploy();
      assert.equal(await feed.read.supportsInterface(["0xffffffff"]), false);
    });
  });
});
