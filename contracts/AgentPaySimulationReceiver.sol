// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice TESTNET DEMO ONLY. Records reports delivered by CRE's mock forwarder.
/// Mock delivery does not authenticate workflow identity or DON signatures.
/// This contract deliberately has no consume/canPay API and cannot settle funds.
contract AgentPaySimulationReceiver {
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
    bool public constant simulationOnly = true;
    address public immutable forwarder;
    bool public immutable skipWorkflowIdentity;
    mapping(bytes32 => bool) public recorded;
    mapping(bytes32 => Decision) public decisions;

    event SimulationReportRecorded(bytes32 indexed requestId, bool approved, uint64 validUntil, bytes32 reportHash);

    constructor(address mockForwarder, bool explicitlySkipWorkflowIdentity) {
        require(block.chainid == 11155111 || block.chainid == 31337, "Testnet demo only");
        require(mockForwarder.code.length > 0, "Forwarder must be a contract");
        require(explicitlySkipWorkflowIdentity, "Explicit demo opt-in required");
        forwarder = mockForwarder;
        skipWorkflowIdentity = true;
    }
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == this.onReport.selector;
    }
    function onReport(bytes calldata, bytes calldata report) external {
        require(msg.sender == forwarder, "Only mock forwarder");
        Decision memory d = abi.decode(report, (Decision));
        require(d.chainId == block.chainid && d.receiver == address(this), "Wrong destination");
        require(d.requestId != bytes32(0) && !recorded[d.requestId], "Report replay");
        require(d.agent != address(0) && d.recipient != address(0) && d.token != address(0), "Zero party");
        require(d.validUntil > block.timestamp && d.validUntil <= block.timestamp + 1 hours, "Invalid expiry");
        require(!d.approved || d.maxAmount > 0, "Zero authorization");
        recorded[d.requestId] = true;
        decisions[d.requestId] = d;
        emit SimulationReportRecorded(d.requestId, d.approved, d.validUntil, keccak256(report));
    }
}
