# Smart Contracts

AgentPay uses two main smart contracts deployed on Ethereum Sepolia.

## Deployed Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| AgentPayStream | `YOUR_AGENTPAY_STREAM_ADDRESS` | Payment streaming |
| MockUSD | `YOUR_TEST_TOKEN_ADDRESS` | Test ERC-20 token |

## Contract Overview

### AgentPayStream

The core payment streaming contract that enables:
- Creating payment streams
- Withdrawing streamed funds
- Cancelling streams
- Querying stream state

### MockUSD

A test ERC-20 token for development:
- Standard ERC-20 interface
- Public mint function
- 18 decimals

## Verification

Contracts are verified on Sepolia Etherscan:
- [AgentPayStream on Etherscan](https://sepolia.etherscan.io/address/YOUR_AGENTPAY_STREAM_ADDRESS)
- [MockUSD on Etherscan](https://sepolia.etherscan.io/address/YOUR_TEST_TOKEN_ADDRESS)

## Next Steps

- [AgentPayStream Details](agentpaystream.md)
- [MockUSD Details](mock-usd.md)
- [Events & Errors](events-errors.md)
