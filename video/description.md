# AgentPay — fund once, keep working | Chainlink CRE demo

The agent proposes work. Chainlink CRE checks fixed payment rules. A separate policy signer approves eligible OPEN/CLOSE actions, and the escrow
contract verifies them before the agent can fund or close a stream. Fund one session and reuse it across paid API requests, with
deterministic guardrails against avoidable loss from hallucinated payment instructions.
CRE connects market observations, service health and onchain state to those rules.
Watch the recorded stream open, continue, close on an injected outage, settle
earnings and refund, then block an over-budget premium request.

0:00 Fund once. Keep working.
0:11 Streaming payments
0:24 Why CRE
0:47 Real workflow execution
1:00 Watch the stream work
1:17 Settlement you can verify
1:31 Budget stays in control
1:41 Build with AgentPay

Repository: https://github.com/ola-893/agentPay
Source and reproduction: https://github.com/ola-893/agentPay/tree/main/video
Recorded run: https://github.com/ola-893/agentPay/tree/main/vite-project/public/runs/20261025T173241Z-38db9e1a
RPC verification: https://github.com/ola-893/agentPay/blob/main/docs/evidence/guarded-stream/rpc-verification.json

Transactions:
- approval: https://sepolia.etherscan.io/tx/0xa61792bcacaa63bcd1db2f0b9f456c6c31f61226257df3b0fc6a39604d1e61a5
- open: https://sepolia.etherscan.io/tx/0x08b99ddbe6ddab388dae565832a944d00a8ff688895d4397dbe6414ef7c0db52
- close: https://sepolia.etherscan.io/tx/0x390a9ad36d17f242e8a8a50fbad23ca03859a13e85fac797c2890df1cd7d721d

Reproduce (after the README prerequisites):
```sh
npm run cre:simulate
npm run cre:simulate -- --deny-budget
npm run --silent demo:agent
# Requires the configured Sepolia wallet, gas, and test USDC:
npm run --silent demo:agent -- --pay
```

Demo context: recorded Sepolia run; CRE executes locally and the wallet CLI applies
its audit checks. A separate local policy process runs CRE and signs exact permits;
AgentPayGuardedStream verifies the registered signer, intent, nonce and expiry.
This authenticates an operator policy key, not Chainlink DON execution.
Current escrow: 0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09.
The agent is prompted to try basic and premium sessions.
The stream accrues with time. Onchain audit receipts are separate transactions.
The successful recording is dated October 25, 2026. A later retest failed CRE
authentication and required operator recovery; see https://github.com/ola-893/agentPay/blob/main/docs/evidence/guarded-retest/VERIFICATION.md.
The gate protects this escrow, not arbitrary transfers from the agent EOA.
Live runs need registered agent credentials and the separate operator policy key;
a clean checkout can replay the recording without keys.
Full architecture and execution evidence are linked above. Narration is synthetic.

Music: “Dreams Become Real” — Kevin MacLeod (incompetech.com).
Licensed under Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/
Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500027
Music trimmed, normalized and ducked under narration. Video/edit/narration are AgentPay's.

Built with Chainlink CRE.
