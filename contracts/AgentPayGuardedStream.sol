// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./AgentPayStream.sol";

/// @notice Local-policy-signed stream escrow. This verifies an operator policy
/// signature, not Chainlink DON execution. Agent, policy and recovery keys differ.
contract AgentPayGuardedStream {
    struct Stream {
        address sender;
        address recipient;
        uint256 totalAmount;
        uint256 flowRate;
        uint256 startTime;
        uint256 stopTime;
        uint256 amountWithdrawn;
        bool isActive;
        string metadata;
    }
    struct Permit {
        uint8 action; // 1 OPEN, 2 CLOSE
        address agent;
        address recipient;
        uint256 amount;
        uint256 duration;
        bytes32 metadataHash;
        bytes32 sessionId;
        uint256 streamId;
        uint256 nonce;
        uint64 deadline;
        bytes32 decisionHash;
    }
    IERC20 public paymentToken;
    address public agent;
    address public policySigner;
    address public recoveryOwner;
    uint256 public nextNonce;
    uint256 public activeStreamId;
    uint256 private nextStreamId = 1;
    uint256 private entered;
    uint256 public constant MAX_DEPOSIT = 10000; // 0.01 six-decimal USDC
    uint256 public constant MAX_RATE = 100;
    bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(uint8 action,address agent,address recipient,uint256 amount,uint256 duration,bytes32 metadataHash,bytes32 sessionId,uint256 streamId,uint256 nonce,uint64 deadline,bytes32 decisionHash)");
    mapping(uint256 => Stream) public streams;
    mapping(uint256 => bytes32) public streamSessions;
    mapping(bytes32 => bool) public usedSessions;
    event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, uint256 totalAmount, uint256 startTime, uint256 stopTime, string metadata);
    event Withdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event StreamCancelled(uint256 indexed streamId, address sender, address recipient, uint256 senderBalance, uint256 recipientBalance);
    event PolicyApprovalConsumed(uint256 indexed nonce, uint8 action, uint256 indexed streamId, bytes32 decisionHash);
    event RecoveryClosed(uint256 indexed streamId, address indexed owner);

    constructor(address token, address payer, address signer, address recovery) {
        require(token.code.length > 0, "Token required");
        require(payer != address(0) && signer != address(0) && recovery != address(0), "Zero authority");
        require(payer != signer && payer != recovery && signer != recovery, "Separate authorities required");
        paymentToken = IERC20(token);
        agent = payer;
        policySigner = signer;
        recoveryOwner = recovery;
    }
    modifier nonReentrant() {
        require(entered == 0, "Reentrancy");
        entered = 1;
        _;
        entered = 0;
    }
    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("AgentPayGuardedStream"), keccak256("1"), block.chainid, address(this)
        ));
    }
    function permitDigest(Permit calldata p) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), keccak256(abi.encode(PERMIT_TYPEHASH, p))));
    }
    function _consume(Permit calldata p, bytes calldata signature) private {
        require(msg.sender == agent && p.agent == agent, "Only agent");
        require(p.nonce == nextNonce, "Invalid nonce");
        require(p.deadline > block.timestamp && p.deadline <= block.timestamp + 600, "Invalid expiry");
        require(p.decisionHash != bytes32(0), "Decision required");
        require(signature.length == 65, "Invalid signature");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        require(uint256(s) <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0 && (v == 27 || v == 28), "Invalid signature");
        require(ecrecover(permitDigest(p), v, r, s) == policySigner, "Invalid policy signer");
        nextNonce++;
    }
    // Preserve the old selectors as explicit failures; no unsigned funding/close path.
    function createStream(address, uint256, uint256, string calldata) external pure { revert("Policy approval required"); }
    function cancelStream(uint256) external pure { revert("Policy approval required"); }

    function createStreamWithPermit(Permit calldata p, string calldata metadata, bytes calldata signature) external nonReentrant {
        require(p.action == 1 && p.streamId == 0, "OPEN required");
        require(activeStreamId == 0, "Active stream exists");
        require(p.sessionId != bytes32(0) && !usedSessions[p.sessionId], "Session already funded");
        require(p.recipient != address(0) && p.recipient != agent && p.recipient != address(this) && p.recipient != address(paymentToken), "Invalid recipient");
        require(p.amount > 0 && p.amount <= MAX_DEPOSIT, "Deposit cap");
        require(p.duration > 0 && p.duration <= 3600 && p.amount / p.duration > 0 && p.amount / p.duration <= MAX_RATE, "Invalid rate or duration");
        require(keccak256(bytes(metadata)) == p.metadataHash, "Metadata mismatch");
        _consume(p, signature);
        usedSessions[p.sessionId] = true;
        uint256 streamId = nextStreamId++;
        activeStreamId = streamId;
        streamSessions[streamId] = p.sessionId;
        streams[streamId] = Stream(agent, p.recipient, p.amount, p.amount / p.duration, block.timestamp, block.timestamp + p.duration, 0, true, metadata);
        require(paymentToken.transferFrom(agent, address(this), p.amount), "Deposit transfer failed");
        emit StreamCreated(streamId, agent, p.recipient, p.amount, block.timestamp, block.timestamp + p.duration, metadata);
        emit PolicyApprovalConsumed(p.nonce, p.action, streamId, p.decisionHash);
    }
    function cancelStreamWithPermit(Permit calldata p, bytes calldata signature) external nonReentrant {
        Stream storage s = streams[p.streamId];
        require(p.action == 2 && s.isActive, "Active CLOSE required");
        require(p.recipient == s.recipient && p.amount == s.totalAmount && p.duration == s.stopTime - s.startTime && p.metadataHash == keccak256(bytes(s.metadata)) && p.sessionId == streamSessions[p.streamId], "Stream intent mismatch");
        _consume(p, signature);
        _cancel(p.streamId);
        emit PolicyApprovalConsumed(p.nonce, p.action, p.streamId, p.decisionHash);
    }
    /// @notice Operator escape hatch, unavailable to the agent and policy keys.
    function recoveryClose(uint256 streamId) external nonReentrant {
        require(msg.sender == recoveryOwner, "Only recovery owner");
        _cancel(streamId);
        emit RecoveryClosed(streamId, msg.sender);
    }
    function getClaimableBalance(uint256 streamId) public view returns (uint256) {
        Stream storage s = streams[streamId];
        require(s.isActive, "Stream is not active");
        if (block.timestamp >= s.stopTime) return s.totalAmount - s.amountWithdrawn;
        return (block.timestamp - s.startTime) * s.flowRate - s.amountWithdrawn;
    }
    function withdrawFromStream(uint256 streamId) external nonReentrant {
        Stream storage s = streams[streamId];
        require(msg.sender == s.recipient, "Only recipient");
        uint256 amount = getClaimableBalance(streamId);
        require(amount > 0, "No earnings");
        s.amountWithdrawn += amount;
        require(paymentToken.transfer(s.recipient, amount), "Withdrawal failed");
        emit Withdrawn(streamId, s.recipient, amount);
    }
    function _cancel(uint256 streamId) private {
        Stream storage s = streams[streamId];
        require(s.isActive, "Stream is not active");
        uint256 earned = getClaimableBalance(streamId);
        uint256 refund = s.totalAmount - s.amountWithdrawn - earned;
        s.isActive = false;
        activeStreamId = 0;
        if (earned > 0) require(paymentToken.transfer(s.recipient, earned), "Payout failed");
        if (refund > 0) require(paymentToken.transfer(s.sender, refund), "Refund failed");
        emit StreamCancelled(streamId, s.sender, s.recipient, refund, earned);
    }
    function isStreamActive(uint256 streamId) external view returns (bool) { return streams[streamId].isActive; }
}
