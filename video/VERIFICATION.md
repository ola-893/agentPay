# Short-demo verification

The current cut targets 90–120 seconds. Measured narration: 109.8667 s; 292 words,
22 independently timed caption sentences. The verifier enforces the requested range.

Reproduce from the repository root with Node 22+ and FFmpeg:

```sh
npm run video:data
npm run video:build
npm run video:render
node video/scripts/verify.mjs
node video/scripts/deliver.mjs
```

HyperFrames 0.8.186 checks passed with zero lint, runtime, layout, contrast or craft
findings. All eight chapters were inspected on overview and phone sheets, with
five frames around every chapter transition. Seven seam direction and single-scene
visibility checks passed; four fractional-boundary speed warnings remain in
verification-seams.json. Code, log excerpts and payment values are source-derived.
The contact sheet and thumbnail are extracted from the encoded MP4.

The narration now identifies CRE as deterministic payment guardrails, separate from
the agent’s reasoning. Source, captions and encoded audio agree.

The video no longer contains a dashboard placeholder, long limitations chapter,
future-work section, or repeated test-token qualification. It retains neutral
execution labels and an accurate account of wallet signing and stream settlement.

verification.json records encoded duration, codecs, frames, SHA-256 and audio
measurements. verification-check.json contains the structured check results.
The prior long cut remains available locally as video/out/agentpay-demo-long.mp4.
No new chain transactions or paid voice-generation calls were needed. Sound was
measured; human listening remains useful for final pronunciation and pacing review.
