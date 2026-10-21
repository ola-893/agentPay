// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Anchors local operator audit records. Does not authenticate CRE/DON
/// reports, enforce spending policy, or guarantee offchain blob availability.
contract AgentPayDecisionJournal {
    address public writer;
    uint256 public nextSequence = 1;
    struct Batch { uint256 firstSequence; uint256 count; uint256 timestamp; }
    mapping(bytes32 => Batch) public batches;
    event DecisionsAnchored(bytes32 indexed root, uint256 firstSequence, uint256 count);
    constructor() { writer = msg.sender; }
    function anchor(bytes32 root, uint256 firstSequence, uint256 count) external {
        require(msg.sender == writer, "Only writer");
        require(root != bytes32(0) && batches[root].count == 0, "Invalid root");
        require(count > 0 && count <= 256 && firstSequence == nextSequence, "Invalid sequence");
        batches[root] = Batch(firstSequence, count, block.timestamp);
        nextSequence += count;
        emit DecisionsAnchored(root, firstSequence, count);
    }
    function leaf(uint256 sequence, bytes32 intentId, bytes32 blobHash) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), writer, sequence, intentId, blobHash));
    }
    function verify(bytes32 root, bytes32 value, bytes32[] calldata proof) external view returns (bool) {
        if (batches[root].count == 0) return false;
        for (uint256 i; i < proof.length; ++i) {
            value = value < proof[i] ? keccak256(abi.encodePacked(value, proof[i])) : keccak256(abi.encodePacked(proof[i], value));
        }
        return value == root;
    }
}
