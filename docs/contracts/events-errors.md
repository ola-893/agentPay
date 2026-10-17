# Events and errors

Source and compiled ABI are authoritative for exact event signatures. Amounts are **raw token units**, not native ETH wei; use six decimals for guarded USDC and eighteen for legacy tUSD.

## Guarded payment events

| Contract | Event |
| --- | --- |
| AgentPayGuard | `DecisionReceived(bytes32 indexed requestId, address indexed agent, bool approved, uint64 validUntil)` |
| AgentPayGuard | `AuthorizationConsumed(bytes32 indexed requestId, uint256 amount)` |
| AgentPayGuard | `SettlementConfigured(address indexed settlement)` |
| AgentPayGuard | `WorkflowConfigured(bytes32 indexed workflowId)` |
| AgentPaySettlement | `PaymentSettled(bytes32 indexed requestId, address indexed agent, address indexed recipient, address token, uint256 amount)` |
| AgentPaySimulationReceiver | `SimulationReportRecorded(bytes32 indexed requestId, bool approved, uint64 validUntil, bytes32 reportHash)` |

The simulation receiver event is not authenticated production authorization. An isolated demo runner must match the receipt's receiver/event/request/decision/expiry/report hash before presenting public delivery. [Consumer boundaries](guarded-settlement.md).

Common strict errors include `Only forwarder`, `Invalid metadata`, `Wrong workflow`, `Wrong destination`, `Report replay`, `Invalid expiry`, `Only settlement` and `Payment not authorized`. Fix the origin, deployed binding, exact intent or fresh request/report; do not disable strict validation. `Token transfer failed` reverts settlement and consumption atomically. [Guard source](../../contracts/AgentPayGuard.sol).

## Stream events

```solidity
event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient,
  uint256 totalAmount, uint256 startTime, uint256 stopTime, string metadata);
event Withdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
event StreamCancelled(uint256 indexed streamId, address sender, address recipient,
  uint256 senderBalance, uint256 recipientBalance);
```

| Stream error/suffix | Meaning |
| --- | --- |
| `Total amount must be greater than 0.` | Zero amount |
| `Recipient cannot be the zero address.` | Zero recipient |
| `Duration must be greater than 0.` | Zero duration |
| `flowRate would be zero. Increase amount or duration.` | Integer rate is zero; increase amount or **shorten** duration |
| `Transfer failed. check allowance` | Failed initial token transfer |
| `Stream is not active.` | Closed/cancelled or nonexistent; elapsed stop time alone does not clear active flag |
| `Caller is not the recipient.` | Withdrawal attempted by another wallet |
| `No funds to withdraw.` | Claimable amount is zero |
| `Stream already cancelled.` | Attempt to close inactive stream |
| `Caller cannot cancel this stream.` | Caller is neither sender nor recipient |

The exact errors have an `AgentPayStream: ` prefix. Token transfer can also revert with its own message. The source's zero-rate wording says “Increase amount or duration”; reducing duration is the useful direction for a fixed raw amount.

When querying events, use bounded RPC ranges and the actual deployed address. The current UI scans the last 49000 blocks, filters payment parties and reads current stream state; it is not a full-history indexer. [Stream source](../../contracts/AgentPayStream.sol).
