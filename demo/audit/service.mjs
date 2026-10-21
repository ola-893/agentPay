import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { toQuantity } from "ethers";
import { fileURLToPath } from "node:url";
import cli from "../../scripts/lib/cli.cjs";
import { digest } from "./journal.mjs";
export async function simulateIntent(provider, intent, block) {
  const base = {
    intentHash: digest(intent),
    blockNumber: block.number,
    blockHash: block.hash,
    returnData: "0x",
    gasEstimate: null,
    errorCode: null,
  };
  const tx = {
    from: intent.payer,
    to: intent.transaction.to,
    data: intent.transaction.data,
    value: toQuantity(BigInt(intent.transaction.value)),
  };
  try {
    if ((await provider.getBlock(block.number)).hash !== block.hash)
      throw new Error("Observation block changed");
    const returnData = await provider.send("eth_call", [
      tx,
      toQuantity(block.number),
    ]);
    const gas = await provider.send("eth_estimateGas", [
      tx,
      toQuantity(block.number),
    ]);
    if ((await provider.getBlock(block.number)).hash !== block.hash)
      throw new Error("Observation block changed");
    return {
      ...base,
      status: "success",
      returnData,
      gasEstimate: BigInt(gas).toString(),
    };
  } catch (error) {
    const reverted =
      error.code === "CALL_EXCEPTION" ||
      error.info?.error?.code === 3 ||
      /revert|execution reverted/i.test(
        error.shortMessage || error.message || ""
      );
    return {
      ...base,
      status: reverted ? "reverted" : "unavailable",
      errorCode: reverted ? "EVM_REVERT" : "RPC_UNAVAILABLE",
    };
  }
}
export async function startAuditService({ journal, provider }) {
  const token = randomBytes(8).toString("hex"),
    configs = new Map(),
    simulations = new Map();
  const server = createServer(async (req, res) => {
    const respond = (status, value) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.method !== "POST" || !req.url.startsWith(`/audit/${token}/`))
        return respond(404, { error: "Not found" });
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 100000) throw new Error("Request too large");
        chunks.push(chunk);
      }
      const value = JSON.parse(Buffer.concat(chunks).toString()),
        route = req.url.slice(`/audit/${token}`.length);
      if (route === "/simulate") {
        const c = configs.get(value.intentId);
        if (!c) throw new Error("Unregistered intent");
        if (!simulations.has(value.intentId))
          simulations.set(
            value.intentId,
            await simulateIntent(provider, c.intent, {
              number: c.observationBlock,
              hash: c.blockHash,
            })
          );
        return respond(200, simulations.get(value.intentId));
      }
      if (route === "/decisions") {
        const c = configs.get(value.intentId);
        if (
          !c ||
          value.intentHash !== c.intentHash ||
          value.type !== "spend-review"
        )
          throw new Error("Unknown decision");
        // Full policy re-evaluation happens before accepting the blob (including
        // writes made by a CRE child, not just its final stdout).
        if (
          digest(value.intent) !== c.intentHash ||
          value.observedBlock !== c.observationBlock ||
          value.blockHash !== c.blockHash ||
          digest(value.simulation) !== digest(simulations.get(value.intentId))
        )
          throw new Error("Observation substitution");
        const validation = await cli.runChild(
          "bun",
          [
            fileURLToPath(
              new URL("../../scripts/lib/validate-spend.ts", import.meta.url)
            ),
            JSON.stringify(c),
            JSON.stringify(value),
          ],
          { quiet: true }
        );
        if (validation.code !== 0)
          throw new Error("Decision contradicts policy");
        return respond(200, await journal.commit(value));
      }
      return respond(404, { error: "Not found" });
    } catch {
      respond(422, { error: "Audit validation/storage failed" });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}/audit/${token}`,
    register(c) {
      configs.set(c.intent.id, c);
    },
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
