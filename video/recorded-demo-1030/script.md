# AgentPay — recorded demo narration

Exactly 120 seconds; the edit list maps each shot back to 1030.mp4.

0:00 — Fund once. Reuse.
A thousand paid API calls shouldn't mean a thousand payment transactions. AgentPay funds one stream and reuses it across requests.

0:12 — Intelligence needs guardrails
But agents can hallucinate: keep paying a broken service, or close a useful stream too early. Their money needs deterministic guardrails.

0:23 — Chainlink CRE
Chainlink CRE turns live data into deterministic payment decisions.

0:30 — Check before you commit.
Here, CRE runs locally. It compares Chainlink and Coinbase USDC prices, checks freshness and price bounds, then checks service health, the deposit, and the stream rate. Decision: OPEN.

0:45 — Dry-run. Risk-score. Record.
Before signing, the proposed spend is dry-run and risk-scored. Decisions are stored as durable blobs, with hashes anchored onchain.

0:59 — Approved. Verified. Funded.
A separate policy signer approves OPEN. The escrow verifies that signature, then accepts one cent of USDC.

1:10 — One stream. Ten calls.
Ten API calls reuse the same stream, with no payment transaction per request. CRE returns CONTINUE; the provider earns by the second.

1:21 — Service fails. Rules respond.
Now, three service failures. CRE applies the failure threshold and returns CLOSE, protecting the remaining deposit.

1:30 — Close. Settle. Refund.
The contract verifies the CLOSE approval. Cancellation pays the provider's accrued earnings and refunds the unused balance.

1:41 — Over budget? Blocked.
A premium request exceeds the spending cap. CRE returns DENY. No purchase is signed, and the blocked decision gets its own audit receipt.

1:52 — Fund once. Reuse safely.
AgentPay. Fund once. Reuse safely. Deterministic Chainlink CRE guardrails, with decisions you can trace.
