# FEED contract

ERC-721 contract for [FEED](https://github.com/ana0/feed) by Sarah Friend. It mints one token, and builds its JSON metadata on-chain.

The game lives in its own repo so that this contract can cite the game's final commit hash.

## What can change after deployment

One address can change these, using OpenZeppelin's `Ownable`:

- Media domain (`setGateway`), with no trailing slash
- `external_url` (`setExternalUrl`)
- Royalty receiver and percentage (`setRoyalty`)

That address is `owner()`. It starts as the deployer and moves with `transferOwnership`. Owning the token gives no permissions, and selling the token doesn't change the owner.

The royalty receiver is separate from the owner, so moving ownership doesn't redirect royalties. Call `setRoyalty` as well if they should move too.

Everything else is fixed: title, description, attributes, source commit, and media CIDs and filenames.

## Deploying

1. Push the game's final commit, then pin the image and video.
2. Fill in `SOURCE_COMMIT`, `IMAGE_PATH` and `VIDEO_PATH` in `contracts/Feed.sol`.
3. Run `npm test`, then `npm run preview`, and read `METADATA_PREVIEW.json`.
4. Store secrets in the encrypted keystore:

       npx hardhat keystore set DEPLOYER_PRIVATE_KEY
       npx hardhat keystore set SEPOLIA_RPC_URL
       npx hardhat keystore set MAINNET_RPC_URL
       npx hardhat keystore set ETHERSCAN_API_KEY

5. Rehearse with `npm run deploy:sepolia`.
6. Deploy with `npm run deploy:mainnet`. This runs `npm run preflight` first, and stops if placeholders remain, the commit isn't on GitHub, or a URL doesn't resolve.
7. Commit `ignition/deployments/chain-1/`, which records the address.
