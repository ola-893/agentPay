# AgentPay — fund once, keep working | Chainlink CRE demo

Fund one session, reuse it across paid API requests, and let Chainlink CRE connect
market observations, service health and onchain state to payment decisions.
Watch the recorded stream open, continue, close on an injected outage, settle
earnings and refund, then block an over-budget premium request.

0:00 Fund once. Keep working.
0:11 Streaming payments
0:22 Why CRE
0:41 Real workflow execution
0:52 Watch the stream work
1:09 Settlement you can verify
1:24 Budget stays in control
1:34 Build with AgentPay

Repository: https://github.com/ola-893/agentPay
Source and reproduction: https://github.com/ola-893/agentPay/tree/main/video
Recorded run: https://github.com/ola-893/agentPay/tree/main/vite-project/public/runs/20261022T112249Z-556c7ea3
RPC verification: https://github.com/ola-893/agentPay/blob/main/docs/evidence/workflow-dashboard/rpc-verification.json

Transactions:
- approval: https://sepolia.etherscan.io/tx/0x4074848a94944027cc389b66fda70d24cbcf37709c199997892bb8d2d421a9a6
- open: https://sepolia.etherscan.io/tx/0x6881a00c7ee5779e80561d6f41ad507d4f7323ef1eac67106b71be1f74336597
- close: https://sepolia.etherscan.io/tx/0xcd74107ae1d786175a90d548c79c0fc50d60499d94aa2e0f1c0a3245caedb484

Reproduce (after the README prerequisites):
```sh
npm run cre:simulate
npm run cre:simulate -- --deny-budget
npm run --silent demo:agent
# Requires the configured Sepolia wallet, gas, and test USDC:
npm run --silent demo:agent -- --pay
```

Demo context: recorded Sepolia run; CRE executes locally and the wallet CLI applies
the signing policy. The agent is prompted to try basic and premium sessions.
The stream accrues with time. Onchain audit receipts are separate transactions.
Full architecture and execution evidence are linked above. Narration is synthetic.

Music: “Dreams Become Real” — Kevin MacLeod (incompetech.com).
Licensed under Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/
Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500027
Music trimmed, normalized and ducked under narration. Video/edit/narration are AgentPay's.

Built with Chainlink CRE.
