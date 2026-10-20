# AgentPayStream

[Source](../../contracts/AgentPayStream.sol). Prepaid stream escrow using raw integer token units. The AI CLI uses a separate [Circle USDC deployment](../deployment/usdc-stream.json), while the retained UI and legacy SDK use 18-decimal MockUSD/tUSD. [Deployment](../../DEPLOYMENT.md).

## Constructor and reads

`constructor(address paymentToken)` requires a nonzero token address. `paymentToken()` returns the configured token. `streams(id)` returns sender, recipient, totalAmount, flowRate, startTime, stopTime, amountWithdrawn, isActive and metadata. IDs begin at 1.

## createStream

```solidity
function createStream(address recipient, uint256 duration, uint256 amount, string calldata metadata) external
```

Amount is raw token units; duration is whole seconds. The contract requires a nonzero recipient, positive amount/duration and nonzero integer `floor(amount / duration)`. The sender must have sufficient tokens and allowance. It transfers amount into escrow and emits `StreamCreated`.

```ts
// Supply deployed contracts and an authorized connected signer.
const amount = ethers.parseEther('10'); // 10 tUSD, NOT USDC
await (await token.approve(streamAddress, amount)).wait();
await (await stream.createStream(recipient, 3600, amount, '{}')).wait();
```

The contract accepts a string; JSON validity of metadata is not enforced. Do not store private information in public metadata.

## getClaimableBalance and withdrawFromStream

`getClaimableBalance(id)` requires an active stream. Before start it returns zero; during streaming it returns elapsed whole seconds × flowRate minus previous withdrawals. At/after stop it returns **totalAmount - amountWithdrawn**, including division remainder.

`withdrawFromStream(id)` requires the recipient caller, active stream and positive claimable balance. It updates withdrawn accounting, transfers funds and emits `Withdrawn`. An ended stream remains active until closed, so its remaining funds can still be withdrawn. `isStreamActive(id)` reports the stored active flag; it is not a check that time remains for API service access.

## cancelStream

Either sender or recipient can cancel an active stream. The contract sets inactive, sends accrued claimable funds to the recipient, refunds the unspent balance to the sender, and emits `StreamCancelled`. The frontend labels this **Close stream**. A closed stream cannot be withdrawn again.

There is no top-up, pause, resume or extension method. To continue service, open a new stream. No audited security or gas-cost guarantee is made. [Accounting/UI](../architecture/payment-streams.md) and [events/errors](events-errors.md).
