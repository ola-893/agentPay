import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { loadProfile } from "../demo/agent/profile.mjs";
import { validateRun } from "../vite-project/src/lib/run-events.mjs";
import cli from "./lib/cli.cjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const flags = cli.parseFlags(process.argv.slice(2), {
  pay: "boolean",
  preset: "value",
});
if (flags.help) {
  console.log(
    "npm run demo:capture -- [--pay] [--preset tiny-cap|stale-feed]\nRuns the real AI/CRE CLI, validates its NDJSON and exports recorded evidence. --pay escrows up to 0.01 test USDC and spends test ETH."
  );
  process.exit(0);
}
if (flags.preset && !["tiny-cap", "stale-feed"].includes(flags.preset))
  throw new Error("Unknown preset.");
if (flags.pay && flags.preset)
  throw new Error("Capture denial presets in unsigned preview mode.");
const profile = await loadProfile();
if (flags.preset === "tiny-cap") profile.policy.depositCapRaw = "9999";
if (flags.preset === "stale-feed") profile.policy.maxFeedAgeSeconds = 60;
const local = path.join(root, ".local/capture");
await mkdir(local, { recursive: true });
const profileFile = path.join(
  local,
  `profile-${randomBytes(6).toString("hex")}.json`
);
await writeFile(profileFile, JSON.stringify(profile), { mode: 0o600 });
const child = spawn(
  process.execPath,
  [
    path.join(root, "demo/agent-demo.mjs"),
    "--profile",
    profileFile,
    "--events",
    "ndjson",
    ...(flags.pay ? ["--pay"] : []),
  ],
  { cwd: root, stdio: ["ignore", "pipe", "inherit"] }
);
let data = "";
child.stdout.on("data", (chunk) => {
  data += chunk;
  if (data.length > 5000000) throw new Error("Unexpected capture size.");
});
const code = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", resolve);
});
if (code !== 0)
  throw new Error(
    "CLI failed; no public capture replaced. Inspect .local/agent-demo/runs."
  );
const events = validateRun(
  data
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
);
if (events.at(-1).data.status !== (flags.preset ? "denied" : "completed"))
  throw new Error(
    "Live inputs did not produce the requested capture. No public evidence replaced."
  );
if (
  flags.preset &&
  !events.some(
    (e) =>
      e.type === "cre.result" &&
      e.data.reason ===
        (flags.preset === "tiny-cap" ? "AMOUNT_EXCEEDS_POLICY" : "FEED_STALE")
  )
)
  throw new Error("Preset did not produce its expected live denial.");
if (
  flags.pay &&
  !["open", "close"].every((kind) =>
    events.some(
      (e) =>
        e.type === "wallet.tx" &&
        e.data.kind === kind &&
        e.data.status === "confirmed"
    )
  )
)
  throw new Error("Pay capture lacks confirmed open/close.");
const id = events[0].runId,
  dir = path.join(root, "vite-project/public/runs", id);
await mkdir(path.join(dir, "artifacts"), { recursive: true });
const artifacts = {};
let n = 0;
for (const e of events)
  for (const key of ["configPath", "transcriptPath"])
    if (e.data[key] && !artifacts[e.data[key]]) {
      const relative = e.data[key];
      const absolute = path.resolve(root, relative);
      if (!absolute.startsWith(root + ".local/"))
        throw new Error("Artifact outside local evidence.");
      const target = `artifacts/${String(++n).padStart(2, "0")}-${path.basename(
        relative
      )}`;
      const text = cli
        .redact(await readFile(absolute, "utf8"))
        .split(root)
        .join("<repo>");
      await writeFile(path.join(dir, target), text);
      artifacts[relative] = target;
    }
await writeFile(path.join(dir, "events.ndjson"), data);
const indexFile = path.join(root, "vite-project/public/runs/index.json");
let previous = { schemaVersion: 1, runs: [] };
try {
  previous = JSON.parse(await readFile(indexFile, "utf8"));
} catch {}
const entry = {
  id,
  label:
    flags.preset === "tiny-cap"
      ? "Tiny cap denial"
      : flags.preset === "stale-feed"
      ? "Stale feed denial"
      : flags.pay
      ? "Funded stream lifecycle"
      : "Unsigned preview",
  mode: flags.pay ? "pay" : "preview",
  preset: flags.preset || null,
  capturedAt: events.at(-1).at,
  file: `${id}/events.ndjson`,
  sha256: createHash("sha256").update(data).digest("hex"),
  artifacts,
};
await writeFile(
  indexFile,
  JSON.stringify(
    {
      schemaVersion: 1,
      runs: [entry, ...previous.runs.filter((r) => r.id !== id)],
    },
    null,
    2
  ) + "\n"
);
console.log(
  `Exported actual CLI events: ${id} (${events.length} events; ${entry.label}).`
);
