# Verification evidence

Rendered artifact: H.264, 1920×1080, 30 fps, 8,094 frames, 269.8 s; AAC stereo;
17,871,427 bytes. `verification.json` records its SHA-256 and chapter durations.
All output files remain ignored; source audio and licensed assets are committed.

Commands run (HyperFrames CLI 0.8.186 under Node 22):

```sh
node video/scripts/build-data.mjs
node video/scripts/write-script.mjs
node video/scripts/build-film.mjs
npx hyperframes check video/agentpay-demo --at 42,67,83,117,155,179,190,225,248,264 --json
npx hyperframes snapshot video/agentpay-demo --review --describe false
npx hyperframes render video/agentpay-demo --quality delivery --fps 30 --workers 4 --strict --skill hyperframes --output video/out/agentpay-demo.mp4
node video/scripts/verify.mjs
node video/scripts/deliver.mjs
ffmpeg -hide_banner -loglevel error -i video/out/agentpay-demo.mp4 -f null -
ffmpeg -hide_banner -nostats -i video/out/agentpay-demo.mp4 -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null -
```

- Data extraction: recorded SHA-256
  `9841484515a3e387c1b1fdceca1fd35952e3b9e73874dec8549f6309c19ed5c0`.
- Script: 694 spoken words; 53 independently timed caption sentences.
- Check: `ok: true`; zero lint, runtime, layout, contrast or craft findings.
  Structured output: verification-check.json.
- Review snapshots: 16 overview beats, 35 seam frames, phone sheet; extra full-size
  source, evidence and trust frames. Contact sheet is decoded from the delivered MP4.
- Motion ledger: direction and single-scene visibility pass at all seven cuts.
  Two fractional-boundary velocity warnings remain; see verification-seams.json and REVIEW.md.
- Render: completed in 96.7 seconds, screenshot capture, hardware browser GPU
  (Apple M4 Pro), four workers. 6 local font faces loaded. No render-time CDN.
- Full decode: exit 0, no FFmpeg errors, all 8,094 frames decoded.
- Audio input measurements: -13.27 LUFS integrated, -1.82 dBTP true peak,
  1.20 LU loudness range. The loudnorm command was an analysis to null, not a claim
  that the delivered audio has the command's requested -16 LUFS target.
- Source-only build: extracted tracked files into a separate temporary directory;
  ran data extraction, script generation and film build with Node 22. The first
  pass found an absent ignored out/ directory; builder now creates it. Re-run passed.

Limits: no actual dashboard video (tool policy rejected local browser observation),
no live CLI camera recording, no new payment or current market simulation, and no
human audio audition. Visual review sampled the film; it did not manually inspect
every encoded frame. The dashboard placeholder means this remains a submission
**draft**. See README.md for the exact footage and narration replacement steps.
