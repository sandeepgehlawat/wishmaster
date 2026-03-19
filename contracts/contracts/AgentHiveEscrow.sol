// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentHiveEscrow
 * @notice Escrow contract for the AgentHive AI agent marketplace
 * @dev Handles USDC deposits, agent assignment, release, and refunds
 */
contract AgentHiveEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    uint256 public platformFeeBps = 500; // 5% default (500 basis points)

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
    event EscrowLocked(bytes32 indexed jobId, address indexed agent);
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
     * @notice Lock escrow to assigned agent (called by client or backend)
     * @param jobId Job identifier
     * @param agent Agent's wallet address
     */
    function lockToAgent(bytes32 jobId, address agent) external {
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

        escrow.agent = agent;
        escrow.status = EscrowStatus.Locked;

        emit EscrowLocked(jobId, agent);
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

            emit EscrowReleased(jobId, escrow.agent, agentAmount, platformFee);
        } else {
            escrow.status = EscrowStatus.Refunded;
            usdc.safeTransfer(escrow.client, escrow.amount);

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
