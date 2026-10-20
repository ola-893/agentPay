import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";
import {
  Wallet,
  JsonRpcProvider,
  FetchRequest,
  isAddress,
  ZeroAddress,
  formatUnits,
} from "ethers";
import cli from "../scripts/lib/cli.cjs";
import { modelSettings, callModel, runAgent } from "./agent/model.mjs";
import { runCreIntent, runStreamCheck } from "./agent/cre.mjs";
import { assertLocalApproval } from "./agent/payments.mjs";
import { createAgentOutput } from "./agent/output.mjs";
import {
  USDC,
  CHAIN_ID,
  TIERS,
  verifyStreamDeployment,
  startStreamService,
  validateStreamQuote,
  openStream,
  closeStream,
  snapshotWallet,
  sessionMessage,
  readStream,
  assertStreamIntent,
} from "./agent/streams.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const help = `AgentPay / CRE-supervised streaming demo

Usage
  npm run --silent demo:agent -- [--pay] [--verbose] [--json] [--help]
  npm run --silent demo:agent -- --close-stream <id> [--json]

Default: real AI + local CRE admission preview; no signing or token funding.
--pay      Deposit at most 0.01 Circle test USDC into a Sepolia stream.
           Reuse it for 10 requests, demonstrate CONTINUE, inject a demo outage,
           then cancel: earned funds go to the recipient and unused funds refund.
           A new paid run can fund another stream and uses test ETH for gas.
--close-stream <id>  Recover an owned USDC stream; no AI or CRE call required.
--verbose  Add response IDs, CRE evidence hashes and unverified model text.
--json     One result envelope on stdout; plain progress on stderr.
--help     No credentials, API calls, network or transactions.

Set QWEN_API_KEY or OPENAI_API_KEY (OPEN_AI_KEY alias accepted), PRIVATE_KEY_1
or PRIVATE_KEY, AGENTPAY_AGENT_RECIPIENT (CRE_PAYMENT_RECIPIENT_ADDRESS alias),
and AGENTPAY_USDC_STREAM_ADDRESS in ignored root .env. Recovery needs only wallet
and stream settings. Requires CRE CLI, Bun and network access for the main demo.
Qwen is selected when its key is present; AGENTPAY_AI_PROVIDER overrides this.
Defaults: QWEN_MODEL=qwen3.5-plus, QWEN_REGION=singapore,
OPENAI_MODEL=gpt-4.1-mini. Model calls may incur charges; no model/rules fallback.

CRE commands, observed inputs, policy limits and transcript paths are shown.
CRE stays local. CLI checks gate wallet signing; the contract enforces escrow
accounting, not CRE approvals. No DON or strict-guard authorization, nor full
x402. Stream earnings accrue until the
cancellation transaction is mined. No automatic repeat funding on uncertainty.
Evidence: .local/agent-demo/runs/. Exit: 0 complete / 1 failed / 2 config or usage.`;
await cli.cliMain(
  "demo:agent",
  { pay: "boolean", verbose: "boolean", "close-stream": "value" },
  help,
  async ({ flags }) => {
    if (flags.pay && flags["close-stream"])
      throw new cli.CliError(
        "USAGE",
        "Use either --pay or --close-stream, not both.",
        2
      );
    if (
      flags["close-stream"] &&
      (!/^[1-9][0-9]*$/.test(flags["close-stream"]) ||
        BigInt(flags["close-stream"]) >= 2n ** 256n)
    )
      throw new cli.CliError(
        "USAGE",
        "--close-stream requires a positive uint256 ID.",
        2
      );
    dotenv.config({ path: path.join(root, ".env"), quiet: true });
    let signer;
    try {
      signer = new Wallet(
        process.env.PRIVATE_KEY_1 || process.env.PRIVATE_KEY || ""
      );
    } catch {
      throw new cli.CliError(
        "CONFIG",
        "Set a valid dedicated Sepolia PRIVATE_KEY_1 or PRIVATE_KEY.",
        2
      );
    }
    const rpc =
      process.env.SEPOLIA_RPC_URL ||
      "https://ethereum-sepolia-rpc.publicnode.com";
    try {
      if (!["http:", "https:"].includes(new URL(rpc).protocol))
        throw new Error();
    } catch {
      throw new cli.CliError("CONFIG", "SEPOLIA_RPC_URL must be HTTP(S).", 2);
    }
    const request = new FetchRequest(rpc);
    request.timeout = 15000;
    const provider = new JsonRpcProvider(request, undefined, {
        batchMaxCount: 1,
        cacheTimeout: -1,
      }),
      wallet = signer.connect(provider);
    let settings,
      service,
      openedId,
      closeAttempted = false,
      cleanup;
    const id =
      new Date().toISOString().slice(0, 19).replace(/[-:]/g, "") +
      "Z-" +
      randomBytes(4).toString("hex");
    const directory = path.join(root, ".local/agent-demo/runs", id);
    await mkdir(directory, { recursive: true });
    const save = (name, value) =>
      writeFile(
        path.join(directory, name),
        cli.redact(JSON.stringify(value, null, 2)) + "\n"
      );
    const output = createAgentOutput({
        pay: flags.pay,
        json: flags.json,
        verbose: flags.verbose,
      }),
      events = [];
    const persist = async (kind, data) => {
      await save(`${kind}.json`, data);
      if (kind === "open" && data.streamId) openedId = data.streamId;
      if (data.state === "submitting") output.streamTransaction(kind, data);
    };
    try {
      const streamAddress = process.env.AGENTPAY_USDC_STREAM_ADDRESS;
      await verifyStreamDeployment(provider, streamAddress);
      if (flags["close-stream"]) {
        const result = await closeStream({
          provider,
          wallet,
          streamAddress,
          streamId: flags["close-stream"],
          persist,
        });
        console.log(
          `Stream #${result.streamId} closed; earned ${formatUnits(
            result.earnedRaw,
            6
          )} USDC; refunded ${formatUnits(
            result.refundedRaw,
            6
          )} USDC.\nhttps://sepolia.etherscan.io/tx/${
            result.transaction.transactionHash
          }`
        );
        return { ...result, evidenceDirectory: path.relative(root, directory) };
      }
      settings = modelSettings(process.env);
      const recipient =
        process.env.AGENTPAY_AGENT_RECIPIENT ||
        process.env.CRE_PAYMENT_RECIPIENT_ADDRESS;
      if (
        !isAddress(recipient || "") ||
        recipient === ZeroAddress ||
        same(recipient, wallet.address) ||
        same(recipient, USDC) ||
        same(recipient, streamAddress)
      )
        throw new cli.CliError(
          "CONFIG",
          "Set a distinct nonzero USDC recipient.",
          2
        );
      const initial = await snapshotWallet(provider, wallet.address, recipient);
      if (
        flags.pay &&
        (BigInt(initial.agentBalanceRaw) < 10000n ||
          (await provider.getBalance(wallet.address)) === 0n)
      )
        throw new cli.CliError(
          "BALANCE",
          "Fund the payer with test USDC and Sepolia ETH."
        );
      const sessionId = "0x" + randomBytes(32).toString("hex");
      service = await startStreamService({
        provider,
        agent: wallet.address,
        recipient,
        streamAddress,
        sessionId,
      });
      output.start({
        settings,
        payer: wallet.address,
        recipient,
        balanceRaw: initial.agentBalanceRaw,
      });
      output.streamContract(streamAddress);
      const check = async (q, phase, label, client, streamId = "0") => {
        const snapshot = service.snapshot();
        const config = {
          chainId: Number(CHAIN_ID),
          token: USDC,
          tokenDecimals: 6,
          streamAddress,
          requestId: "0x" + randomBytes(32).toString("hex"),
          quoteId: q.id,
          sessionId,
          agent: wallet.address,
          recipient,
          amountRaw: q.amountRaw,
          spendingCapRaw: "100000",
          durationSeconds: q.durationSeconds,
          maxRateRawPerSecond: "100",
          phase,
          streamId,
          observationBlock: await provider.getBlockNumber(),
          healthUrl: snapshot.url,
          expectedHealth: snapshot.health,
          client: { ...client },
          maxFailedRequests: 3,
        };
        output.streamChecking(label);
        const evidence = await runStreamCheck({
          config,
          root,
          directory,
          label,
          onStart: (invocation) => output.creInvocation(invocation),
        });
        output.streamEvidence(evidence);
        return { config, decision: evidence.result };
      };
      const purchase = async ({ tier, purpose }) => {
        output.requested({ tier, purpose });
        const endpoint = `${service.url}/research/${tier}`,
          response = await fetch(endpoint, {
            signal: AbortSignal.timeout(20000),
          });
        if (response.status !== 402)
          throw new cli.CliError(
            "SERVICE_PROTOCOL",
            "Expected an HTTP 402 streaming quote."
          );
        const { quote: q } = await response.json();
        validateStreamQuote(q, {
          tier,
          agent: wallet.address,
          recipient,
          streamAddress,
          sessionId,
        });
        output.streamQuote(q);
        const client = { successfulRequests: 0, failedRequests: 0 };
        // Premium may run after basic; use actual service counters in its admission check.
        const counts = service.snapshot().health;
        client.successfulRequests = counts.successfulRequests;
        client.failedRequests = counts.failedRequests;
        let priceGate = () => {};
        if (tier === "basic") {
          const base = JSON.parse(
            await readFile(
              path.join(root, "cre/payment-guard/config.staging.json"),
              "utf8"
            )
          );
          const config = {
            ...base,
            publishReport: false,
            receiverAddress: ZeroAddress,
            request: {
              ...base.request,
              requestId: q.id,
              agent: wallet.address,
              recipient,
              token: USDC,
              amount: q.amountRaw,
            },
          };
          output.streamChecking("USDC price safety");
          const price = await runCreIntent({
            config,
            root,
            directory,
            tier: "price",
            onStart: (invocation) => output.creInvocation(invocation),
          });
          output.priceEvidence(price);
          const priceCompleted = performance.now();
          priceGate = () =>
            assertLocalApproval(price, config, {
              elapsedMs: performance.now() - priceCompleted,
            });
          if (!price.result.approved)
            throw new cli.CliError(
              "PRICE_POLICY_DENIED",
              `USDC admission blocked: ${price.result.reason}`
            );
        }
        const before = await snapshotWallet(
          provider,
          wallet.address,
          recipient
        );
        const admission = await check(
            q,
            "admission",
            tier === "basic" ? "open" : "deny",
            client
          ),
          completedAt = performance.now();
        if (admission.decision.action === "DENY") {
          const after = await snapshotWallet(
            provider,
            wallet.address,
            recipient
          );
          if (JSON.stringify(before) !== JSON.stringify(after))
            throw new cli.CliError(
              "DENY_VERIFICATION",
              "Wallet changed during denied admission."
            );
          const result = {
            status: "denied",
            tier,
            policy: {
              reason: admission.decision.reason,
              amountRaw: q.amountRaw,
              amountUsdc: formatUnits(q.amountRaw, 6),
              capRaw: "100000",
              capUsdc: "0.1",
            },
            noTransactionSigned: true,
            before,
            after,
          };
          await save(`${tier}.json`, result);
          output.denied();
          return result;
        }
        if (tier !== "basic" || admission.decision.action !== "OPEN")
          throw new cli.CliError(
            "POLICY",
            "Expected basic OPEN and premium DENY."
          );
        if (!flags.pay) {
          const result = {
            status: "preview",
            tier,
            admission: admission.decision,
            paymentSent: false,
            resourceUnlocked: false,
          };
          await save("basic.json", result);
          output.preview();
          return result;
        }
        const funded = await openStream({
          provider,
          wallet,
          quote: q,
          ...admission,
          elapsed: () => performance.now() - completedAt,
          persist,
          additionalGate: priceGate,
        });
        output.streamOpened(funded);
        const signature = await wallet.signMessage(
          sessionMessage(service.url, q, funded.streamId)
        );
        const headers = {
          "x-agentpay-stream-id": funded.streamId,
          "x-agentpay-session-signature": signature,
        };
        const resources = [];
        const batch = async (count, expectFailure = false) => {
          const beforeNonce = await provider.getTransactionCount(
            wallet.address,
            "pending"
          );
          for (let i = 0; i < count; i++) {
            const res = await fetch(endpoint, {
              headers,
              signal: AbortSignal.timeout(20000),
            });
            const body = await res.json();
            if (expectFailure) {
              if (res.status !== 503 || body.faultInjected !== true)
                throw new cli.CliError(
                  "OUTAGE_TEST",
                  "Expected the explicit injected 503 response."
                );
              client.failedRequests++;
            } else {
              if (
                res.status !== 200 ||
                body.streamId !== funded.streamId ||
                body.sessionId !== sessionId ||
                body.quoteId !== q.id
              )
                throw new cli.CliError(
                  "ACCESS_VERIFICATION",
                  "Provider did not verify the funded session."
                );
              client.successfulRequests++;
              resources.push(body.research);
            }
          }
          if (
            (await provider.getTransactionCount(wallet.address, "pending")) !==
            beforeNonce
          )
            throw new cli.CliError(
              "REQUEST_TRANSACTION",
              "Wallet nonce changed during stream reuse."
            );
          output.streamRequests(client, funded.streamId);
          return {
            requests: count,
            walletNonceBefore: beforeNonce,
            walletNonceAfter: beforeNonce,
            noPaymentTransactions: true,
          };
        };
        const first = await batch(5);
        const healthy = await check(
          q,
          "checkpoint",
          "healthy",
          client,
          funded.streamId
        );
        if (healthy.decision.action !== "CONTINUE")
          throw new cli.CliError(
            "CHECKPOINT",
            `Healthy checkpoint returned ${healthy.decision.action}; cleanup will close the stream.`
          );
        const second = await batch(5);
        service.injectOutage();
        output.streamOutage();
        const failures = await batch(3, true);
        const outage = await check(
          q,
          "checkpoint",
          "outage",
          client,
          funded.streamId
        );
        if (
          outage.decision.action !== "CLOSE" ||
          outage.decision.reason !== "SERVICE_UNAVAILABLE"
        )
          throw new cli.CliError(
            "CHECKPOINT",
            "Outage must produce CLOSE/SERVICE_UNAVAILABLE."
          );
        assertStreamIntent(
          await readStream(provider, streamAddress, funded.streamId),
          q
        );
        closeAttempted = true;
        const settled = await closeStream({
          provider,
          wallet,
          streamAddress,
          streamId: funded.streamId,
          persist,
        });
        output.streamClosed(settled);
        if (BigInt(settled.refundedRaw) === 0n)
          throw new cli.CliError(
            "DEMO_EXPIRED",
            "Stream closed after expiry; no unused balance remained to demonstrate a refund."
          );
        const rejected = await fetch(endpoint, {
          headers,
          signal: AbortSignal.timeout(20000),
        });
        if (rejected.status === 200)
          throw new cli.CliError(
            "ACCESS_VERIFICATION",
            "Closed stream still unlocked content."
          );
        const result = {
          status: "stream-completed",
          tier,
          streamAddress,
          streamId: funded.streamId,
          fundedRaw: q.amountRaw,
          earnedRaw: settled.earnedRaw,
          refundedRaw: settled.refundedRaw,
          admission: admission.decision.action,
          healthyCheckpoint: healthy.decision.action,
          outageCheckpoint: outage.decision.action,
          outageInjected: true,
          client,
          requestBatches: [first, second, failures],
          funded,
          settlement: settled,
          closedAccessRejected: true,
          research: resources[resources.length - 1],
          donAuthenticated: false,
        };
        await save("basic.json", result);
        return result;
      };
      const agent = await runAgent({
        model: settings.model,
        modelCall: (args) => {
          output.thinking(args.complete);
          return callModel({ ...args, ...settings });
        },
        purchase,
        onEvent: (data) => {
          events.push({ at: new Date().toISOString(), ...data });
          if (data.type === "model_response") output.response(data);
        },
      });
      if (
        agent.purchases.premium?.status !== "denied" ||
        agent.purchases.premium.policy.reason !== "AMOUNT_EXCEEDS_POLICY" ||
        agent.purchases.basic?.status !==
          (flags.pay ? "stream-completed" : "preview")
      )
        throw new cli.CliError(
          "DEMO_INCOMPLETE",
          "Expected both streaming basic and over-budget denial outcomes."
        );
      const final = await snapshotWallet(provider, wallet.address, recipient),
        basic = agent.purchases.basic;
      const earned = BigInt(basic.earnedRaw || "0");
      if (
        BigInt(final.recipientBalanceRaw) -
          BigInt(initial.recipientBalanceRaw) !==
          earned ||
        BigInt(initial.agentBalanceRaw) - BigInt(final.agentBalanceRaw) !==
          earned
      )
        throw new cli.CliError(
          "BALANCE_MISMATCH",
          "Net payment did not equal stream earnings."
        );
      const result = {
        schemaVersion: 2,
        runId: id,
        mode: flags.pay ? "local-agent-stream" : "local-stream-preview",
        completedAt: new Date().toISOString(),
        provider: settings.provider,
        model: settings.model,
        chainId: Number(CHAIN_ID),
        token: USDC,
        tokenDecimals: 6,
        streamAddress,
        payer: wallet.address,
        recipient,
        fundedRaw: basic.fundedRaw || "0",
        earnedRaw: earned.toString(),
        refundedRaw: basic.refundedRaw || "0",
        initial,
        final,
        ...agent,
        donAuthenticated: false,
        strictGuardUsed: false,
        evidenceDirectory: path.relative(root, directory),
      };
      await save("result.json", result);
      output.finish(result);
      return result;
    } catch (error) {
      if (openedId && !closeAttempted) {
        closeAttempted = true;
        try {
          cleanup = await closeStream({
            provider,
            wallet,
            streamAddress: process.env.AGENTPAY_USDC_STREAM_ADDRESS,
            streamId: openedId,
            persist,
          });
          output.streamClosed(cleanup);
        } catch (closeError) {
          console.error(
            `Cleanup needs attention: stream #${openedId}. Inspect close.json, then use --close-stream ${openedId}.`
          );
          cleanup = {
            failed: true,
            message:
              closeError instanceof cli.CliError
                ? closeError.message
                : "RPC/transaction failure",
          };
        }
      }
      await save("failure.json", {
        failedAt: new Date().toISOString(),
        code: error.code || "OPERATION_FAILED",
        message:
          error instanceof cli.CliError
            ? error.message
            : "Stream demo failed; inspect evidence.",
        streamId: openedId || null,
        closeAttempted,
        cleanup,
      });
      output.failed(path.relative(root, directory));
      throw error;
    } finally {
      await appendFile(
        path.join(directory, "events.jsonl"),
        cli.redact(events.map((e) => JSON.stringify(e)).join("\n")) + "\n"
      );
      if (service) await service.close();
      provider.destroy();
    }
  }
);
