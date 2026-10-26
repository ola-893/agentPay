# AgentPay guarded-stream demo

A 90–120 second evidence-based film: fund once, reuse service access, run local CRE
rules, sign eligible OPEN/CLOSE approvals with a separate policy key, and verify
them in the guarded contract. The narration, captions, code, addresses and receipts
use the successful October 25 guarded capture. [Claim map](claims.md).

Current escrow: [`0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09`](https://sepolia.etherscan.io/address/0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09).
[Operator setup and limits](../docs/GUARDED_STREAMS.md). The later authentication
failure and operator recovery are [documented separately](../docs/evidence/guarded-retest/VERIFICATION.md).
The film replays a completed run; it is not a live service-availability claim.

## Reproduce the committed film

With Node 22 and FFmpeg, run from the repository root:

```sh
node video/scripts/build-data.mjs --check
npm run video:build
npm run video:preview
npm run video:render
node video/scripts/verify.mjs
node video/scripts/deliver.mjs
```

The project pins HyperFrames 0.8.186. MP4, SRT, thumbnail and description are under
`video/out/`; binary renders are ignored by Git. Source FLAC narration, fonts,
licensed music and caption timings are committed. Ordinary builds need no model
key, wallet or chain access. First CLI use may download the pinned package/browser.

## Change the narration or evidence

`npm run video:data` regenerates evidence data and chapter text. Changing sentences
requires regenerating voice and timing **before** building; the builder refuses
text/timing mismatches. The new source must pass the signed-evidence/data checks.
For the existing cached local voice:

```sh
npm run video:data
video/.venv/bin/python video/scripts/narrate.py
npm run video:build
```

If local voice dependencies are absent, create `video/.venv`, install
`kokoro-onnx==0.4.7 soundfile==0.14.0`, and provide the Kokoro model/voice files under
`~/.cache/hyperframes/tts` (or `KOKORO_CACHE`). This is an optional voice-regeneration
step, not a requirement for rendering committed source audio. No paid voice API is used.

User replacement WAVs require matching `chNN.timing.json` sidecars marked
`voice: "user"`. The generator protects modified files against overwriting.
`npm run docs:check` checks public evidence, generated data, narration/caption
agreement and the last render's source manifest; it does not rerender video or
prove the current availability of CRE. See [verification](VERIFICATION.md) and
[asset licenses](ASSETS.md). Visual QA uses authored-video frames, not a fabricated
product recording.
