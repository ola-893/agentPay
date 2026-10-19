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
import { callModel, modelSettings, runAgent } from "./agent/model.mjs";
import { runCreIntent } from "./agent/cre.mjs";
import {
  CHAIN_ID,
  USDC,
  TIERS,
  validateQuote,
  startResearchService,
  snapshotWallet,
  sendLocalPayment,
} from "./agent/payments.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
await cli.cliMain(
  "demo:agent",
  { pay: "boolean" },
  `Usage: npm run --silent demo:agent -- [--pay] [--json] [--help]
Real AI tool-calling agent -> paid resource quote -> local CRE USDC policy -> receipt-verified resource.
Default: real model + CRE preview; never signs or transfers tokens and does not unlock paid content.
--pay   Transfer at most 0.01 Circle test USDC on Sepolia for basic research; premium must be denied.
        Each new --pay run can spend 0.01 test USDC plus test ETH for gas. No automatic payment retry.
--json  One result envelope on stdout; progress on stderr. Evidence stays under .local/agent-demo/runs/.
Requires QWEN_API_KEY or OPENAI_API_KEY (OPEN_AI_KEY alias accepted), PRIVATE_KEY_1 or PRIVATE_KEY,
AGENTPAY_AGENT_RECIPIENT (CRE_PAYMENT_RECIPIENT_ADDRESS alias accepted), CRE CLI, Bun and network access.
AGENTPAY_AI_PROVIDER selects qwen or openai. Qwen is selected when its key is configured, otherwise OpenAI.
QWEN_MODEL defaults to qwen3.5-plus; QWEN_REGION defaults to singapore. OPENAI_MODEL defaults to gpt-4.1-mini.
Model API calls may incur usage charges; there is no heuristic or silent provider fallback.
The wallet enforces the local CRE result. This is not DON authentication, strict-guard settlement, or full x402.
--help  No credentials, model calls, network or transactions.
Exit: 0 both tool-backed journeys complete; 1 API/policy/payment/verification failure; 2 usage/config error.`,
  async ({ flags }) => {
    dotenv.config({ path: path.join(root, ".env"), quiet: true });
    const settings = modelSettings(process.env);
    const { model } = settings;
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
    const recipient =
      process.env.AGENTPAY_AGENT_RECIPIENT ||
      process.env.CRE_PAYMENT_RECIPIENT_ADDRESS;
    if (
      !recipient ||
      !isAddress(recipient) ||
      recipient === ZeroAddress ||
      same(recipient, signer.address) ||
      same(recipient, USDC)
    )
      throw new cli.CliError(
        "CONFIG",
        "Set AGENTPAY_AGENT_RECIPIENT to a nonzero recipient different from the payer and USDC token.",
        2
      );
    const rpcUrl =
      process.env.SEPOLIA_RPC_URL ||
      "https://ethereum-sepolia-rpc.publicnode.com";
    try {
      if (!["https:", "http:"].includes(new URL(rpcUrl).protocol))
        throw new Error();
    } catch {
      throw new cli.CliError("CONFIG", "SEPOLIA_RPC_URL must be HTTP(S).", 2);
    }
    const request = new FetchRequest(rpcUrl);
    request.timeout = 15000;
    const provider = new JsonRpcProvider(request, undefined, {
      batchMaxCount: 1,
      cacheTimeout: -1,
    });
    const wallet = signer.connect(provider);
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(
      4
    ).toString("hex")}`;
    const directory = path.join(root, ".local/agent-demo/runs", id);
    await mkdir(directory, { recursive: true });
    const save = (name, value) =>
      writeFile(
        path.join(directory, name),
        cli.redact(JSON.stringify(value, null, 2)) + "\n"
      );
    const events = [];
    const event = (data) => {
      const row = { at: new Date().toISOString(), ...data };
      events.push(row);
    };
    let service;
    let paidRaw = 0n;
    let paymentStarted = false;
    try {
      if ((await provider.getNetwork()).chainId !== CHAIN_ID)
        throw new cli.CliError(
          "WRONG_NETWORK",
          "Agent demo requires Ethereum Sepolia."
        );
      const initial = await snapshotWallet(provider, wallet.address, recipient);
      if (
        flags.pay &&
        (BigInt(initial.agentBalanceRaw) < 10000n ||
          (await provider.getBalance(wallet.address)) === 0n)
      )
        throw new cli.CliError(
          "BALANCE",
          "Fund the demo payer with 0.01 Circle test USDC and Sepolia ETH."
        );
      const base = JSON.parse(
        await readFile(
          path.join(root, "cre/payment-guard/config.staging.json"),
          "utf8"
        )
      );
      service = await startResearchService({
        provider,
        agent: wallet.address,
        recipient,
      });
      console.log(
        `AI agent: ${settings.provider}/${model}; ${
          flags.pay
            ? "Sepolia payment enabled (maximum 0.01 USDC)"
            : "preview only (no token transfer)"
        }.`
      );
      console.log(`Payer: ${wallet.address}; recipient: ${recipient}.`);
      console.log(
        `Research service: ${service.url}; per-request CRE cap: 0.1 USDC.`
      );
      const purchase = async ({ tier, purpose }) => {
        console.log(`Agent tool: buy_research(${tier}) — ${purpose}`);
        const endpoint = `${service.url}/research/${tier}`;
        const quoteResponse = await fetch(endpoint, {
          signal: AbortSignal.timeout(20000),
        });
        if (quoteResponse.status !== 402)
          throw new cli.CliError(
            "SERVICE_PROTOCOL",
            "Expected an HTTP 402 resource quote."
          );
        const { quote, protocol } = await quoteResponse.json();
        if (protocol !== "agentpay-demo-receipt-v1")
          throw new cli.CliError(
            "SERVICE_PROTOCOL",
            "Unexpected research-service protocol."
          );
        validateQuote(quote, { tier, agent: wallet.address, recipient });
        console.log(
          `Service quote: ${tier} costs ${
            tier === "basic" ? "0.01" : "0.2"
          } USDC. Running CRE locally...`
        );
        const config = {
          ...base,
          receiverAddress: ZeroAddress,
          publishReport: false,
          request: {
            ...base.request,
            requestId: quote.id,
            agent: wallet.address,
            recipient,
            token: USDC,
            amount: quote.amount,
            spendingCap: "100000",
          },
        };
        const before = await snapshotWallet(
          provider,
          wallet.address,
          recipient
        );
        const evidence = await runCreIntent({ config, root, directory, tier });
        const completedAt = performance.now();
        const decision = evidence.result;
        console.log(
          `CRE ${decision.approved ? "ALLOW" : "DENY"}: ${decision.reason}.`
        );
        const policy = {
          approved: decision.approved,
          reason: decision.reason,
          requestId: quote.id,
          tokenSymbol: "USDC",
          tokenDecimals: 6,
          amountRaw: quote.amount,
          amountUsdc: formatUnits(quote.amount, 6),
          capRaw: "100000",
          capUsdc: "0.1",
          chainlinkPriceUsd8: decision.chainlinkPriceUsd8,
          externalPriceUsd8: decision.externalPriceUsd8,
        };
        if (!decision.approved) {
          const after = await snapshotWallet(
            provider,
            wallet.address,
            recipient
          );
          if (JSON.stringify(before) !== JSON.stringify(after))
            throw new cli.CliError(
              "DENY_VERIFICATION",
              "Wallet state changed during the denied request; inspect evidence."
            );
          const result = {
            status: "denied",
            tier,
            policy,
            noTransactionSigned: true,
            before,
            after,
          };
          await save(`${tier}.json`, result);
          return result;
        }
        if (tier !== "basic" || quote.amount !== TIERS.basic)
          throw new cli.CliError(
            "UNEXPECTED_POLICY",
            "An over-budget quote was not denied; no payment will be sent."
          );
        if (!flags.pay) {
          const result = {
            status: "preview",
            tier,
            policy,
            paymentSent: false,
            resourceUnlocked: false,
          };
          await save(`${tier}.json`, result);
          return result;
        }
        if (paymentStarted)
          throw new cli.CliError(
            "PAYMENT_REPLAY",
            "A payment was already attempted in this run. Automatic retry is disabled."
          );
        paymentStarted = true;
        const payment = await sendLocalPayment({
          provider,
          wallet,
          quote,
          evidence,
          config,
          elapsed: () => performance.now() - completedAt,
          paidRaw,
          persist: (data) => save("payment.json", data),
        });
        paidRaw += BigInt(quote.amount);
        console.log(
          `Confirmed USDC transfer: https://sepolia.etherscan.io/tx/${payment.receipt.transactionHash}`
        );
        const paidResponse = await fetch(endpoint, {
          headers: { "x-agentpay-payment-tx": payment.receipt.transactionHash },
          signal: AbortSignal.timeout(20000),
        });
        const resource = await paidResponse.json();
        if (
          paidResponse.status !== 200 ||
          resource.receipt?.transactionHash !==
            payment.receipt.transactionHash ||
          resource.research?.quoteId !== quote.id
        )
          throw new cli.CliError(
            "SERVICE_VERIFICATION",
            "Payment was confirmed, but the paid resource was not verified. Do not pay again automatically."
          );
        const result = {
          status: "purchased",
          tier,
          policy,
          payment,
          research: resource.research,
        };
        await save(`${tier}.json`, result);
        return result;
      };
      const agent = await runAgent({
        model,
        modelCall: (args) => callModel({ ...args, ...settings }),
        purchase,
        onEvent: (data) => {
          event(data);
          if (data.type === "model_response")
            console.log(
              `${settings.provider} response: ${data.id} (${data.model}).`
            );
        },
      });
      if (
        agent.purchases.premium?.status !== "denied" ||
        agent.purchases.premium.policy.reason !== "AMOUNT_EXCEEDS_POLICY" ||
        agent.purchases.basic?.status !== (flags.pay ? "purchased" : "preview")
      )
        throw new cli.CliError(
          "DEMO_INCOMPLETE",
          "Both expected end-to-end outcomes were not established."
        );
      const final = await snapshotWallet(provider, wallet.address, recipient);
      if (
        BigInt(final.recipientBalanceRaw) -
          BigInt(initial.recipientBalanceRaw) !==
        paidRaw
      )
        throw new cli.CliError(
          "BALANCE_MISMATCH",
          "Final recipient increase differs from the run payment total."
        );
      const result = {
        schemaVersion: 1,
        runId: id,
        mode: flags.pay ? "local-agent-payment" : "local-agent-preview",
        completedAt: new Date().toISOString(),
        provider: settings.provider,
        model,
        chainId: Number(CHAIN_ID),
        token: USDC,
        tokenDecimals: 6,
        payer: wallet.address,
        recipient,
        paidRaw: paidRaw.toString(),
        initial,
        final,
        ...agent,
        donAuthenticated: false,
        strictGuardUsed: false,
        evidenceDirectory: path.relative(root, directory),
      };
      await save("result.json", result);
      console.log(`\nAgent summary (model-generated):\n${agent.summary}`);
      console.log(
        `\nVerified outcome: basic ${result.purchases.basic.status}; premium denied; recipient increase ${paidRaw} raw USDC units.`
      );
      console.log(`Evidence: ${result.evidenceDirectory}`);
      return result;
    } catch (error) {
      await save("failure.json", {
        failedAt: new Date().toISOString(),
        code: error.code || "OPERATION_FAILED",
        message:
          error instanceof cli.CliError
            ? error.message
            : "Agent demo failed. Inspect the local run artifacts.",
        paidRaw: paidRaw.toString(),
        paymentStarted,
      });
      throw error;
    } finally {
      await appendFile(
        path.join(directory, "events.jsonl"),
        cli.redact(events.map((x) => JSON.stringify(x)).join("\n")) + "\n"
      );
      if (service) await service.close();
      provider.destroy();
    }
  }
);
