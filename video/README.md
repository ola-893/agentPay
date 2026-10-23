# AgentPay short demo

A 90–120 second video focused on fund-once streaming, CRE observations, request
reuse, outage-driven closure, verified settlement, and budget control. The current
narration is about 1:46. Every recorded number and transaction comes from the same
NDJSON as the dashboard. See claims.md for the evidence mapping.

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
