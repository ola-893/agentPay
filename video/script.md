# AgentPay — short demo narration

284 words. Target 90–120 seconds.

## ch00 — Fund once. Keep working.

An agent making a thousand paid API calls should not need a thousand payment transactions. AgentPay combines payment streams with Chainlink C R E to keep agents working within budget.

## ch01 — Streaming payments

Fund one session, then reuse it across paid requests. The stream accrues payment over time while the agent uses the service. C R E adds the intelligence: when to start, keep paying, or close.

## ch02 — Why CRE

Chainlink C R E brings external APIs and blockchain state into one workflow. It compares Coinbase and Chainlink U S D C prices, checks service health, and reads balances and stream state. Budget and rate checks turn those observations into OPEN, CONTINUE, CLOSE, or DENY. The wallet applies the decision before signing.

## ch03 — Real workflow execution

Here is the actual workflow source: an external H T T P fetch, followed by a Sepolia contract read. The recorded simulator output shows the price observations and an ALLOW decision.

## ch04 — Watch the stream work

This prompted demo tries a basic session and a premium request. The wallet approves and opens the stream. Ten successful API requests reuse that session. The healthy checkpoint returns CONTINUE. Then we inject a provider outage. C R E returns CLOSE, and the wallet cancels the stream.

## ch05 — Settlement you can verify

Cancellation pays accrued earnings to the provider and returns the unused deposit to the agent. The transaction receipts and recipient balance increase verify the settlement. The C L I also anchors decision records with onchain audit receipts.

## ch06 — Budget stays in control

Next, the premium request exceeds the spending cap. C R E returns DENY before a new session opens, keeping that proposed spend inside the configured policy.

## ch07 — Build with AgentPay

One funded stream. Reusable service access. Decisions informed by real observations. AgentPay: streaming payments, orchestrated with Chainlink C R E. Explore the code and run the demo.
