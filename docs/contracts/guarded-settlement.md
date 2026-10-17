# CRE consumer and settlement contracts

No public deployment of these AgentPay contracts is claimed by the saved simulation evidence. Deploy your own Sepolia contracts and workflow when following [deployment instructions](../../DEPLOYMENT.md). Circle's USDC and Chainlink's price feed are existing third-party deployments; they are not AgentPay consumer addresses.

## AgentPayGuard

[Source](../../contracts/AgentPayGuard.sol). The strict consumer:

- accepts only its immutable trusted forwarder;
- requires a nonzero configured workflow ID and matching packed identity metadata;
- validates chain ID, receiver destination, nonzero request/parties/token, a positive maximum amount for approved decisions and bounded expiry;
- rejects duplicate request reports and single-use authorization reuse;
- exposes `canPay` for the exact request tuple;
- permits `consume` only through its configured settlement contract.

With no workflow ID, reporting remains closed until the owner binds the deployed workflow. The consumer accepts the 62-byte packed identity form and the 64-byte forwarder form. The workflow configuration and owner remain trusted; the guard does not independently rerun the offchain oracle policy.

## AgentPaySettlement

[Source](../../contracts/AgentPaySettlement.sol). `settle(requestId, recipient, token, amount)` consumes the caller's matching authorization and transfers tokens from that caller to the recipient. The caller must approve the settlement contract. Payment amount must be positive and no greater than the report’s `maxAmount`; a smaller payment still consumes the entire single-use authorization. Reverts roll consumption back if the token transfer fails. Destination/party/amount/expiry checks and a reentrancy guard remain active. The settlement contract does not hold a pre-funded escrow or issue a new authorization.

## Isolated simulation receiver

[AgentPaySimulationReceiver](../../contracts/AgentPaySimulationReceiver.sol) is a different record-only consumer for the documented mock forwarder. An explicit constructor opt-in skips missing simulation workflow identity. It is restricted to Sepolia/local test chains and has no payment authorization/settlement API. Its event proves mock delivery, not production identity.

CRE may simulate `writeReport` without broadcasting. Only the host runner's successful verified RPC receipt and matching receiver event support a public publication claim. [Optional operator procedure](../RECORDING_READINESS.md).

## Relevant events

Read [events and errors](events-errors.md) and the contract ABI/source for exact event signatures and revert strings. [Guarded SDK](../sdk/guarded-payment-client.md) checks accepted onchain authority before approvals and again before settlement.
