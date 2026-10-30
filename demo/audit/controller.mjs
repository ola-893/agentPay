import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, open, unlink } from "node:fs/promises";
import { Contract } from "ethers";
import cli from "../../scripts/lib/cli.cjs";
import { LocalJournal, digest, durableWrite } from "./journal.mjs";
import { startAuditService, observeIntent } from "./service.mjs";
import { anchorPending, assertAnchored, verifyDeployment } from "./anchor.mjs";
import { checkPreSignSimulation } from "./presign.mjs";
import {runCreProcess,creFailure} from "../agent/cre-process.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const token = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
export async function createAuditor({
  provider,
  wallet,
  streamAddress,
  recipients,
  directory,
  anchorAddress,
  anchorEnabled = false,
  offline = false,
  onProgress = console.log,
  onReview = () => {},
  onReceipt = () => {},
}) {
  const journal = await new LocalJournal(directory).init();
  const lockFile = path.join(directory, "writer.lock");
  let lock;
  try {
    lock = await open(lockFile, "wx", 0o600);
  } catch {
    throw new Error(
      `Audit journal is locked; inspect ${lockFile} and confirm the old process has exited before removing a stale lock`
    );
  }
  await lock.writeFile(
    JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })
  );
  await lock.sync();
  let service;
  const runDirectory = path.join(directory, "runs");
  try {
    const recovered = await journal.recover();
    for (const id of recovered.pendingIntents) {
      const intent = await journal.intent(id);
      await journal.commit({
        schemaVersion: 1,
        type: "review-error",
        source: "host",
        intentId: id,
        intentHash: digest(intent),
        decision: {
          action: "ERROR",
          reason: "INTERRUPTED_BEFORE_DECISION",
          riskScore: 100,
        },
      });
    }
    if (anchorEnabled)
      await verifyDeployment(provider, anchorAddress, wallet.address);
    await mkdir(runDirectory, { recursive: true });
    service = await startAuditService({ journal, provider });
  } catch (error) {
    await lock.close();
    await unlink(lockFile);
    throw error;
  }
  const validate = async (config, record) => {
    const r = await cli.runChild(
      "bun",
      [
        path.join(root, "scripts/lib/validate-spend.ts"),
        JSON.stringify(config),
        ...(record ? [JSON.stringify(record)] : []),
      ],
      { quiet: true }
    );
    if (r.code !== 0)
      throw new Error("Spend review failed config/result validation");
  };
  const flush = async () => {
    if (!anchorEnabled) return [];
    const previous = new Set(
      (await journal.status()).batches
        .filter((b) => b.state === "anchored")
        .map((b) => b.root)
    );
    const batches = await anchorPending({
      journal,
      provider,
      wallet,
      address: anchorAddress,
    });
    for (const batch of batches)
      if (batch.state === "anchored" && !previous.has(batch.root))
        onReceipt(batch);
    return batches;
  };
  async function reviewTransaction(transaction, { qualityRiskScore = 0 } = {}) {
    const intent = {
      id: "0x" + randomBytes(32).toString("hex"),
      chainId: 11155111,
      payer: wallet.address,
      transaction: {
        to: transaction.to,
        data: transaction.data || "0x",
        value: BigInt(transaction.value || 0).toString(),
      },
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      policy: {
        token,
        streamAddress,
        recipients,
        maxAmountRaw: "10000",
        maxRiskScore: 49,
        qualityRiskScore,
        maxDurationSeconds: 3600,
      },
    };
    await journal.accept(intent);
    let pointer, record, config, invocation;
    try {
      const block = await provider.getBlock("latest");
      config = {
        intent,
        intentHash: digest(intent),
        observationBlock: block.number,
        blockHash: block.hash,
        serviceUrl: service.url,
      };
      service.register(config);
      await validate(config);
      const short = intent.id.slice(2, 14),
        file = path.join(root, ".local/sr", `${short}.json`);
      invocation = {
        command: `cre workflow simulate payment-guard --target spend-settings --trigger-index 0 --non-interactive --config ../../.local/sr/${short}.json`,
        cwd: "cre",
        configPath: path.relative(root, file),
        transcriptPath: path.relative(
          root,
          path.join(runDirectory, `${short}.log`)
        ),
      };
      await durableWrite(file, config);
      if (offline) {
        const simulation = await observeIntent(journal, provider, intent, block);
        const { evaluate } = await import(
          "../../cre/payment-guard/spend-policy.ts"
        );
        const asset = new Contract(
          token,
          [
            "function balanceOf(address) view returns(uint256)",
            "function decimals() view returns(uint8)",
          ],
          provider
        );
        const chain = {
          balanceRaw: (
            await asset.balanceOf(wallet.address, { blockTag: block.number })
          ).toString(),
          tokenDecimals: Number(
            await asset.decimals({ blockTag: block.number })
          ),
        };
        record = {
          schemaVersion: 1,
          type: "spend-review",
          source: "local-cre-simulation",
          donAuthenticated: false,
          intentId: intent.id,
          intentHash: config.intentHash,
          intent,
          observedBlock: block.number,
          blockHash: block.hash,
          simulation,
          chain,
          evaluatedAt: Math.floor(Date.now() / 1000),
          decision: evaluate(
            config,
            simulation,
            chain,
            Math.floor(Date.now() / 1000)
          ),
          policyVersion: "spend-risk-v1",
          expiresAt: intent.expiresAt,
        };
        await validate(config, record);
        record = { ...record, source: "local-policy-test" };
        pointer = await journal.commit(record);
      } else {
        const env = { ...process.env };
        for (const k of Object.keys(env))
          if (
            /(?:PRIVATE_KEY(?:_\d+)?|API_KEY|OPEN_AI_KEY|SECRET|PASSWORD|ACCESS_TOKEN|AUTH_TOKEN|RPC_URL)$/.test(
              k
            )
          )
            delete env[k];
        const args = [
          "workflow",
          "simulate",
          "payment-guard",
          "--target",
          "spend-settings",
          "--trigger-index",
          "0",
          "--non-interactive",
          "--config",
          path.relative(path.join(root, "cre/payment-guard"), file),
        ];
        onProgress(`CRE spend review: cre ${args.join(" ")}`);
        onReview({ phase: "start", invocation });
        const child = await runCreProcess({root,args,logFile:path.join(runDirectory,`${short}.log`),onProgress,options:{
          cwd: path.join(root, "cre"),
          env,
          quiet: true,
          timeoutMs: 180000,
        }});
        const log = child.log;
        const lines = log.split("\n"),
          index = lines.findIndex((s) =>
            s.includes("Workflow Simulation Result:")
          );
        if (index < 0) throw new Error("CRE_RESULT_MISSING");
        const outer = JSON.parse(lines.slice(index + 1).find((s) => s.trim())),
          result = typeof outer === "string" ? JSON.parse(outer) : outer;
        if (
          result.workflow !== "agentpay-spend-review" ||
          result.mode !== "local-simulation"
        )
          throw new Error("Wrong workflow result");
        record = result.record;
        await validate(config, record);
        pointer = result.stored;
        if (
          pointer.intentId !== intent.id ||
          pointer.blobHash !== digest(record) ||
          digest(await journal.blob(pointer.blobHash)) !== pointer.blobHash
        )
          throw new Error("Stored decision mismatch");
      }
    } catch (error) {
      // A process may fail after the workflow already fsynced a decision. Never
      // trust that ALLOW on failed execution; leave it unexecutable and journal
      // a distinct error event instead of overwriting immutable history.
      const previous = (await journal.entries()).find(
        (e) => e.intentId === intent.id
      );
      if (previous) {
        await journal.execution(intent.id, {
          state: "review-failed",
          error: "CRE_EXECUTION_OR_VALIDATION_FAILED",
        });
        const errorIntent = {
          ...intent,
          id: "0x" + randomBytes(32).toString("hex"),
        };
        await journal.accept(errorIntent);
        await journal.commit({
          schemaVersion: 1,
          type: "review-error",
          source: "host",
          intentId: errorIntent.id,
          intentHash: digest(errorIntent),
          relatedIntentId: intent.id,
          decision: {
            action: "ERROR",
            reason: "CRE_EXECUTION_OR_VALIDATION_FAILED",
            riskScore: 100,
          },
        });
        throw new Error("Spend review incomplete; no signing authorized");
      }
      record = {
        schemaVersion: 1,
        type: "review-error",
        source: "host",
        intentId: intent.id,
        intentHash: digest(intent),
        decision: {
          action: "ERROR",
          reason: "CRE_EXECUTION_OR_VALIDATION_FAILED",
          riskScore: 100,
        },
        errorCode: ["CRE_AUTH_REQUIRED","CRE_ACCOUNT_UNAVAILABLE"].includes(error.code) ? error.code : "REVIEW_UNAVAILABLE",
      };
      pointer = await journal.commit(record);
    }
    onProgress(
      `Spend ${record.decision.action}: ${record.decision.reason}; risk ${record.decision.riskScore}/100; blob ${pointer.blobHash}`
    );
    if (invocation && !offline)
      onReview({ phase: "result", invocation, record });
    return { intent, record, pointer };
  }
  async function authorize(transaction) {
    const review = await reviewTransaction(transaction);
    if (["CRE_AUTH_REQUIRED","CRE_ACCOUNT_UNAVAILABLE"].includes(review.record.errorCode))
      throw creFailure(review.record.errorCode,path.relative(root,path.join(runDirectory,`${review.intent.id.slice(2,14)}.log`)));
    if (review.record.decision.action === "ERROR" && review.record.simulation?.errorCode === "RPC_UNAVAILABLE")
      throw new cli.CliError("SPEND_RPC_UNAVAILABLE",`Spend dry-run unavailable after three read-only attempts at block ${review.record.observedBlock}. This transaction was not signed. Check RPC connectivity and inspect ${path.relative(root,path.join(directory,"simulation"))}.`);
    if (review.record.decision.action !== "ALLOW")
      throw new Error(
        `Spend ${review.record.decision.action}: ${review.record.decision.reason}`
      );
    const preSignChecks = [];
    let checkSequence = 0;
    const failed = async (error) => {
      const intent = {
        id: "0x" + randomBytes(32).toString("hex"),
        chainId: 11155111,
        payer: wallet.address,
        relatedIntentId: review.intent.id,
        preSignChecks: [...preSignChecks],
        errorCode: error instanceof cli.CliError ? error.code : "SIGNING_OR_EXECUTION_INCOMPLETE",
        type: "signing-or-execution-error",
      };
      await journal.accept(intent);
      await journal.commit({
        schemaVersion: 1,
        type: "execution-error",
        source: "host",
        intentId: intent.id,
        intentHash: digest(intent),
        relatedIntentId: review.intent.id,
        preSignChecks: intent.preSignChecks,
        errorCode: intent.errorCode,
        decision: {
          action: "ERROR",
          reason: "RECEIPT_SIGNING_OR_EXECUTION_INCOMPLETE",
          riskScore: 100,
        },
      });
    };
    try {
      if (!anchorEnabled)
        throw new Error("Actual signing requires onchain audit receipts");
      await flush();
      await assertAnchored(
        journal,
        provider,
        anchorAddress,
        review.pointer,
        wallet.address
      );
    } catch (error) {
      await failed(error);
      throw error;
    }
    const assertFresh = async (populated) => {
      if (
        populated &&
        (populated.to.toLowerCase() !==
          review.intent.transaction.to.toLowerCase() ||
          populated.data !== review.intent.transaction.data ||
          BigInt(populated.value || 0).toString() !==
            review.intent.transaction.value ||
          BigInt(populated.chainId) !== 11155111n)
      )
        throw new Error("Populated transaction differs from reviewed intent");
      if (
        populated &&
        BigInt(populated.gasLimit) *
          BigInt(populated.maxFeePerGas || populated.gasPrice || 0) >
          10000000000000000n
      )
        throw new Error(
          "Business transaction gas exposure exceeds 0.01 test ETH"
        );
      const assertIntent = () => {
        if (digest({
          to: transaction.to,
          data: transaction.data || "0x",
          value: BigInt(transaction.value || 0).toString(),
        }) !== digest(review.intent.transaction))
          throw new cli.CliError("PRESIGN_INTENT_CHANGED", "Spend intent changed; no signing authorized.");
        if (Math.floor(Date.now() / 1000) >= review.intent.expiresAt)
          throw new cli.CliError("PRESIGN_INTENT_EXPIRED", "Spend intent expired; no signing authorized.");
      };
      assertIntent();
      const status = await journal.status();
      if (status.pendingIntents.includes(review.intent.id))
        throw new Error("Audit decision missing");
      await journal.blob(review.pointer.blobHash);
      const check = ++checkSequence;
      const simulation = await checkPreSignSimulation({
        provider, intent: review.intent, assertIntent,
        onRetry: attempt => onProgress(`Final simulation RPC unavailable; read-only check ${attempt}/3. This transaction is not signed.`),
        onAttempt: async attempt => {
          const record = {schemaVersion: 1, intentId: review.intent.id, intentHash: review.record.intentHash, check, ...attempt};
          const name = `${review.intent.id}-check-${check}-attempt-${attempt.attempt}`;
          await durableWrite(journal.file("presign", name), record, true);
          preSignChecks.push({file:`presign/${name}.json`, hash:digest(record)});
        },
      }).catch(error => {
        if (error instanceof cli.CliError)
          error.message += ` Inspect ${path.relative(root, path.join(directory, "presign"))} for saved diagnostics.`;
        throw error;
      });
      if (
        ["approve", "transfer"].includes(review.record.decision.operation) &&
        simulation.returnData !== "0x" + "0".repeat(63) + "1"
      )
        throw new Error("Fresh token return is not true");
    };
    try {
      await assertFresh();
    } catch (error) {
      await failed(error);
      throw error;
    }
    return {
      ...review,
      assertFresh,
      failed,
      async submitted(hash) {
        await journal.execution(review.intent.id, {
          state: "submitting",
          transactionHash: hash,
        });
      },
      async confirmed(hash) {
        await journal.execution(review.intent.id, {
          state: "confirmed",
          transactionHash: hash,
        });
      },
    };
  }
  async function recordPolicy(kind, result) {
    const intent = {
      id: "0x" + randomBytes(32).toString("hex"),
      chainId: 11155111,
      payer: wallet.address,
      kind,
      resultHash: digest(result),
    };
    await journal.accept(intent);
    return journal.commit({
      schemaVersion: 1,
      type: "policy-decision",
      source: "local-cre-simulation",
      donAuthenticated: false,
      intentId: intent.id,
      intentHash: digest(intent),
      kind,
      evidence: result,
      decision: {
        action:
          result.action === "DENY" || result.approved === false
            ? "BLOCK"
            : "ALLOW",
        reason: result.reason || kind,
      },
    });
  }
  return {
    journal,
    reviewTransaction,
    authorize,
    recordPolicy,
    flush,
    close: async () => {
      try {
        await service.close();
      } finally {
        await lock.close();
        await unlink(lockFile);
      }
    },
    async summary() {
      const status = await journal.status();
      return {
        directory,
        decisions: status.entries.length,
        pendingIntents: status.pendingIntents.length,
        pendingReceipts: status.pendingReceipts.length,
        receiptTransactions: status.batches
          .filter((b) => b.state === "anchored")
          .map((b) => b.transactionHash),
        receipts: status.batches,
      };
    },
  };
}
