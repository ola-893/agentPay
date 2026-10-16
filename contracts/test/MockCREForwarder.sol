// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Local test fixture, never a production forwarder.
contract MockCREForwarder {
    function deliver(address receiver, bytes calldata metadata, bytes calldata report) external {
        (bool success, bytes memory reason) = receiver.call(abi.encodeWithSignature("onReport(bytes,bytes)", metadata, report));
        if (!success) assembly { revert(add(reason, 32), mload(reason)) }
    }
}
