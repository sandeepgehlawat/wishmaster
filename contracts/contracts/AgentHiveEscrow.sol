// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// ERC-8004 Interfaces
interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        string calldata tag1,
        string calldata tag2,
        string calldata feedbackURI
    ) external;
}

interface IIdentityRegistry {
    function getAgentByWallet(address wallet) external view returns (uint256);
}

/**
 * @title AgentHiveEscrow
 * @notice Escrow contract for the AgentHive AI agent marketplace
 * @dev Handles USDC deposits, agent assignment, release, and refunds
 *      Integrated with ERC-8004 reputation system for automatic feedback
 */
contract AgentHiveEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    uint256 public platformFeeBps = 500; // 5% default (500 basis points)

    // ERC-8004 Registries
    IReputationRegistry public reputationRegistry;
    IIdentityRegistry public identityRegistry;

    enum EscrowStatus { Pending, Funded, Locked, Released, Refunded, Disputed }

    struct Escrow {
        bytes32 jobId;
        address client;
        address agent;
        uint256 amount;
        EscrowStatus status;
        uint256 createdAt;
    }

    mapping(bytes32 => Escrow) public escrows;

    // Events
    event EscrowCreated(bytes32 indexed jobId, address indexed client, uint256 amount);
    event EscrowFunded(bytes32 indexed jobId, uint256 amount);
    event EscrowLocked(bytes32 indexed jobId, address indexed agent, uint256 lockedAmount);
    event EscrowExcessRefunded(bytes32 indexed jobId, address indexed client, uint256 excessAmount);
    event EscrowReleased(bytes32 indexed jobId, address indexed agent, uint256 agentAmount, uint256 platformFee);
    event EscrowRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
    event EscrowDisputed(bytes32 indexed jobId);
    event DisputeResolved(bytes32 indexed jobId, bool releasedToAgent);
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    // Errors
    error EscrowAlreadyExists();
    error EscrowNotFound();
    error InvalidAmount();
    error InvalidAgent();
    error InvalidStatus();
    error Unauthorized();
    error FeeTooHigh();

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Client deposits USDC for a job
     * @param jobId Unique identifier for the job (derived from UUID)
     * @param amount Amount of USDC to deposit (in wei, 6 decimals)
     */
    function deposit(bytes32 jobId, uint256 amount) external nonReentrant {
        if (escrows[jobId].status != EscrowStatus.Pending) {
            revert EscrowAlreadyExists();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        escrows[jobId] = Escrow({
            jobId: jobId,
            client: msg.sender,
            agent: address(0),
            amount: amount,
            status: EscrowStatus.Funded,
            createdAt: block.timestamp
        });

        emit EscrowCreated(jobId, msg.sender, amount);
        emit EscrowFunded(jobId, amount);
    }

    /**
     * @notice Lock escrow to assigned agent with bid amount (refunds excess to client)
     * @param jobId Job identifier
     * @param agent Agent's wallet address
     * @param bidAmount The winning bid amount (excess is refunded to client)
     */
    function lockToAgent(bytes32 jobId, address agent, uint256 bidAmount) external nonReentrant {
        Escrow storage escrow = escrows[jobId];

        if (escrow.status != EscrowStatus.Funded) {
            revert InvalidStatus();
        }
        if (msg.sender != escrow.client && msg.sender != owner()) {
            revert Unauthorized();
        }
        if (agent == address(0)) {
            revert InvalidAgent();
        }
        if (bidAmount == 0 || bidAmount > escrow.amount) {
            revert InvalidAmount();
        }

        // Calculate excess and refund to client
        uint256 excess = escrow.amount - bidAmount;

        // Update escrow amount to bid amount
        escrow.amount = bidAmount;
        escrow.agent = agent;
        escrow.status = EscrowStatus.Locked;

        // Refund excess to client
        if (excess > 0) {
            usdc.safeTransfer(escrow.client, excess);
            emit EscrowExcessRefunded(jobId, escrow.client, excess);
        }

        emit EscrowLocked(jobId, agent, bidAmount);
    }

    /**
     * @notice Release funds to agent (client approves delivery)
     * @param jobId Job identifier
     */
    function release(bytes32 jobId) external nonReentrant {
        Escrow storage escrow = escrows[jobId];

        if (escrow.status != EscrowStatus.Locked) {
            revert InvalidStatus();
        }
        if (msg.sender != escrow.client && msg.sender != owner()) {
            revert Unauthorized();
        }

        uint256 platformFee = (escrow.amount * platformFeeBps) / 10000;
        uint256 agentAmount = escrow.amount - platformFee;

        escrow.status = EscrowStatus.Released;

        usdc.safeTransfer(escrow.agent, agentAmount);
        if (platformFee > 0) {
            usdc.safeTransfer(owner(), platformFee);
        }

        // Update agent reputation on successful release (ERC-8004)
        _updateReputation(escrow.agent, 100, "job_completed");

        emit EscrowReleased(jobId, escrow.agent, agentAmount, platformFee);
    }

    /**
     * @notice Refund to client (job cancelled before agent assignment or work not delivered)
     * @param jobId Job identifier
     */
    function refund(bytes32 jobId) external nonReentrant {
        Escrow storage escrow = escrows[jobId];

        if (escrow.status != EscrowStatus.Funded && escrow.status != EscrowStatus.Locked) {
            revert InvalidStatus();
        }
        if (msg.sender != escrow.client && msg.sender != owner()) {
            revert Unauthorized();
        }

        uint256 amount = escrow.amount;
        escrow.status = EscrowStatus.Refunded;

        usdc.safeTransfer(escrow.client, amount);

        emit EscrowRefunded(jobId, escrow.client, amount);
    }

    /**
     * @notice Mark escrow as disputed (requires arbitration)
     * @param jobId Job identifier
     */
    function dispute(bytes32 jobId) external {
        Escrow storage escrow = escrows[jobId];

        if (escrow.status != EscrowStatus.Locked) {
            revert InvalidStatus();
        }
        if (msg.sender != escrow.client && msg.sender != escrow.agent) {
            revert Unauthorized();
        }

        escrow.status = EscrowStatus.Disputed;
        emit EscrowDisputed(jobId);
    }

    /**
     * @notice Resolve dispute (owner only)
     * @param jobId Job identifier
     * @param releaseToAgent True to release to agent, false to refund client
     */
    function resolveDispute(bytes32 jobId, bool releaseToAgent) external onlyOwner nonReentrant {
        Escrow storage escrow = escrows[jobId];

        if (escrow.status != EscrowStatus.Disputed) {
            revert InvalidStatus();
        }

        if (releaseToAgent) {
            uint256 platformFee = (escrow.amount * platformFeeBps) / 10000;
            uint256 agentAmount = escrow.amount - platformFee;
            escrow.status = EscrowStatus.Released;

            usdc.safeTransfer(escrow.agent, agentAmount);
            if (platformFee > 0) {
                usdc.safeTransfer(owner(), platformFee);
            }

            // Positive reputation for agent winning dispute (ERC-8004)
            _updateReputation(escrow.agent, 50, "dispute_won");

            emit EscrowReleased(jobId, escrow.agent, agentAmount, platformFee);
        } else {
            escrow.status = EscrowStatus.Refunded;
            usdc.safeTransfer(escrow.client, escrow.amount);

            // Negative reputation for agent losing dispute (ERC-8004)
            _updateReputation(escrow.agent, -50, "dispute_lost");

            emit EscrowRefunded(jobId, escrow.client, escrow.amount);
        }

        emit DisputeResolved(jobId, releaseToAgent);
    }

    /**
     * @notice Update platform fee (owner only)
     * @param newFeeBps New fee in basis points (max 1000 = 10%)
     */
    function setFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) {
            revert FeeTooHigh();
        }

        uint256 oldFeeBps = platformFeeBps;
        platformFeeBps = newFeeBps;

        emit PlatformFeeUpdated(oldFeeBps, newFeeBps);
    }

    /**
     * @notice Set ERC-8004 registry addresses (owner only)
     * @param _identityRegistry Identity registry address
     * @param _reputationRegistry Reputation registry address
     */
    function setRegistries(address _identityRegistry, address _reputationRegistry) external onlyOwner {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
    }

    /**
     * @notice Internal helper to update agent reputation
     * @param agentWallet The agent's wallet address
     * @param value Feedback value (-100 to +100)
     * @param tag The feedback tag
     */
    function _updateReputation(address agentWallet, int128 value, string memory tag) internal {
        if (address(reputationRegistry) != address(0) && address(identityRegistry) != address(0)) {
            uint256 agentId = identityRegistry.getAgentByWallet(agentWallet);
            if (agentId > 0) {
                try reputationRegistry.giveFeedback(agentId, value, tag, "", "") {
                    // Feedback recorded successfully
                } catch {
                    // Silently fail - reputation update should not block payment
                }
            }
        }
    }

    /**
     * @notice Get escrow details
     * @param jobId Job identifier
     * @return Escrow struct with all details
     */
    function getEscrow(bytes32 jobId) external view returns (Escrow memory) {
        return escrows[jobId];
    }

    /**
     * @notice Check if an escrow exists and is in a specific status
     * @param jobId Job identifier
     * @param status Expected status
     * @return True if escrow exists and has the expected status
     */
    function hasStatus(bytes32 jobId, EscrowStatus status) external view returns (bool) {
        return escrows[jobId].status == status;
    }

    /**
     * @notice Get the total locked amount for a client
     * @param client Client's wallet address
     * @return Total amount locked in escrow
     */
    function getClientLockedAmount(address client) external view returns (uint256) {
        // Note: This is a simplified implementation. In production,
        // you might want to track this separately for gas efficiency.
        return 0; // Not tracked in this version
    }
}
