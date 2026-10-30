# AgentPay: two-minute recording edit

The user's `1030.mp4` (18:07.414, 3326 × 2160) is edited into a 120-second, 1920 × 1080, 30 fps H.264/AAC demo. The original file is preserved. This edit is separate from the earlier HyperFrames film.

The complete CLI payment shown is stream **#9**, with **0.01 USDC** funded, **10 successful requests**, **3 injected service failures**, **0.00132 USDC** earned, and **0.00868 USDC** refunded. The premium request is denied. The introductory dashboard shots explain the architecture; they are not presented as the CLI run's live dashboard.

`edit.json` records every retained source interval, crop and speed. Long waits and navigation are cut; selected intervals play at 2×. CLI clips remain in chronological order. Enlarged original terminal footage appears beside short explanatory labels. The narration describes local CRE decisions and the separate policy signatures verified by the contract.

## Outputs

Local, ignored delivery directory: `video/out/recorded-demo-1030/`

- `AgentPay-2min.mp4`: final video, exactly 120 seconds and 3,600 frames.
- `AgentPay-voiceover.wav`: normalized voiceover, 48 kHz mono.
- `Narration.txt`: timed script.
- `AgentPay-2min.srt`: optional companion captions using generated sentence timings.
- `verification.json`: original/final SHA-256 hashes, edit list, voice timing, media metadata and decode verification.

## Reproduce locally

Run from the repository root. The original source path is in `edit.json`; update it if the recording moves. This requires FFmpeg, Swift/AppKit on macOS, the existing `video/.venv` with Kokoro ONNX/NumPy/SoundFile, and the cached Kokoro model and voices under `~/.cache/hyperframes/tts/`. Generation is local and uses the `bm_george` voice.

```sh
mkdir -p .local/recorded-demo-1030
video/.venv/bin/python video/recorded-demo-1030/narrate.py
swift -module-cache-path .local/recorded-demo-1030/swift-cache video/recorded-demo-1030/panels.swift video/recorded-demo-1030/edit.json .local/recorded-demo-1030
python3 video/recorded-demo-1030/render.py
```

The renderer checks every clip's frame count, checks that the edit totals 120 seconds, performs two-pass loudness normalization targeting −16 LUFS with a −1.5 dBTP ceiling, and decodes the entire final export to catch media errors. Render intermediates and voice caches remain under `.local/recorded-demo-1030/`.

Additional review included the source/result frames, cuts, narration timing, and local Whisper speech recognition against the script. The recognizer identifies all spoken claims, including CRE, USDC, the separate policy signer, stream reuse, closure, refund and DENY. These are editing and narration checks against the recording and implementation; editing does not execute new payments.
