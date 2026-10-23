# AgentPay narration

694 words. Spoken initialisms expanded for local pronunciation.

## ch00 — Hook

An agent making a thousand paid API calls should not need a thousand payment transactions. AgentPay combines a funded stream with Chainlink C R E supervision.

## ch01 — The payment problem

Paying separately for every request couples useful work to repeated blockchain transactions. A funded stream separates the request loop from the payment lifecycle. The contract accrues earnings with time; it does not meter API calls. But that creates another problem: who decides when paying should start, continue, or stop? If a provider becomes unavailable while time keeps passing, funds can keep accruing. The stream handles settlement. The workflow supplies a decision about whether the session should remain open.

## ch02 — Architecture

Follow the agent, its wallet, the escrow, and the paid service. The wallet funds escrow, then service requests reuse the active session. C R E connects a separate supervision loop to that payment lifecycle. Coinbase supplies an external U S D C quote. Chainlink supplies the Sepolia U S D C dollar feed. The supervisor also fetches service health and reads token balances and stream state on Sepolia. Those observations produce OPEN, CONTINUE, CLOSE, or DENY. The wallet C L I validates the local results before it signs. On the C R E network, a deployed workflow runs on a decentralized oracle network. This demonstration uses the local C L I simulator. It has no D O N authorization.

## ch03 — Inside CRE

The H T T P capability fetches Coinbase. The E V M capability reads the Sepolia feed. This recording observed Coinbase at 1.00000000 dollars and Chainlink at 0.99990493 dollars. Both the peg and source disagreement limits are 100 basis points. The feed was 8273 seconds old against a limit of 86400 seconds. Fresh inputs can change the decision. Admission checks bind service health, the payment token, its decimals, balance, budget, and rate. The deposit is 0.01 test U S D C, below a 0.1 cap. The actual rate is 0.00001 U S D C per second, below the 0.0001 maximum. At checkpoints, the supervisor checks stream identity, accrued funds, availability, and failure counts. The saved simulator log shows compilation, the external quote, the chain observation, and the resulting approval.

## ch04 — Recorded payment run

Now follow the recorded funded run. Waiting time is condensed. The agent is explicitly prompted to try an in-budget session and an over-budget session. After approval, the wallet signs a token allowance and opens the funded stream. The service records 10 successful requests, reusing the same stream. A healthy checkpoint returns CONTINUE. Requests reuse the stream. The demo injects H T T P 503 responses and records 3 failures. C R E returns CLOSE. The wallet then signs cancellation; the contract settles elapsed earnings. 0.01 test U S D C splits into 0.00096 earned and 0.00904 refunded. This card comes from saved R P C verification, not an explorer screenshot. The premium quote is 0.2 against the 0.1 cap. DENY prevents that session opening. The capture also contains 4 separate audit receipts. These are additional transactions. No premium payment is signed; an audit receipt still follows the block.

## ch05 — Dashboard replay

The dashboard reads the same saved event stream used to build this video. It displays decisions, request counters, transaction links, and the earnings and refund split. The interface computes no policy decision. A real browser recording belongs here. Capture access was unavailable, so this draft shows a labeled placeholder.

## ch06 — Trust boundary

Be precise about enforcement: local C R E simulation proposes a decision; the wallet C L I gates signing. The stream contract does not verify C R E results. A different wallet client can bypass that gate. Localhost health snapshots and per-run configurations are demonstration shortcuts, not independent proof of service quality. This uses valueless test U S D C, is not a full x four oh two implementation, and is unaudited. A production path needs a deployed workflow, a public health endpoint, trigger payloads, and authenticated reports. A forwarder and onchain consumer would move authorization into the contract path. That is future work for this stream demo.

## ch07 — Reproduce it

Follow the documented prerequisites. Start with the read-only C R E scenarios, then the preview agent demo. Use the funded command only with a prepared Sepolia wallet. Inspect the linked transactions. Built with Chainlink C R E.
