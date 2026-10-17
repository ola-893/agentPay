# GuardedPaymentClient

[Source](../../sdk/src/GuardedPaymentClient.ts). Use this client for CRE-controlled USDC payments, separately from legacy streaming. The repository contains source and `npm run build:sdk` builds `sdk/dist`; no published npm package is assumed.

## Constructor

```text
new GuardedPaymentClient(signer, {
  guardAddress,
  settlementAddress,
  chainId: 11155111,
});
```

`signer` is an ethers signer connected to a provider. Configuration validates nonzero EVM guard/settlement addresses and a positive safe-integer chain ID. The supported application configuration is Ethereum Sepolia.

## pay

```text
pay(
  requestId: string,
  recipient: string,
  token: string,
  amount: bigint
): Promise<ContractTransactionReceipt>
```

| Argument | Requirement |
| --- | --- |
| `requestId` | Nonzero 32-byte hex ID matching a fresh accepted report |
| `recipient`, `token` | Nonzero valid EVM addresses, matching the authorized parties/asset |
| `amount` | Positive uint256 raw units at or below the report’s maximum, not a human decimal amount |

For Circle Sepolia USDC, `0.01 = 10000n`; use `parseUnits('0.01', 6)` for user input, never `parseEther`.

```ts
// Example TypeScript entry point inside sdk/.
import { GuardedPaymentClient } from './src';
import { Wallet, JsonRpcProvider, parseUnits } from 'ethers';

// Supply a dedicated test privateKey/rpcUrl and your deployed addresses.
// This is server-side code; never put a private key in the frontend.
const signer = new Wallet(privateKey, new JsonRpcProvider(rpcUrl));
const client = new GuardedPaymentClient(signer, {
  guardAddress, settlementAddress, chainId: 11155111,
});
// Run only AFTER the authenticated workflow report is accepted onchain.
const receipt = await client.pay(
  requestId,
  recipient,
  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  parseUnits('0.01', 6),
);
console.log(receipt.hash);
```

Save the fragment as `sdk/integration.ts` and place awaited calls inside your async agent function. Import `Wallet`/`JsonRpcProvider` from `ethers` there so signer and SDK resolve the same installed dependency. Root-level signer imports currently resolve a separate ethers installation and can fail TypeScript checks. If TypeScript reports incompatible `Network`/`Signer` private fields, align or deduplicate ethers dependencies rather than casting away the error. The symbols `privateKey`, `rpcUrl`, deployed addresses, `recipient` and `requestId` must be supplied; the snippet is an integration template, not a deployment script. [Frontend draft generator](../AGENT_SETUP.md).

## Execution order

1. Validate intent and connected provider; verify chain ID.
2. Read `settlement.guard()` and compare it to configured guard.
3. Read `guard.canPay(requestId, signerAddress, recipient, token, amount)` before approval.
4. Approve the settlement contract only if current allowance is insufficient; wait for approval confirmation.
5. Check authorization again, then call `settle` and require receipt status 1.

The contract makes the final atomic authorization/transfer check. The report amount is a maximum: one smaller positive payment is permitted, but consumes the whole request; unused headroom cannot fund another settlement. No frontend capture or raw report body is treated as authority. Approval can still consume gas if authorization expires while waiting; a second check prevents proceeding to settlement. A failed payment does not make the old authorization fresh again.

The client does not trigger CRE, generate request IDs, publish reports or grant API access. The current legacy gateway does not consume guarded settlement receipts. [Trust boundaries](../contracts/guarded-settlement.md) and [deployment](../../DEPLOYMENT.md).
