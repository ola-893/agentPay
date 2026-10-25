# AgentPay short demo

A 90–120 second video focused on fund-once streaming and deterministic CRE payment
guardrails: fixed-rule admission, request reuse, outage-driven closure, verified
settlement and budget control. The agent supplies reasoning; CRE evaluates rules;
the CLI applies checked results. The current narration is about 1:50.
Every recorded number and transaction comes from the same
NDJSON as the dashboard. See claims.md for the evidence mapping.

Current live CLI escrow: [`0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09`](https://sepolia.etherscan.io/address/0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09). [Guarded setup](../docs/GUARDED_STREAMS.md). The video replays the earlier recorded run; its contract address and receipts remain historical.

From the repository root, with Node 22+ and FFmpeg:

```sh
npm run video:data
npm run video:build
npm run video:preview
npm run video:render
node video/scripts/verify.mjs
node video/scripts/deliver.mjs
```

The project pins HyperFrames 0.8.186. Output is video/out/agentpay-demo.mp4, with
an SRT, thumbnail and description. Renders are ignored by Git; local fonts, source
narration and licensed music are committed. Ordinary builds need no API credentials,
wallet or chain access. First use of the CLI may install its pinned package/browser.

The short cut uses diagrams, actual source snippets, recorded CLI output and RPC
settlement evidence. It has no dashboard placeholder and needs no browser footage.
Recorded Sepolia execution and local CRE simulation remain identified in neutral labels.

Replace narration using video/assets/voiceover/chNN.wav and the corresponding
chNN.timing.json sentence sidecar (voice: "user"). Regenerate timing.json and build.
Generated files are protected against unintentional overwrite by WAV hashes.

To regenerate the local voice:

```sh
python3 -m venv video/.venv
video/.venv/bin/pip install kokoro-onnx==0.4.7 soundfile==0.14.0
video/.venv/bin/python video/scripts/narrate.py
```

Kokoro models must exist under ~/.cache/hyperframes/tts or KOKORO_CACHE.
See ASSETS.md for required music credit and font/animation licenses.
