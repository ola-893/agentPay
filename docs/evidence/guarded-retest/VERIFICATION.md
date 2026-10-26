# Interrupted guarded retest and operator recovery — October 25, 2026

Run `20261025T182159Z-173753ff` executed `npm run --silent demo:agent -- --pay --json`
against the deployed guarded escrow. Fresh price/admission and spend checks passed;
OPEN nonce 2 funded stream #2 with 10000 raw Circle USDC. Five authenticated requests
reused it without payment transactions. The healthy checkpoint then failed with
[the original CRE authentication error](stream-healthy.log), not a policy CLOSE.

The agent had no signed CLOSE and could not use recovery. This run is **incomplete**;
it does not establish CONTINUE, injected-outage closure or premium DENY. Its
[failure summary](failure-summary.json), [confirmed open](open.json) and
[public OPEN permit](policy-open.json) retain that boundary.

The separate recovery owner was funded with a capped estimated Sepolia gas reserve,
then called `recoveryClose(2)`. The verified [recovery transaction](https://sepolia.etherscan.io/tx/0x8eaa05f81c57d1d4a80b3789074d24b79eb87ede6cac7155ae654a0d4d48895d)
closed escrow and paid **2160 raw = 0.00216 USDC**, refunding **7840 raw = 0.00784 USDC**.
The recipient delta was 2160 raw and `earned + refunded = 10000`.
[Recovery result](recovery.json) · [Independent RPC/rejection verification](retest-verification.json).

Independent checks verified the opening signature and consumed nonce, successful
recovery receipt/event, inactive stream and zero active-stream pointer, recipient
balance delta, and read-only reverts for unsigned create/cancel, agent-forged
approval and agent use of recovery. These are saved observations; no claim of
current CRE availability follows from them.

Accrual continued during the failure/recovery delay. Normal signed closure depends
on CRE/account connectivity; recovery must remain separately available and funded.
This was an intentional operator override, not a CRE result or automatic agent action.
The earlier [complete guarded run](../guarded-stream/VERIFICATION.md) remains the
successful demonstration used by the current video and dashboard recording.
