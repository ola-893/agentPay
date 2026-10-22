import http from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { Wallet, Contract, JsonRpcProvider, FetchRequest } from "ethers";
import cli from "../scripts/lib/cli.cjs";
import {
  loadProfile,
  validatePolicy,
  POLICY_LIMITS,
} from "./agent/profile.mjs";
import { modelSettings } from "./agent/model.mjs";
import { validateEvent } from "../vite-project/src/lib/run-events.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const origins = new Set(["http://127.0.0.1:5317", "http://localhost:5317"]);
function provider() {
  const req = new FetchRequest(
    process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"
  );
  req.timeout = 15000;
  return new JsonRpcProvider(req, undefined, {
    batchMaxCount: 1,
    cacheTimeout: -1,
  });
}
async function readAgent() {
  const profile = await loadProfile(),
    wallet = new Wallet(
      process.env.PRIVATE_KEY_1 || process.env.PRIVATE_KEY || ""
    ),
    settings = modelSettings(process.env);
  if (
    wallet.address.toLowerCase() !== profile.payer.toLowerCase() ||
    (
      process.env.AGENTPAY_AGENT_RECIPIENT ||
      process.env.CRE_PAYMENT_RECIPIENT_ADDRESS
    )?.toLowerCase() !== profile.recipient.toLowerCase() ||
    process.env.AGENTPAY_USDC_STREAM_ADDRESS?.toLowerCase() !==
      profile.escrow.toLowerCase()
  )
    throw new Error(
      "Registered profile must match the dedicated payer, recipient and escrow in root .env."
    );
  const p = provider();
  try {
    if ((await p.getNetwork()).chainId !== 11155111n)
      throw new Error("Sepolia RPC required.");
    const token = new Contract(
      profile.token,
      [
        "function balanceOf(address) view returns(uint256)",
        "function decimals() view returns(uint8)",
      ],
      p
    );
    const [usdc, eth, decimals] = await Promise.all([
      token.balanceOf(wallet.address),
      p.getBalance(wallet.address),
      token.decimals(),
    ]);
    if (decimals !== 6n || (await p.getCode(profile.escrow)) === "0x")
      throw new Error("Circle USDC or escrow deployment is unavailable.");
    return {
      profile,
      planner: `${settings.provider} / ${settings.model}`,
      balances: { usdcRaw: String(usdc), ethRaw: String(eth) },
      limits: POLICY_LIMITS,
      observedAt: new Date().toISOString(),
      payReady: usdc >= 10000n && eth >= 1000000000000000n,
    };
  } finally {
    p.destroy();
  }
}
async function preflight() {
  for (const [command, args] of [
    [process.env.CRE_BIN || "cre", ["whoami", "--non-interactive"]],
    ["bun", ["--version"]],
  ]) {
    let result;
    try {
      result = await cli.runChild(command, args, {
        quiet: true,
        timeoutMs: 20000,
      });
    } catch {
      throw new Error(
        "Install CRE and Bun, authenticate with cre login, and check connectivity."
      );
    }
    if (result.code !== 0)
      throw new Error(
        "CRE login check failed. Run cre login in the local terminal."
      );
  }
}
function launchCLI({ profileFile, mode, onEvent, onClose }) {
  const child = spawn(
    process.execPath,
    [
      path.join(root, "demo/agent-demo.mjs"),
      "--profile",
      profileFile,
      "--events",
      "ndjson",
      ...(mode === "pay" ? ["--pay"] : []),
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] }
  );
  let buffer = "",
    bad = false;
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    if (bad) return;
    buffer += chunk;
    // The emitter's own validator bounds each line. Never kill a funded child
    // because a transport failed; let its normal cleanup finish.
    if (buffer.length > 1000000) {
      bad = true;
      console.error(
        "Event transport exceeded its bound. Inspect CLI run evidence."
      );
      return;
    }
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i);
      buffer = buffer.slice(i + 1);
      if (!line.trim()) continue;
      try {
        onEvent(validateEvent(JSON.parse(line)));
      } catch {
        bad = true;
        console.error("Invalid event transport. Inspect CLI run evidence.");
        return;
      }
    }
  });
  child.stderr.on("data", (chunk) =>
    process.stderr.write(cli.redact(chunk.toString()))
  );
  child.once("error", () => onClose(1));
  child.once("close", (code) => onClose(code ?? 1));
  return child;
}
export function validateRunRequest(body, payEnabled, agent) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).sort().join() !== "confirmPay,mode,policy,profileId" ||
    body.profileId !== agent.profile.id ||
    !["preview", "pay"].includes(body.mode) ||
    typeof body.confirmPay !== "boolean"
  )
    throw Object.assign(
      new Error(
        "Invalid run request. Choose the registered agent and Preview or Pay."
      ),
      { status: 400 }
    );
  let policy;
  try {
    policy = validatePolicy(body.policy);
  } catch (e) {
    throw Object.assign(e, { status: 400 });
  }
  if (body.mode === "pay" && (!payEnabled || !body.confirmPay))
    throw Object.assign(
      new Error("Pay requires server PAY_ENABLED=1 and explicit confirmation."),
      { status: 403 }
    );
  if (body.mode === "pay" && !agent.payReady)
    throw Object.assign(
      new Error("Pay requires at least 0.01 test USDC and 0.001 Sepolia ETH."),
      { status: 422 }
    );
  // The quote is never accepted from HTTP: the CLI independently caps funding.
  if (
    agent.profile.quote.amountRaw !== "10000" ||
    agent.profile.quote.durationSeconds !== 1000
  )
    throw Object.assign(
      new Error("Registered quote exceeds the fixed demo limits."),
      { status: 400 }
    );
  return { mode: body.mode, profile: { ...agent.profile, policy } };
}
export function createRunServer({
  port = 5318,
  getAgent = readAgent,
  check = preflight,
  launch = launchCLI,
  payEnabled = process.env.PAY_ENABLED === "1",
  directory = path.join(root, ".local/run-server"),
} = {}) {
  const token = randomBytes(24).toString("hex"),
    runs = new Map();
  let active = null,
    closing = false;
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(JSON.stringify(value));
    };
    const actualPort = server.address()?.port;
    if (
      ![`127.0.0.1:${actualPort}`, `localhost:${actualPort}`].includes(
        req.headers.host
      ) ||
      (req.headers.origin && !origins.has(req.headers.origin))
    )
      return send(403, { error: "Untrusted Host or Origin." });
    if (req.headers.origin) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "content-type, x-agentpay-token",
      });
      return res.end();
    }
    const url = new URL(req.url, "http://127.0.0.1");
    try {
      if (req.method === "GET" && url.pathname === "/health")
        return send(200, { ok: true, busy: Boolean(active), payEnabled });
      if (req.method === "GET" && url.pathname === "/api/agent")
        return send(200, {
          ...(await getAgent()),
          token,
          payEnabled,
          busy: Boolean(active),
          activeRunId: active?.id || null,
        });
      if (req.method === "POST" && url.pathname === "/api/runs") {
        if (
          !origins.has(req.headers.origin) ||
          req.headers["x-agentpay-token"] !== token ||
          req.headers["content-type"]?.split(";")[0] !== "application/json"
        )
          return send(403, {
            error: "Local dashboard JSON request and session token required.",
          });
        if (active || closing)
          return send(409, {
            error: "A run is already active. Wait for it to finish.",
            activeRunId: active?.id,
          });
        const id = randomBytes(16).toString("hex"),
          run = {
            id,
            events: [],
            clients: new Set(),
            artifacts: new Map(),
            ended: false,
            writes: Promise.resolve(),
          };
        active = run;
        try {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 16384)
              throw Object.assign(new Error("Request body too large."), {
                status: 413,
              });
          }
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            throw Object.assign(new Error("Malformed JSON."), { status: 400 });
          }
          const agent = await getAgent(),
            validated = validateRunRequest(parsed, payEnabled, agent);
          try {
            await check();
          } catch (e) {
            throw Object.assign(e, { status: 503 });
          }
          await mkdir(directory, { recursive: true });
          const profileFile = path.join(directory, `${id}.json`);
          await writeFile(profileFile, JSON.stringify(validated.profile), {
            mode: 0o600,
          });
          runs.set(id, run);
          const publish = (e) => {
            validateEvent(e);
            if (
              run.events.length >= 1000 ||
              e.seq !== run.events.length + 1 ||
              (run.events.length && e.runId !== run.events[0].runId) ||
              run.ended
            )
              throw new Error("Invalid event sequence.");
            run.events.push(e);
            for (const key of ["configPath", "transcriptPath"])
              if (e.data[key])
                run.artifacts.set(e.data[key], path.resolve(root, e.data[key]));
            for (const client of run.clients)
              client.write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
            if (e.type === "run.end") {
              run.ended = true;
              for (const client of run.clients) client.end();
              run.clients.clear();
            }
            run.writes = run.writes
              .then(() =>
                appendFile(
                  path.join(directory, `${id}.ndjson`),
                  JSON.stringify(e) + "\n",
                  { mode: 0o600 }
                )
              )
              .catch(() => {
                console.error(
                  "Local SSE journal write failed; inspect the CLI's private run.ndjson evidence."
                );
              });
          };
          const finish = (code) => {
            if (!run.ended) {
              const eventId = run.events[0]?.runId || id;
              publish({
                schemaVersion: 1,
                runId: eventId,
                seq: run.events.length + 1,
                at: new Date().toISOString(),
                type: "error",
                data: {
                  code: "CLI_EXIT",
                  message: `CLI exited (${code}) before a complete event stream. Inspect local terminal/evidence; do not repeat funding blindly.`,
                },
              });
              publish({
                schemaVersion: 1,
                runId: eventId,
                seq: run.events.length + 1,
                at: new Date().toISOString(),
                type: "run.end",
                data: {
                  status: "failed",
                  fundedRaw: null,
                  earnedRaw: null,
                  refundedRaw: null,
                  balances: {},
                  transactions: [],
                  amountsVerified: false,
                },
              });
            }
            if (active === run) active = null;
            if (closing) server.close();
          };
          launch({
            profileFile,
            mode: validated.mode,
            onEvent: publish,
            onClose: finish,
          });
          return send(202, { id });
        } catch (e) {
          if (active === run) active = null;
          throw e;
        }
      }
      const match = url.pathname.match(
        /^\/api\/runs\/([a-f0-9]{32})\/(events|artifact)$/
      );
      if (req.method === "GET" && match) {
        const run = runs.get(match[1]);
        if (!run)
          return send(404, {
            error: "Unknown run. The local server may have restarted.",
          });
        if (match[2] === "artifact") {
          const file = run.artifacts.get(url.searchParams.get("path"));
          if (!file)
            return send(404, {
              error: "Artifact not registered for this run.",
            });
          const text = cli
            .redact(await readFile(file, "utf8"))
            .split(root)
            .join("<repo>");
          res.writeHead(200, {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          });
          return res.end(text);
        }
        const after = Number(req.headers["last-event-id"] || 0);
        if (!Number.isSafeInteger(after) || after < 0)
          return send(400, { error: "Invalid event cursor." });
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        });
        res.write(": AgentPay local run\n\n");
        for (const e of run.events.filter((e) => e.seq > after))
          res.write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
        if (run.ended) return res.end();
        run.clients.add(res);
        req.on("close", () => run.clients.delete(res));
        return;
      }
      send(404, { error: "Not found." });
    } catch (e) {
      send(e.status || 503, {
        error: e.status
          ? e.message
          : "Local run unavailable. Check root .env, registered profile, CRE login, compiled contracts and Sepolia RPC in the terminal.",
      });
    }
  });
  server.shutdown = () => {
    closing = true;
    server.close();
  };
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const server = createRunServer();
  server.listen(5318, "127.0.0.1", () =>
    console.log(
      "AgentPay local run server: http://127.0.0.1:5318 (Preview default; PAY_ENABLED=1 opts into Pay)"
    )
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      console.log(
        "Stopping new runs. An active CLI child will finish its normal cleanup."
      );
      server.shutdown();
    });
}
