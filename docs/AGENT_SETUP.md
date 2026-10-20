# Agent setup in the frontend

Open **Agent setup** (`/agent`) in the frontend. No wallet connection, private key, deployed contract lookup or external API is used by this page.

## Create a draft

1. Enter a draft name.
2. Enter nonzero Ethereum addresses for your deployed production guard, settlement and payment recipient.
3. Enter a positive USDC amount with up to six decimals.
4. Copy the generated SDK example or choose **Save local draft**.
5. Reload to restore the saved draft; **Reset** removes it.

Validation checks address format and a positive uint256 token amount. It does not verify deployment bytecode, contract identity, the settlement-to-guard relationship or report acceptance. The guarded SDK performs chain/binding/authorization checks when used with a signer.

For example, `0.01` USDC generates `10000n` raw units in the `client.pay` call. There are no 18-decimal conversions in this USDC example. Save the fragment inside `sdk/` so `./src` and the signer’s ethers import resolve the same installed dependency; supply `signer` and `requestId` and put the awaited call inside an async function. [Guarded SDK reference](sdk/guarded-payment-client.md).

## Persistence and scope

The draft is versioned JSON under `agentpay:guarded-agent-draft:v1` in browser local storage. It contains name, guard, settlement, recipient and amount. Browser data can be blocked or cleared; saving is optional and code can still be copied. Other code on the same origin can access local storage. Do not enter secrets.

Saving does **not**:

- deploy/start an agent or connect a signer;
- change CRE config, request IDs, spending caps or onchain contracts;
- provision an API key or live telemetry;
- pause or resume deployed workflows;
- approve tokens or send a payment.

The earlier illustrative agent controls were replaced with this actual local draft flow. The generated GuardedPaymentClient integration requires an ethers signer, configured strict guard/settlement, and a fresh authenticated report accepted for the exact intent. The current public strict guard remains closed; this integration is not the local simulation payment path. [Deployment](../DEPLOYMENT.md).

To run a real model-driven purchasing agent now, use the separate [AI CLI demo](AI_AGENT_DEMO.md): `npm run demo:agent` previews both decisions; `npm run demo:agent -- --pay` can escrow 0.01 Circle test USDC in AgentPayStream, reuse the stream and verify cancellation earnings/refund. It uses wallet-side enforcement and authenticated stream access, without deploying a workflow to Chainlink. It does not use this browser draft.
