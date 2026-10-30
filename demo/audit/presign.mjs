import cli from "../../scripts/lib/cli.cjs";
import { simulateIntent } from "./service.mjs";

// Only read-only RPC availability failures can be retried. EVM reverts,
// changed blocks, expired intent and failed evidence writes stop immediately.
export async function checkPreSignSimulation({ provider, intent, assertIntent,
  onAttempt = async () => {}, onRetry = () => {},
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    assertIntent();
    let block, observation, failure;
    try { block = await provider.getBlock("latest"); }
    catch { failure = { operation: "block-read", errorCode: "RPC_UNAVAILABLE", rpcCode: null, providerCode: "RPC_ERROR" }; }
    if (!block) failure ||= { operation: "block-read", errorCode: "RPC_UNAVAILABLE", rpcCode: null, providerCode: "BAD_DATA" };
    else observation = await simulateIntent(provider, intent, block, {onFailure: value => { failure = value; }});
    await onAttempt({attempt, checkedAt: new Date().toISOString(),
      observation: observation || null, failure: failure || null});
    assertIntent();
    if (observation?.status === "success") return observation;
    const errorCode = observation?.errorCode || failure?.errorCode;
    if (errorCode === "RPC_UNAVAILABLE" && attempt < 3) {
      onRetry(attempt + 1);
      await wait(200 * attempt);
      continue;
    }
    const operation = failure?.operation || "simulation";
    throw new cli.CliError(
      errorCode === "EVM_REVERT" ? "PRESIGN_SIMULATION_REVERTED" :
        errorCode === "BLOCK_CHANGED" ? "PRESIGN_BLOCK_CHANGED" : "PRESIGN_RPC_UNAVAILABLE",
      `Final pre-sign simulation ${errorCode === "EVM_REVERT" ? "reverted" : errorCode === "BLOCK_CHANGED" ? "observed a changed block" : "was unavailable"} (${operation}; ${attempt} read-only attempt${attempt === 1 ? "" : "s"}). This transaction was not signed.`
    );
  }
}
