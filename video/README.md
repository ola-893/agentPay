# AgentPay explainer source

Run from the repository root with Node 22+ and FFmpeg:

```sh
npm run video:data
npm run video:build
npm run video:preview
npm run video:render
```

The project pins HyperFrames 0.8.186. Output is `video/out/agentpay-demo.mp4`.
The source audio and measured timing are committed; ordinary builds do not need a
voice service, an API key, .env, an RPC, or a funded wallet. The CLI may need network
access on first use to install its pinned package/browser.

`data.js` is rebuilt from the same dashboard NDJSON. Code snippets and simulator
log lines are extracted at build time. `claims.md` explains exactly what is proved.
`DESIGN.md` records palette/type. The film remains labeled as a draft until the
real dashboard recording replaces its explicit placeholder.

For a real dashboard chapter, save a 1920×1080 Recorded replay at
`video/assets/dashboard.mp4`, at least the chapter duration (see timing.json).
Record the funded run's price check, CLOSE and premium DENY. Strip wallet extensions,
secrets and unrelated tabs. `video:build` copies it into the render project; it never
creates a dashboard facsimile. Before the final recording version, replace the final
chapter-5 sentence about missing footage and regenerate its voice and caption timing.
Browser capture is currently blocked by tool policy.

To replace narration, use `video/assets/voiceover/chNN.wav` and a matching
`chNN.timing.json` sentence-timing sidecar. Use `voice: "user"` in that sidecar.
Regenerate `timing.json` and rebuild. Do not retain old caption timings for new audio.
The committed .flac files contain the generated source voice. Local regeneration:

```sh
python3 -m venv video/.venv
video/.venv/bin/pip install kokoro-onnx==0.4.7 soundfile==0.14.0
video/.venv/bin/python video/scripts/narrate.py
```

Kokoro model files must already exist in `~/.cache/hyperframes/tts`, or set
KOKORO_CACHE. `npx hyperframes@0.8.186 tts` can initialize that cache. No paid calls.
See ASSETS.md for required music credit and local font/animation licenses.
