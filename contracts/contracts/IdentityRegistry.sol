// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title IdentityRegistry
 * @notice ERC-8004 compliant identity registry for AI agents
 * @dev ERC-721 NFT where each token represents an agent identity
 *
 * Key Features:
 * - Each agent gets a unique NFT identity
 * - Wallet can be different from NFT owner (for custodial setups)
 * - Metadata stored via agentURI (typically IPFS)
 * - On-chain metadata for critical fields
 */
contract IdentityRegistry is ERC721, ERC721URIStorage, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 private _nextAgentId = 1;

    // agentId => wallet address (can be different from NFT owner)
    mapping(uint256 => address) public agentWallets;

    // agentId => metadata key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    // wallet => agentId (reverse lookup)
    mapping(address => uint256) public walletToAgent;

    // Events (ERC-8004 compliant)
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event AgentWalletSet(uint256 indexed agentId, address indexed wallet);
    event MetadataUpdated(uint256 indexed agentId, string key);

    // Errors
    error NotAgentOwner();
    error InvalidSignature();
    error DeadlineExpired();
    error WalletAlreadyLinked();
    error AgentNotFound();

    constructor() ERC721("AgentHive Identity", "AHID") Ownable(msg.sender) {}

    /**
     * @notice Register a new agent identity
     * @param agentURI IPFS URI containing agent metadata (capabilities, pricing, etc.)
     * @return agentId The newly minted agent ID
     */
    function register(string calldata agentURI) external returns (uint256) {
        uint256 agentId = _nextAgentId++;

        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        // Default: owner wallet is also agent wallet
        agentWallets[agentId] = msg.sender;
        walletToAgent[msg.sender] = agentId;

        emit Registered(agentId, agentURI, msg.sender);
        return agentId;
    }

    /**
     * @notice Register a new agent identity with a specified wallet
     * @param agentURI IPFS URI containing agent metadata
     * @param wallet The wallet address to link (must be signed)
     * @param deadline Signature deadline timestamp
     * @param sig Signature from the wallet proving ownership
     * @return agentId The newly minted agent ID
     */
    function registerWithWallet(
        string calldata agentURI,
        address wallet,
        uint256 deadline,
        bytes calldata sig
    ) external returns (uint256) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (walletToAgent[wallet] != 0) revert WalletAlreadyLinked();

        // Verify wallet signed approval
        bytes32 messageHash = keccak256(abi.encodePacked(
            "Register AgentHive identity with wallet:",
            wallet,
            deadline,
            msg.sender
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(sig);

        if (signer != wallet) revert InvalidSignature();

        uint256 agentId = _nextAgentId++;

        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        // Set the specified wallet
        agentWallets[agentId] = wallet;
        walletToAgent[wallet] = agentId;

        emit Registered(agentId, agentURI, msg.sender);
        emit AgentWalletSet(agentId, wallet);
        return agentId;
    }

    /**
     * @notice Link a different wallet to this agent identity
     * @param agentId The agent ID
     * @param wallet The wallet address to link
     * @param deadline Signature deadline timestamp
     * @param sig Signature from the wallet proving ownership
     */
    function setAgentWallet(
        uint256 agentId,
        address wallet,
        uint256 deadline,
        bytes calldata sig
    ) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (walletToAgent[wallet] != 0) revert WalletAlreadyLinked();

        // Verify wallet signed approval
        bytes32 messageHash = keccak256(abi.encodePacked(
            "Link wallet to AgentHive agent:",
            agentId,
            wallet,
            deadline
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(sig);

        if (signer != wallet) revert InvalidSignature();

        // Unlink old wallet
        address oldWallet = agentWallets[agentId];
        if (oldWallet != address(0)) {
            walletToAgent[oldWallet] = 0;
        }

        // Link new wallet
        agentWallets[agentId] = wallet;
        walletToAgent[wallet] = agentId;

        emit AgentWalletSet(agentId, wallet);
    }

    /**
     * @notice Update the agent URI (metadata location)
     * @param agentId The agent ID
     * @param newURI The new IPFS URI
     */
    function updateAgentURI(uint256 agentId, string calldata newURI) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _setTokenURI(agentId, newURI);
    }

    /**
     * @notice Set metadata for an agent (stored on-chain)
     * @param agentId The agent ID
     * @param key Metadata key (e.g., "capabilities", "pricing")
     * @param value Metadata value (ABI encoded)
     */
    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();

        _metadata[agentId][key] = value;
        emit MetadataUpdated(agentId, key);
    }

    /**
     * @notice Get metadata for an agent
     * @param agentId The agent ID
     * @param key Metadata key
     * @return value The metadata value
     */
    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory) {
        return _metadata[agentId][key];
    }

    /**
     * @notice Get agent ID by wallet address
     * @param wallet The wallet address
     * @return agentId The agent ID (0 if not found)
     */
    function getAgentByWallet(address wallet) external view returns (uint256) {
        return walletToAgent[wallet];
    }

    /**
     * @notice Get wallet address by agent ID
     * @param agentId The agent ID
     * @return wallet The wallet address
     */
    function getWalletByAgent(uint256 agentId) external view returns (address) {
        return agentWallets[agentId];
    }

    /**
     * @notice Check if an agent exists
     * @param agentId The agent ID
     * @return exists True if agent exists
     */
    function agentExists(uint256 agentId) external view returns (bool) {
        return agentId > 0 && agentId < _nextAgentId;
    }

    /**
     * @notice Get total number of registered agents
     * @return count The number of agents
     */
    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }

    // Required overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
