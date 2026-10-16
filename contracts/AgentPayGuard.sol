// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice A CRE report consumer. The forwarder verifies DON signatures;
/// this contract verifies workflow identity, destination, expiry and replay.
contract AgentPayGuard {
    struct Decision {
        uint256 chainId;
        address receiver;
        bytes32 requestId;
        address agent;
        address recipient;
        address token;
        uint256 maxAmount;
        uint64 validUntil;
        bool approved;
    }

    address public immutable owner;
    address public immutable forwarder;
    bytes32 public immutable workflowId;
    address public settlement;
    mapping(bytes32 => bool) public reported;
    mapping(bytes32 => bool) public consumed;
    mapping(bytes32 => Decision) public decisions;

    event DecisionReceived(bytes32 indexed requestId, address indexed agent, bool approved, uint64 validUntil);
    event AuthorizationConsumed(bytes32 indexed requestId, uint256 amount);
    event SettlementConfigured(address indexed settlement);

    constructor(address trustedForwarder, bytes32 expectedWorkflowId) {
        require(trustedForwarder != address(0), "Zero forwarder");
        require(expectedWorkflowId != bytes32(0), "Zero workflow ID");
        owner = msg.sender;
        forwarder = trustedForwarder;
        workflowId = expectedWorkflowId;
    }

    function setSettlement(address target) external {
        require(msg.sender == owner, "Only owner");
        require(settlement == address(0) && target.code.length > 0, "Invalid settlement");
        settlement = target;
        emit SettlementConfigured(target);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == this.onReport.selector;
    }

    function onReport(bytes calldata metadata, bytes calldata report) external {
        require(msg.sender == forwarder, "Only forwarder");
        // Production KeystoneForwarder supplies 64 bytes; 62 is the packed identity.
        require(metadata.length == 62 || metadata.length == 64, "Invalid metadata");
        require(bytes32(metadata[:32]) == workflowId, "Wrong workflow");
        Decision memory d = abi.decode(report, (Decision));
        require(d.chainId == block.chainid && d.receiver == address(this), "Wrong destination");
        require(d.requestId != bytes32(0) && !reported[d.requestId], "Report replay");
        require(d.agent != address(0) && d.recipient != address(0) && d.token != address(0), "Zero party");
        require(d.validUntil > block.timestamp && d.validUntil <= block.timestamp + 1 hours, "Invalid expiry");
        require(!d.approved || d.maxAmount > 0, "Zero authorization");
        reported[d.requestId] = true;
        decisions[d.requestId] = d;
        emit DecisionReceived(d.requestId, d.agent, d.approved, d.validUntil);
    }

    function canPay(bytes32 requestId, address agent, address recipient, address token, uint256 amount) public view returns (bool) {
        Decision storage d = decisions[requestId];
        return d.approved && !consumed[requestId] && d.validUntil > block.timestamp
            && d.agent == agent && d.recipient == recipient && d.token == token
            && amount > 0 && amount <= d.maxAmount;
    }

    function consume(bytes32 requestId, address agent, address recipient, address token, uint256 amount) external {
        require(msg.sender == settlement, "Only settlement");
        require(canPay(requestId, agent, recipient, token, amount), "Payment not authorized");
        consumed[requestId] = true;
        emit AuthorizationConsumed(requestId, amount);
    }
}
