# AgentPay — short demo narration

291 words. Target 90–120 seconds.

## ch00 — Fund once. Keep working.

An agent making a thousand paid API calls should not need a thousand payment transactions. AgentPay pairs reusable streams with deterministic payment guardrails from Chainlink C R E.

## ch01 — Streaming payments

Fund one session, then reuse it across paid requests. The agent already has intelligence, but hallucinated payment instructions can waste money. Deterministic C R E rules guard the payment commitment, while the session stays reusable.

## ch02 — Why CRE

Chainlink C R E brings external APIs and blockchain state into one workflow. It compares Coinbase and Chainlink U S D C prices, checks service health, and reads balances and stream state. Fixed budget, rate and session checks produce OPEN, CONTINUE, CLOSE, or DENY. A separate policy signer approves eligible actions. The contract verifies that signature before funding or closure.

## ch03 — Real workflow execution

Here is the actual workflow source: an external H T T P fetch, followed by a Sepolia contract read. The contract checks the separate signer, exact intent, nonce and expiry. Unsigned and agent-forged approvals revert.

## ch04 — Watch the stream work

This prompted demo tries a basic session and a premium request. A signed OPEN funds the stream. Ten successful API requests reuse that session. The healthy checkpoint returns CONTINUE. Then we inject an outage. C R E returns CLOSE. The contract accepts the signed closure.

## ch05 — Settlement you can verify

Cancellation pays accrued earnings to the provider and returns the unused deposit to the agent. Receipts verify both consumed approvals and the recipient balance increase. The C L I also anchors decision records with onchain audit receipts.

## ch06 — Budget stays in control

Next, the premium request exceeds the spending cap. C R E returns DENY. No funding approval is issued, and the premium session stays closed.

## ch07 — Build with AgentPay

One funded stream. Reusable service access. Deterministic guardrails against avoidable spending. AgentPay: payment guardrails, built with Chainlink C R E. Explore the code and run the demo.
