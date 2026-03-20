// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
    function agentWallets(uint256 agentId) external view returns (address);
    function getAgentByWallet(address wallet) external view returns (uint256);
    function agentExists(uint256 agentId) external view returns (bool);
}

/**
 * @title ReputationRegistry
 * @notice ERC-8004 compliant reputation registry for AI agents
 * @dev Stores and aggregates feedback for registered agents
 *
 * Key Features:
 * - Feedback on -100 to +100 scale
 * - Tag-based categorization (task types, skills)
 * - Efficient summary queries
 * - Authorized caller pattern for escrow integration
 */
contract ReputationRegistry is Ownable {
    IIdentityRegistry public immutable identityRegistry;

    struct Feedback {
        address client;
        int128 value;          // -100 to +100 scale
        string tag1;           // Primary tag (e.g., "job_completed")
        string tag2;           // Secondary tag (e.g., task type)
        string feedbackURI;    // IPFS URI for detailed feedback
        uint256 timestamp;
    }

    struct ReputationSummary {
        uint64 totalFeedbackCount;
        int128 cumulativeScore;
        int128 averageScore;
        uint256 lastUpdated;
    }

    // agentId => all feedback
    mapping(uint256 => Feedback[]) public feedbacks;

    // agentId => summary (cached for efficiency)
    mapping(uint256 => ReputationSummary) public summaries;

    // agentId => tag => cumulative score
    mapping(uint256 => mapping(string => int128)) public tagScores;

    // agentId => tag => count
    mapping(uint256 => mapping(string => uint64)) public tagCounts;

    // Authorized callers (escrow contracts)
    mapping(address => bool) public authorizedCallers;

    // Events (ERC-8004 compliant)
    event NewFeedback(
        uint256 indexed agentId,
        address indexed client,
        int128 value,
        string tag1,
        string tag2
    );
    event AuthorizedCallerSet(address indexed caller, bool authorized);

    // Errors
    error NotAuthorized();
    error InvalidValue();
    error AgentNotFound();

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    /**
     * @notice Give feedback to an agent
     * @param agentId The agent ID
     * @param value Score from -100 to +100
     * @param tag1 Primary category tag (e.g., "job_completed", "dispute_won")
     * @param tag2 Secondary category tag (e.g., task type like "coding", "research")
     * @param feedbackURI IPFS URI for detailed feedback (optional)
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        string calldata tag1,
        string calldata tag2,
        string calldata feedbackURI
    ) external {
        // Verify caller is authorized (escrow) or a valid client
        if (!authorizedCallers[msg.sender]) {
            // For non-authorized callers, verify they have an identity
            // This prevents spam feedback from random addresses
            uint256 callerId = identityRegistry.getAgentByWallet(msg.sender);
            // Allow if caller is a registered agent or has interacted with the system
            // For now, we allow any non-zero address - can add stricter checks later
        }

        // Validate inputs
        if (value < -100 || value > 100) revert InvalidValue();
        if (!identityRegistry.agentExists(agentId)) revert AgentNotFound();

        // Store feedback
        feedbacks[agentId].push(Feedback({
            client: msg.sender,
            value: value,
            tag1: tag1,
            tag2: tag2,
            feedbackURI: feedbackURI,
            timestamp: block.timestamp
        }));

        // Update summary (cached for gas efficiency)
        ReputationSummary storage summary = summaries[agentId];
        summary.totalFeedbackCount++;
        summary.cumulativeScore += value;
        summary.averageScore = summary.cumulativeScore / int128(int64(summary.totalFeedbackCount));
        summary.lastUpdated = block.timestamp;

        // Update tag scores
        if (bytes(tag1).length > 0) {
            tagScores[agentId][tag1] += value;
            tagCounts[agentId][tag1]++;
        }
        if (bytes(tag2).length > 0) {
            tagScores[agentId][tag2] += value;
            tagCounts[agentId][tag2]++;
        }

        emit NewFeedback(agentId, msg.sender, value, tag1, tag2);
    }

    /**
     * @notice Get reputation summary for an agent (no filters)
     * @param agentId The agent ID
     * @return count Number of feedbacks
     * @return summaryValue Average score
     * @return lastUpdated Last update timestamp
     */
    function getSimpleSummary(uint256 agentId) external view returns (
        uint64 count,
        int128 summaryValue,
        uint256 lastUpdated
    ) {
        ReputationSummary storage s = summaries[agentId];
        return (s.totalFeedbackCount, s.averageScore, s.lastUpdated);
    }

    /**
     * @notice Get filtered reputation summary for an agent
     * @param agentId The agent ID
     * @param clients Filter by specific clients (empty for all)
     * @param tag1 Filter by primary tag (empty for all)
     * @param tag2 Filter by secondary tag (empty for all)
     * @return count Number of matching feedbacks
     * @return summaryValue Average score
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clients,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue) {
        // Simple case: no filters, return cached summary
        if (clients.length == 0 && bytes(tag1).length == 0 && bytes(tag2).length == 0) {
            ReputationSummary storage s = summaries[agentId];
            return (s.totalFeedbackCount, s.averageScore);
        }

        // Filtered case: iterate through feedbacks
        Feedback[] storage agentFeedbacks = feedbacks[agentId];
        int128 total = 0;
        uint64 matchCount = 0;

        for (uint256 i = 0; i < agentFeedbacks.length; i++) {
            Feedback storage f = agentFeedbacks[i];

            // Check client filter
            bool clientMatch = clients.length == 0;
            for (uint256 j = 0; j < clients.length && !clientMatch; j++) {
                if (f.client == clients[j]) clientMatch = true;
            }
            if (!clientMatch) continue;

            // Check tag filters
            if (bytes(tag1).length > 0 && keccak256(bytes(f.tag1)) != keccak256(bytes(tag1))) continue;
            if (bytes(tag2).length > 0 && keccak256(bytes(f.tag2)) != keccak256(bytes(tag2))) continue;

            total += f.value;
            matchCount++;
        }

        if (matchCount == 0) return (0, 0);
        return (matchCount, total / int128(int64(matchCount)));
    }

    /**
     * @notice Get tag-specific reputation
     * @param agentId The agent ID
     * @param tag The tag to query
     * @return count Number of feedbacks with this tag
     * @return averageScore Average score for this tag
     */
    function getTagReputation(uint256 agentId, string calldata tag) external view returns (
        uint64 count,
        int128 averageScore
    ) {
        count = tagCounts[agentId][tag];
        if (count == 0) return (0, 0);
        averageScore = tagScores[agentId][tag] / int128(int64(count));
    }

    /**
     * @notice Get all feedback for an agent (paginated)
     * @param agentId The agent ID
     * @param offset Start index
     * @param limit Max items to return
     */
    function getFeedbacks(
        uint256 agentId,
        uint256 offset,
        uint256 limit
    ) external view returns (Feedback[] memory) {
        Feedback[] storage all = feedbacks[agentId];

        if (offset >= all.length) return new Feedback[](0);

        uint256 end = offset + limit;
        if (end > all.length) end = all.length;

        Feedback[] memory result = new Feedback[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = all[i];
        }

        return result;
    }

    /**
     * @notice Get feedback count for an agent
     * @param agentId The agent ID
     * @return count Total number of feedbacks
     */
    function getFeedbackCount(uint256 agentId) external view returns (uint256) {
        return feedbacks[agentId].length;
    }

    /**
     * @notice Set authorized caller (owner only)
     * @param caller The address to authorize/deauthorize
     * @param authorized Whether to authorize or deauthorize
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerSet(caller, authorized);
    }

    /**
     * @notice Check if an address is an authorized caller
     * @param caller The address to check
     * @return authorized Whether the address is authorized
     */
    function isAuthorizedCaller(address caller) external view returns (bool) {
        return authorizedCallers[caller];
    }
}
