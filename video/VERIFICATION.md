# Guarded demo verification

The current cut measures **112.5333 seconds**, with 291 narration words and 22
sentence-timed captions. It uses the successful October 25 guarded run
`20261025T173241Z-38db9e1a`, not the older CLI-only contract or the interrupted retest.

From the repository root with Node 22 and FFmpeg:

```sh
node video/scripts/build-data.mjs --check
npm run video:build
npm run video:render
node video/scripts/verify.mjs
node video/scripts/deliver.mjs
npm run docs:check
```

The committed verification record applies to the checked-in sources. A new render
can have a different encoder hash; a measured/reviewed revision needs an updated
source manifest. Do not change verification hashes merely to silence a failed gate.

HyperFrames full checks passed with zero lint, runtime, layout, contrast or craft
findings. The recorded JSON was reduced to its **exact data field**, explicitly
labelled, to meet its reading-time floor. All eight chapters, phone sheet and
seven five-frame transition strips were reviewed. Direction and single-scene
visibility passed for all seven cuts. Three fractional-boundary speed-match
warnings remain in `verification-seams.json`; motion was not changed for this
wording/evidence pass. The encoded MP4 was fully decoded without errors, and its
contact sheet/thumbnail were extracted after rendering.

`verification.json` records H.264/AAC, 1920×1080, 30 fps, duration, SHA-256 and audio
measurements (-13.30 LUFS integrated, -1.92 dBTP). Its source manifest binds the
narration FLACs, text/timing, generated data, exact composition and builder sources.
`docs:check` verifies that manifest, narration/caption agreement and signed-evidence
data without a browser, media install or chain access. It detects stale sources,
not the presence of an ignored local MP4 in someone else's checkout.

The contract scene shows actual source and saved rejection checks. OPEN/CLOSE
signatures and consumed nonces bind to the recorded escrow and receipts. The
recipient delta and payout split are historical observed amounts, not future
expected payments. The contract authenticates the separate local policy signer;
no DON execution or whole-wallet protection is implied.

No new payment, deployment or paid voice call was made for this revision. Fresh
RPC receipt retrieval during the documentation audit failed local DNS; prior
independently verified public evidence is rechecked offline. The later CRE account
authentication failure and actual operator recovery remain in the linked docs and
video description. Product-page visual QA was not repeated. Audio was measured;
human listening remains useful for pronunciation and pacing review.
