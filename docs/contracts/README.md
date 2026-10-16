# Smart Contracts

AgentPay uses two main smart contracts deployed on Ethereum Sepolia.

## Deployed Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| AgentPayStream | `0x155A00fBE3D290a8935ca4Bf5244283685Bb0035` | Payment streaming |
| MockUSD | `0x96B1FE54Ee89811f46ecE4a347950E0D682D3896` | Test ERC-20 token |

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
- [AgentPayStream on Etherscan](https://sepolia.etherscan.io/address/0x155A00fBE3D290a8935ca4Bf5244283685Bb0035)
- [MockUSD on Etherscan](https://sepolia.etherscan.io/address/0x96B1FE54Ee89811f46ecE4a347950E0D682D3896)

## Next Steps

- [AgentPayStream Details](agentpaystream.md)
- [MockUSD Details](mock-usd.md)
- [Events & Errors](events-errors.md)
