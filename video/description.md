# AgentPay: funded streams supervised by Chainlink CRE (demo draft)

A narrated walkthrough of local CRE simulation, time-accruing escrow, a recorded
Circle test-USDC stream on Ethereum Sepolia, outage-driven cancellation, and premium denial.

0:00 Hook
0:09 The payment problem
0:38 Architecture
1:20 Inside CRE
2:20 Recorded payment run
3:19 Dashboard replay
3:38 Trust boundary
4:16 Reproduce it

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

Disclosures: CRE runs in the local CLI simulator, with no DON authentication.
The wallet CLI validates decisions before signing; the stream contract does not
verify CRE results, and another client can bypass that gate. Localhost health and
per-run configuration are shortcuts. The prompted plan tries one in-budget and one
over-budget session. The stream accrues by time, not by successful API-call count.
This is valueless test USDC, not full x402, and an unaudited prototype. Extra audit
transactions are distinct from stream lifecycle transactions; no gas-savings figure
is claimed. Logs/stdout are labeled historical replays. RPC evidence is historical.
The dashboard chapter is an explicit placeholder because real browser capture was
blocked. Replace it and regenerate that chapter's final narration before submission.
No live CLI footage was available. Narration is local synthetic speech.

Music: “Dreams Become Real” — Kevin MacLeod (incompetech.com).
Licensed under Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/
Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500027
Music trimmed, normalized and ducked under narration. Video/edit/narration are AgentPay's.

Built with Chainlink CRE.
