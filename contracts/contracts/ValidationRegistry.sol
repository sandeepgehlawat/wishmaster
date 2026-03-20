// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
    function agentExists(uint256 agentId) external view returns (bool);
}

/**
 * @title ValidationRegistry
 * @notice ERC-8004 compliant validation registry for AI agents
 * @dev Handles validation requests and responses for agent capabilities
 *
 * Key Features:
 * - Validators can verify agent capabilities
 * - Validation requests with deadlines
 * - On-chain validation status tracking
 * - Approved validator management
 */
contract ValidationRegistry is Ownable {
    IIdentityRegistry public immutable identityRegistry;

    enum ValidationStatus { Pending, Approved, Rejected, Expired }

    struct ValidationRequest {
        address validator;
        uint256 agentId;
        string requestURI;      // IPFS URI with validation request details
        uint256 deadline;
        ValidationStatus status;
        string responseURI;     // IPFS URI with validation response details
        uint256 createdAt;
        uint256 respondedAt;
    }

    // requestHash => ValidationRequest
    mapping(bytes32 => ValidationRequest) public requests;

    // agentId => all request hashes
    mapping(uint256 => bytes32[]) public agentRequests;

    // validator => agentId => latest validation status
    mapping(address => mapping(uint256 => bool)) public validations;

    // Approved validators (verified by platform)
    mapping(address => bool) public approvedValidators;

    // Validator metadata
    mapping(address => string) public validatorNames;
    mapping(address => string) public validatorURIs;

    // Events (ERC-8004 compliant)
    event ValidationRequested(
        bytes32 indexed requestHash,
        address indexed validator,
        uint256 indexed agentId,
        string requestURI
    );
    event ValidationResponse(
        bytes32 indexed requestHash,
        uint8 response,
        string responseURI
    );
    event ValidatorApproved(address indexed validator, bool approved);
    event ValidatorMetadataUpdated(address indexed validator, string name, string uri);

    // Errors
    error NotValidator();
    error RequestNotFound();
    error RequestExpired();
    error AlreadyResponded();
    error NotAgentOwner();
    error AgentNotFound();

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    /**
     * @notice Request validation for an agent
     * @param validator The validator to request validation from
     * @param agentId The agent ID to validate
     * @param requestURI IPFS URI with validation request details
     * @return requestHash The request identifier
     */
    function validationRequest(
        address validator,
        uint256 agentId,
        string calldata requestURI
    ) external returns (bytes32) {
        // Only agent owner can request validation
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        if (!identityRegistry.agentExists(agentId)) revert AgentNotFound();

        bytes32 requestHash = keccak256(abi.encodePacked(
            validator,
            agentId,
            requestURI,
            block.timestamp,
            msg.sender
        ));

        requests[requestHash] = ValidationRequest({
            validator: validator,
            agentId: agentId,
            requestURI: requestURI,
            deadline: block.timestamp + 7 days,
            status: ValidationStatus.Pending,
            responseURI: "",
            createdAt: block.timestamp,
            respondedAt: 0
        });

        agentRequests[agentId].push(requestHash);

        emit ValidationRequested(requestHash, validator, agentId, requestURI);
        return requestHash;
    }

    /**
     * @notice Request validation with custom deadline
     * @param validator The validator to request validation from
     * @param agentId The agent ID to validate
     * @param requestURI IPFS URI with validation request details
     * @param deadline Custom deadline (must be in the future)
     * @return requestHash The request identifier
     */
    function validationRequestWithDeadline(
        address validator,
        uint256 agentId,
        string calldata requestURI,
        uint256 deadline
    ) external returns (bytes32) {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        if (!identityRegistry.agentExists(agentId)) revert AgentNotFound();
        require(deadline > block.timestamp, "Deadline must be in future");

        bytes32 requestHash = keccak256(abi.encodePacked(
            validator,
            agentId,
            requestURI,
            block.timestamp,
            msg.sender
        ));

        requests[requestHash] = ValidationRequest({
            validator: validator,
            agentId: agentId,
            requestURI: requestURI,
            deadline: deadline,
            status: ValidationStatus.Pending,
            responseURI: "",
            createdAt: block.timestamp,
            respondedAt: 0
        });

        agentRequests[agentId].push(requestHash);

        emit ValidationRequested(requestHash, validator, agentId, requestURI);
        return requestHash;
    }

    /**
     * @notice Respond to a validation request
     * @param requestHash The request identifier
     * @param response 1 = Approved, 2 = Rejected
     * @param responseURI IPFS URI with validation response details
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI
    ) external {
        ValidationRequest storage req = requests[requestHash];

        if (req.validator == address(0)) revert RequestNotFound();
        if (req.validator != msg.sender) revert NotValidator();
        if (block.timestamp > req.deadline) revert RequestExpired();
        if (req.status != ValidationStatus.Pending) revert AlreadyResponded();

        req.status = response == 1 ? ValidationStatus.Approved : ValidationStatus.Rejected;
        req.responseURI = responseURI;
        req.respondedAt = block.timestamp;

        // Update validation status
        if (response == 1) {
            validations[msg.sender][req.agentId] = true;
        }

        emit ValidationResponse(requestHash, response, responseURI);
    }

    /**
     * @notice Revoke a validation (validator only)
     * @param agentId The agent ID
     */
    function revokeValidation(uint256 agentId) external {
        validations[msg.sender][agentId] = false;
    }

    /**
     * @notice Check if agent is validated by a specific validator
     * @param validator The validator address
     * @param agentId The agent ID
     * @return isValid Whether the agent is validated
     */
    function isValidated(address validator, uint256 agentId) external view returns (bool) {
        return validations[validator][agentId];
    }

    /**
     * @notice Check if agent is validated by any approved validator
     * @param agentId The agent ID
     * @return isValid Whether the agent is validated by an approved validator
     */
    function isValidatedByApproved(uint256 agentId) external view returns (bool) {
        bytes32[] storage reqs = agentRequests[agentId];
        for (uint256 i = 0; i < reqs.length; i++) {
            ValidationRequest storage req = requests[reqs[i]];
            if (req.status == ValidationStatus.Approved && approvedValidators[req.validator]) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Get validation request details
     * @param requestHash The request identifier
     * @return request The validation request
     */
    function getRequest(bytes32 requestHash) external view returns (ValidationRequest memory) {
        return requests[requestHash];
    }

    /**
     * @notice Get all validation request hashes for an agent
     * @param agentId The agent ID
     * @return requestHashes Array of request hashes
     */
    function getAgentRequests(uint256 agentId) external view returns (bytes32[] memory) {
        return agentRequests[agentId];
    }

    /**
     * @notice Set approved validator status (owner only)
     * @param validator The validator address
     * @param approved Whether to approve or disapprove
     */
    function setApprovedValidator(address validator, bool approved) external onlyOwner {
        approvedValidators[validator] = approved;
        emit ValidatorApproved(validator, approved);
    }

    /**
     * @notice Set validator metadata
     * @param name Validator name
     * @param uri Validator metadata URI
     */
    function setValidatorMetadata(string calldata name, string calldata uri) external {
        validatorNames[msg.sender] = name;
        validatorURIs[msg.sender] = uri;
        emit ValidatorMetadataUpdated(msg.sender, name, uri);
    }

    /**
     * @notice Check if an address is an approved validator
     * @param validator The validator address
     * @return approved Whether the validator is approved
     */
    function isApprovedValidator(address validator) external view returns (bool) {
        return approvedValidators[validator];
    }
}
