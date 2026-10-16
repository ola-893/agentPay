// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPayGuard} from "./AgentPayGuard.sol";

/// @notice One CRE authorization buys one token payment. No funds are held here.
contract AgentPaySettlement {
    AgentPayGuard public immutable guard;
    bool private entered;
    event PaymentSettled(bytes32 indexed requestId, address indexed agent, address indexed recipient, address token, uint256 amount);

    constructor(address policyGuard) {
        require(policyGuard.code.length > 0, "Invalid guard");
        guard = AgentPayGuard(policyGuard);
    }

    function settle(bytes32 requestId, address recipient, address token, uint256 amount) external {
        require(!entered, "Reentrant payment");
        entered = true;
        guard.consume(requestId, msg.sender, recipient, token, amount);
        require(token.code.length > 0, "Invalid token");
        (bool success, bytes memory result) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, recipient, amount)
        );
        require(success && (result.length == 0 || abi.decode(result, (bool))), "Token transfer failed");
        emit PaymentSettled(requestId, msg.sender, recipient, token, amount);
        entered = false;
    }
}
