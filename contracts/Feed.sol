// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title FEED
/// @notice A single token for FEED, by Sarah Friend. All metadata JSON is built on-chain.
/// @dev The artwork record below is fixed at deployment. The contract owner can change the
///      gateway domain, the external URL, and the royalty receiver and percentage. The owner
///      starts as the deployer and can be moved with OpenZeppelin's transferOwnership.
contract Feed is ERC721, ERC2981, Ownable, IERC4906 {
    using Strings for string;

    // ---------------------------------------------------------------------
    // The artwork record. Permanent once deployed. These strings go into JSON
    // unescaped, so keep them plain ASCII and write line breaks as \\n.
    // ---------------------------------------------------------------------
    string private constant TITLE = "FEED";
    string private constant ARTIST = "Sarah Friend";
    string private constant YEAR = "2026";
    string private constant WORK_LICENSE = "CC BY-NC 4.0";
    string private constant SOURCE_REPOSITORY = "https://github.com/ana0/feed";

    /// The game repo's final commit.
    string private constant SOURCE_COMMIT = "9be8863dc8541e4014e8039c39566736bcdc79ec";

    /// Appended to <gateway>/ipfs/. Fill in as <cid>/<filename> after pinning.
    string private constant IMAGE_PATH = "PLACEHOLDER_IMAGE_CID/PLACEHOLDER_IMAGE_FILENAME";
    string private constant VIDEO_PATH = "PLACEHOLDER_VIDEO_CID/PLACEHOLDER_VIDEO_FILENAME";

    string private constant DESCRIPTION_INTRO =
        "FEED is an artwork by Sarah Friend commissioned for the Rhizome 30th Anniversary Fundraiser WEBSITES WEBSITES WEBSITES";
    string private constant DESCRIPTION_PLAY =
        "You are an infinitely-hungry monster trying to digest the entire Internet, one headless browser session at a time. "
        "Use WASD or the arrow keys to zoom around the screen as quickly as possible. Your goal is to eat everything before "
        "the time runs out and without landing on any CAPTCHAs, err, we mean bombs.";
    string private constant DESCRIPTION_CREDIT =
        "WEBSITES WEBSITES WEBSITES is a collaboration between ARTXCODE and Rhizome, and curated by LAN Party (Benna Kim and Benoit Tokyo).";
    string private constant DESCRIPTION_CLOSE =
        "Good luck, hungry wanderer. The Internet is vast and incompletely mapped. Your quest will be long, dangerous, maybe impossible. "
        "We must imagine Sisyphus happy. Bon appetit";

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------
    uint256 public constant TOKEN_ID = 1;

    /// @notice The domain media is served from, with no trailing slash.
    string public gateway;

    /// @notice Where the live work is.
    string public externalUrl;

    /// @dev ERC-7572: tells marketplaces to re-read contractURI.
    event ContractURIUpdated();

    constructor(string memory initialGateway, string memory initialExternalUrl, uint96 royaltyBps)
        ERC721(TITLE, TITLE)
        Ownable(msg.sender)
    {
        gateway = initialGateway;
        externalUrl = initialExternalUrl;
        _setDefaultRoyalty(msg.sender, royaltyBps);
        _mint(msg.sender, TOKEN_ID);
    }

    // ---------------------------------------------------------------------
    // The mutable parts
    // ---------------------------------------------------------------------

    /// @notice Moves media to a new domain, with no trailing slash. The CIDs and filenames stay fixed.
    function setGateway(string calldata newGateway) external onlyOwner {
        gateway = newGateway;
        emit MetadataUpdate(TOKEN_ID);
        emit ContractURIUpdated();
    }

    /// @notice Points external_url somewhere new.
    function setExternalUrl(string calldata newExternalUrl) external onlyOwner {
        externalUrl = newExternalUrl;
        emit MetadataUpdate(TOKEN_ID);
        emit ContractURIUpdated();
    }

    /// @notice Sets the royalty receiver and percentage, in basis points (500 = 5%).
    function setRoyalty(address receiver, uint96 royaltyBps) external onlyOwner {
        _setDefaultRoyalty(receiver, royaltyBps);
        emit ContractURIUpdated();
    }

    // ---------------------------------------------------------------------
    // Metadata
    // ---------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _dataUri(
            string.concat(
                '{"name":"', TITLE,
                '","created_by":"', ARTIST,
                '","description":"', _description(),
                '","image":"', _mediaUrl(IMAGE_PATH),
                '","animation_url":"', _mediaUrl(VIDEO_PATH),
                '","external_url":"', externalUrl.escapeJSON(),
                '","attributes":', _attributes(),
                "}"
            )
        );
    }

    /// @notice Collection-level metadata (ERC-7572).
    function contractURI() external view returns (string memory) {
        (address receiver, uint256 bps) = royaltyInfo(TOKEN_ID, _feeDenominator());
        return _dataUri(
            string.concat(
                '{"name":"', TITLE,
                '","description":"', DESCRIPTION_INTRO,
                '","image":"', _mediaUrl(IMAGE_PATH),
                '","external_link":"', externalUrl.escapeJSON(),
                '","seller_fee_basis_points":', Strings.toString(bps),
                ',"fee_recipient":"', Strings.toHexString(receiver),
                '"}'
            )
        );
    }

    function _description() private pure returns (string memory) {
        return string.concat(
            DESCRIPTION_INTRO, "\\n\\n", DESCRIPTION_PLAY, "\\n\\n", DESCRIPTION_CREDIT, "\\n\\n", DESCRIPTION_CLOSE
        );
    }

    function _attributes() private pure returns (string memory) {
        return string.concat(
            '[{"trait_type":"Artist","value":"', ARTIST,
            '"},{"trait_type":"Year","value":"', YEAR,
            '"},{"trait_type":"License","value":"', WORK_LICENSE,
            '"},{"trait_type":"Source repository","value":"', SOURCE_REPOSITORY,
            '"},{"trait_type":"Source commit","value":"', SOURCE_COMMIT,
            '"}]'
        );
    }

    function _mediaUrl(string memory path) private view returns (string memory) {
        return string.concat(gateway.escapeJSON(), "/ipfs/", path);
    }

    function _dataUri(string memory json) private pure returns (string memory) {
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981, IERC165) returns (bool) {
        return interfaceId == bytes4(0x49064906) || ERC721.supportsInterface(interfaceId)
            || ERC2981.supportsInterface(interfaceId);
    }
}
