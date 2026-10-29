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
import { startPolicyClient } from "./policy/client.mjs";
import { watchInterruption } from "./agent/interruption.mjs";
import { cleanupFundedStream } from "./agent/cleanup.mjs";
import { modelSettings, callModel, runAgent } from "./agent/model.mjs";
import { runCreIntent, runStreamCheck } from "./agent/cre.mjs";
import { assertLocalApproval } from "./agent/payments.mjs";
import { loadProfile } from "./agent/profile.mjs";
import { createRunEvents, eventOutput, runSummary } from "./agent/events.mjs";
import { createAgentOutput } from "./agent/output.mjs";
import { createAuditor } from "./audit/controller.mjs";
import {
  USDC,
  CHAIN_ID,
  TIERS,
  verifyStreamDeployment,
  isGuardedStream,
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
const help = `AgentPay / Deterministic CRE payment guardrails

Usage
  npm run --silent demo:agent -- [--pay] [--verbose] [--json] [--help]
  npm run --silent demo:agent -- --close-stream <id> [--json]

The agent proposes. CRE checks fixed rules. The CLI executes eligible actions.
Default: real AI + deterministic local CRE admission preview; no signing or funding.
--pay      Deposit at most 0.01 Circle test USDC into a Sepolia stream.
           Reuse it for 10 requests, demonstrate CONTINUE, inject a demo outage,
           then cancel: earned funds go to the recipient and unused funds refund.
           A new paid run can fund another stream and uses test ETH for gas.
--close-stream <id>  Legacy stream recovery. Guarded recovery uses recover:guarded-stream.
--verbose  Add response IDs, CRE evidence hashes and unverified model text.
--json     One result envelope on stdout; plain progress on stderr.
--help     No credentials, API calls, network or transactions.

Set QWEN_API_KEY or OPENAI_API_KEY (OPEN_AI_KEY alias accepted), PRIVATE_KEY_1
or PRIVATE_KEY, AGENTPAY_AGENT_RECIPIENT (CRE_PAYMENT_RECIPIENT_ADDRESS alias),
and AGENTPAY_USDC_STREAM_ADDRESS in ignored root .env. Current guarded runs also
need the matching ignored operator policy-key file; a new wallet cannot use the
registered deployment. Legacy recovery needs CRE/audit; guarded recovery uses
the separate recover:guarded-stream operator command without CRE. Compile contracts
with npx hardhat compile. Requires CRE CLI, Bun and network access.
Qwen is selected when its key is present; AGENTPAY_AI_PROVIDER overrides this.
Defaults: QWEN_MODEL=qwen3.5-plus, QWEN_REGION=singapore,
OPENAI_MODEL=gpt-4.1-mini. Model calls may incur charges; no model/rules fallback.

CRE uses deterministic rules for price, health, session, budget and rate checks.
Model-generated text is not payment authorization. The CLI reuses validated sessions
and follows checked lifecycle outcomes to reduce avoidable spending.
CRE commands, observed inputs, policy limits and transcript paths are shown.
Every business transaction requires dry-run, risk review, durable blob and receipt.
Preview logs decisions locally without signing; --pay also spends audit gas.
CRE stays local. CLI checks gate wallet signing; the contract enforces escrow
accounting. Guarded streams also verify local policy signatures; no DON authorization or full
x402. Stream earnings accrue until the
cancellation transaction is mined. No automatic repeat funding on uncertainty.
--profile <file>  Registered local profile with bounded existing policy fields.
--events ndjson   Versioned public events on stdout; human progress on stderr.
                  Incompatible with --json and --close-stream.
SIGINT/SIGTERM stop at safe boundaries and request signed shutdown cleanup.
CRE/signer failure or an uncertain transaction requires separate operator recovery.
Evidence: .local/agent-demo/runs/. Exit: 0 complete / 1 failed / 2 config or usage / 130 or 143 interrupted.`;
await cli.cliMain(
  "demo:agent",
  {
    pay: "boolean",
    verbose: "boolean",
    "close-stream": "value",
    events: "value",
    profile: "value",
  },
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
    if (
      flags.events &&
      (flags.events !== "ndjson" || flags.json || flags["close-stream"])
    )
      throw new cli.CliError(
        "USAGE",
        "Use --events ndjson without --json or --close-stream.",
        2
      );
    dotenv.config({ path: path.join(root, ".env"), quiet: true });
    let profile;
    try {
      profile = await loadProfile(flags.profile);
    } catch {
      throw new cli.CliError(
        "CONFIG",
        "Invalid registered agent profile or policy bounds.",
        2
      );
    }
    const policy = profile.policy;
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
      cleanup, fundedContext, check;
    let auditor, policyClient, guarded = false;
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
    const emit = createRunEvents({
      runId: id,
      directory,
      ndjson: flags.events === "ndjson",
    });
    const humanOutput = createAgentOutput({
      pay: flags.pay,
      json: Boolean(flags.json || flags.events),
      verbose: flags.verbose,
    });
    humanOutput.payMode = flags.pay ? "pay" : "preview";
    const output = eventOutput(humanOutput, emit, profile),
      events = [];
    const interruption = watchInterruption(process, signal =>
      console.error(`${signal}: stopping at the next safe boundary; submitted transactions will be inspected before cleanup.`));
    let started = false,
      initialSnapshot;
    const persist = async (kind, data) => {
      await save(`${kind}.json`, data);
      if (kind === "open" && data.streamId) openedId = data.streamId;
      if (kind === "close" && data.state === "submitting") closeAttempted = true;
      if (
        ["approval", "open", "close"].includes(kind) &&
        ["submitting", "confirmed"].includes(data.state)
      )
        emit("wallet.tx", {
          kind,
          hash: data.transactionHash,
          explorerUrl: `https://sepolia.etherscan.io/tx/${data.transactionHash}`,
          status: data.state,
          ...(data.streamId ? { streamId: data.streamId } : {}),
        });
      if (data.state === "submitting") output.streamTransaction(kind, data);
    };
    try {
      const streamAddress = process.env.AGENTPAY_USDC_STREAM_ADDRESS;
      await verifyStreamDeployment(provider, streamAddress);
      guarded = await isGuardedStream(provider, streamAddress);
      if (flags.pay && !guarded) throw new cli.CliError("GUARDED_DEPLOYMENT_REQUIRED", "Paid agent runs require AgentPayGuardedStream. Deploy with npm run deploy:guarded-stream; legacy recovery remains available.");
      if (guarded && flags["close-stream"]) throw new cli.CliError("OPERATOR_RECOVERY_REQUIRED", "Guarded recovery uses the separate operator key: npm run recover:guarded-stream -- --stream-id " + flags["close-stream"], 2);
      let journalDeployment;
      try {
        journalDeployment = JSON.parse(
          await readFile(
            path.join(root, "docs/deployment/decision-journal.json"),
            "utf8"
          )
        );
      } catch {}
      const auditRecipient =
        process.env.AGENTPAY_AGENT_RECIPIENT ||
        process.env.CRE_PAYMENT_RECIPIENT_ADDRESS ||
        wallet.address;
      auditor = await createAuditor({
        provider,
        wallet,
        streamAddress,
        recipients: [auditRecipient],
        directory:
          process.env.AGENTPAY_AUDIT_DIR ||
          path.join(root, ".local/audit", wallet.address.toLowerCase()),
        anchorAddress:
          process.env.AGENTPAY_DECISION_JOURNAL_ADDRESS ||
          journalDeployment?.address,
        anchorEnabled: Boolean(flags.pay || flags["close-stream"]),
        onProgress: (line) => console.log(`  ${line}`),
        onReview: (event) => {
          if (event.phase === "start")
            emit("step.start", {
              label: "Dry-running and risk-scoring spend",
              stage: "cre",
              ...event.invocation,
            });
          else
            emit("cre.result", {
              target: "spend",
              ...event.invocation,
              observations: event.record,
              decision: event.record.decision.action,
              reason: event.record.decision.reason,
              hostCheck: event.record.type === "spend-review",
              source: event.record.source,
            });
        },
        onReceipt: (batch) =>
          emit("audit.receipt", {
            hash: batch.transactionHash,
            root: batch.root,
            count: batch.entries.length,
            blockNumber: batch.blockNumber,
          }),
      });
      if (flags["close-stream"]) {
        const result = await closeStream({
          provider,
          wallet,
          streamAddress,
          streamId: flags["close-stream"],
          persist,
          audit: auditor,
        });
        await auditor.flush();
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
        return {
          ...result,
          audit: await auditor.summary(),
          evidenceDirectory: path.relative(root, directory),
        };
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
      initialSnapshot = initial;
      const sessionId = "0x" + randomBytes(32).toString("hex");
      service = await startStreamService({
        provider,
        agent: wallet.address,
        recipient,
        streamAddress,
        sessionId,
      });
      if (guarded) policyClient = await startPolicyClient({root,directory,policy,streamAddress,serviceOrigin:service.url,onInvocation:invocation=>output.creInvocation(invocation)});
      output.start({
        settings,
        payer: wallet.address,
        recipient,
        balanceRaw: initial.agentBalanceRaw,
        ethBalanceRaw: (await provider.getBalance(wallet.address)).toString(),
        guarded,
      });
      started = true;
      output.streamContract(streamAddress);
      check = async (q, phase, label, client, streamId = "0") => {
        if (phase !== "shutdown") interruption.assertRunning();
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
          spendingCapRaw: policy.depositCapRaw,
          durationSeconds: q.durationSeconds,
          maxRateRawPerSecond: policy.maxRateRawPerSecond,
          phase,
          streamId,
          observationBlock: await provider.getBlockNumber(),
          healthUrl: snapshot.url,
          expectedHealth: snapshot.health,
          client: { ...client },
          maxFailedRequests: policy.maxFailedRequests,
        };
        output.streamChecking(label);
        const evidence = policyClient ? await policyClient.stream({config,label}) : await runStreamCheck({
          config,
          root,
          directory,
          label,
          onStart: (invocation) => output.creInvocation(invocation),
        });
        output.streamEvidence(evidence);
        await auditor.recordPolicy(`stream-${label}`, evidence.result);
        if (phase !== "shutdown") interruption.assertRunning();
        return { config, decision: evidence.result };
      };
      const purchase = async ({ tier, purpose }) => {
        interruption.assertRunning();
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
        let checkPrice = async () => {};
        if (tier === "basic") {
          const base = JSON.parse(
            await readFile(
              path.join(root, "cre/payment-guard/config.staging.json"),
              "utf8"
            )
          );
          const config = {
            ...base,
            maxPegDeviationBps: policy.maxPegDeviationBps,
            maxDeviationBps: policy.maxDeviationBps,
            maxFeedAgeSeconds: policy.maxFeedAgeSeconds,
            publishReport: false,
            receiverAddress: ZeroAddress,
            request: {
              ...base.request,
              requestId: q.id,
              agent: wallet.address,
              recipient,
              token: USDC,
              amount: q.amountRaw,
              spendingCap: policy.depositCapRaw,
            },
          };
          checkPrice = async (label = "price") => {
            interruption.assertRunning();
            output.streamChecking("USDC price safety");
            const price = policyClient ? await policyClient.price({config,label}) : await runCreIntent({
              config,
              root,
              directory,
              tier: label,
              onStart: (invocation) => output.creInvocation(invocation),
            });
            output.priceEvidence(price);
            await auditor.recordPolicy("price", price.result);
            interruption.assertRunning();
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
          };
          await checkPrice();
        }
        const before = await snapshotWallet(
          provider,
          wallet.address,
          recipient
        );
        let admission = await check(
            q,
            "admission",
            tier === "basic" ? "open" : "deny",
            client
          ),
          completedAt = performance.now();
        let refreshes = 0;
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
              capRaw: policy.depositCapRaw,
              capUsdc: formatUnits(policy.depositCapRaw, 6),
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
        fundedContext = { quote: q, client };
        const funded = await openStream({
          provider,
          wallet,
          quote: q,
          ...admission,
          elapsed: () => performance.now() - completedAt,
          persist,
          additionalGate: () => { interruption.assertRunning(); priceGate(); },
          refreshAdmission: async () => {
            const label = `renew-${++refreshes}`;
            console.log(
              "  Admission expired during setup; refreshing CRE price and stream checks before signing."
            );
            await checkPrice(label);
            admission = await check(q, "admission", label, client);
            completedAt = performance.now();
            return {
              ...admission,
              elapsed: () => performance.now() - completedAt,
            };
          },
          audit: auditor,
          authorizePolicy: policyClient ? requestId => policyClient.permit(requestId) : undefined,
        });
        output.streamOpened(funded);
        interruption.assertRunning();
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
            interruption.assertRunning();
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
          output.streamRequests(client, funded.streamId, {
            walletNonceBefore: beforeNonce,
            walletNonceAfter: beforeNonce,
            hostCheckedNoPaymentTransactions: true,
          });
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
            `Healthy checkpoint returned ${healthy.decision.action}; cleanup will request signed closure.`
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
        const closeApproval = policyClient ? await policyClient.permit(outage.config.requestId) : undefined;
        const settled = await closeStream({
          provider,
          wallet,
          streamAddress,
          streamId: funded.streamId,
          persist,
          policyApproval: closeApproval,
          audit: auditor,
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
          interruption.assertRunning();
          output.thinking(args.complete);
          return callModel({ ...args, ...settings });
        },
        purchase,
        onEvent: (data) => {
          events.push({ at: new Date().toISOString(), ...data });
          if (data.type === "model_response") output.response(data);
        },
      });
      interruption.assertRunning();
      if (
        agent.purchases.premium?.status !== "denied" ||
        agent.purchases.premium.policy.reason !== "AMOUNT_EXCEEDS_POLICY" ||
        ![flags.pay ? "stream-completed" : "preview", "denied"].includes(
          agent.purchases.basic?.status
        )
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
        contractPolicySignatures: guarded,
        evidenceDirectory: path.relative(root, directory),
      };
      await auditor.flush();
      result.audit = await auditor.summary();
      await save("result.json", result);
      output.finish(result);
      emit(
        "run.end",
        runSummary(result, basic.status === "denied" ? "denied" : "completed")
      );
      return result;
    } catch (error) {
      // An in-flight RPC/model/child may fail while a stop is pending. Preserve
      // the requested interruption status while still checking funded cleanup.
      try { interruption.assertRunning(); } catch (stop) { error = stop; }
      if (started && !openedId && error.code === "PRICE_POLICY_DENIED") {
        try {
          const final = await snapshotWallet(
            provider,
            wallet.address,
            process.env.AGENTPAY_AGENT_RECIPIENT ||
              process.env.CRE_PAYMENT_RECIPIENT_ADDRESS
          );
          if (JSON.stringify(final) !== JSON.stringify(initialSnapshot))
            throw new Error("Wallet changed during price denial");
          await auditor.flush();
          const denied = {
            schemaVersion: 2,
            runId: id,
            status: "denied",
            fundedRaw: "0",
            earnedRaw: "0",
            refundedRaw: "0",
            initial: initialSnapshot,
            final,
            reason: error.message,
          };
          await save("result.json", denied);
          console.log(
            "  DENIED / price policy stopped funding; no business transaction signed."
          );
          emit("run.end", runSummary(denied, "denied"));
          return denied;
        } catch (denialError) {
          // Verification/storage failures are execution failures, not policy DENY.
          error = denialError;
        }
      }
      if (started)
        emit("error", {
          code: error instanceof cli.CliError ? error.code : "OPERATION_FAILED",
          message:
            "Run did not complete. Inspect the local CLI evidence before retrying a payment.",
        });
      if (openedId && !closeAttempted) {
        closeAttempted = true;
        emit("cleanup", { status: "attempting", streamId: openedId });
        try {
          cleanup = await cleanupFundedStream({
            provider,
            wallet,
            streamAddress: process.env.AGENTPAY_USDC_STREAM_ADDRESS,
            streamId: openedId,
            quote: fundedContext.quote,
            guarded,
            authorizeClose: guarded ? async () => {
              const shutdown = await check(fundedContext.quote, "shutdown", "cleanup", fundedContext.client, openedId);
              if (shutdown.decision.action !== "CLOSE" || shutdown.decision.reason !== "CLIENT_SHUTDOWN")
                throw new cli.CliError("CLEANUP_POLICY", "Expected a matching CLIENT_SHUTDOWN approval; inspect the stream before recovery.");
              return policyClient.permit(shutdown.config.requestId);
            } : undefined,
            persist,
            audit: auditor,
          });
          output.streamClosed(cleanup);
          emit("cleanup", { status: "closed", streamId: openedId });
        } catch (closeError) {
          console.error(
            `Cleanup needs attention: stream #${openedId}. Inspect close.json, then use ${guarded ? "npm run recover:guarded-stream -- --stream-id" : "--close-stream"} ${openedId}.`
          );
          emit("cleanup", { status: "needs-attention", streamId: openedId });
          cleanup = {
            failed: true,
            message:
              closeError instanceof cli.CliError
                ? closeError.message
                : "RPC/transaction failure",
          };
        }
      }
      if (auditor) {
        try {
          await auditor.flush();
        } catch {
          console.error(
            "Audit receipt still pending; inspect the durable journal before retrying."
          );
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
        audit: auditor ? await auditor.summary() : null,
      });
      output.failed(path.relative(root, directory));
      if (started)
        emit("run.end", {
          ...runSummary({}, "failed"),
          fundedRaw: openedId ? "10000" : "0",
          earnedRaw: cleanup?.closed ? cleanup.earnedRaw : null,
          refundedRaw: cleanup?.closed ? cleanup.refundedRaw : null,
          amountsVerified: false,
          streamId: openedId || null,
          cleanup: cleanup?.closed
            ? "closed"
            : openedId
            ? "inspect-receipts"
            : "not-funded",
        });
      throw error;
    } finally {
      interruption.dispose();
      policyClient?.close();
      await appendFile(
        path.join(directory, "events.jsonl"),
        cli.redact(events.map((e) => JSON.stringify(e)).join("\n")) + "\n"
      );
      if (service) await service.close();
      if (auditor) await auditor.close();
      provider.destroy();
    }
  }
);
