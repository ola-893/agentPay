export type Decision =
  | "ALLOW"
  | "DENY"
  | "OPEN"
  | "CONTINUE"
  | "CLOSE"
  | "BLOCK"
  | "ERROR";
export interface AgentProfile {
  id: string;
  name: string;
  registration: "local-profile";
  payer: string;
  recipient: string;
  token: string;
  escrow: string;
  chainId: 11155111;
  quote: {
    amountRaw: string;
    premiumAmountRaw: string;
    durationSeconds: number;
  };
  policy: {
    depositCapRaw: string;
    maxRateRawPerSecond: string;
    maxPegDeviationBps: number;
    maxDeviationBps: number;
    maxFeedAgeSeconds: number;
    maxFailedRequests: number;
  };
}
export interface EventData {
  "run.start": {
    mode: "preview" | "pay";
    profile: AgentProfile;
    planner: string;
    payer: string;
    recipient: string;
    balances: { payerUsdcRaw: string; payerEthRaw: string };
  };
  "step.start": {
    label: string;
    stage: string;
    command?: string;
    configPath?: string;
    transcriptPath?: string;
  };
  "cre.result": {
    target: "price" | "stream" | "spend";
    command: string;
    cwd: string;
    configPath: string;
    transcriptPath: string;
    observations: Record<string, unknown>;
    decision: Decision;
    reason: string;
    hostCheck: boolean;
    source: string;
  };
  "api.reuse": {
    streamId: string;
    successfulRequests: number;
    failedRequests: number;
    walletNonceBefore?: number;
    walletNonceAfter?: number;
    hostCheckedNoPaymentTransactions?: boolean;
  };
  fault: { label: string; httpStatus: number };
  "wallet.tx": {
    kind: "approval" | "open" | "close";
    hash: string;
    explorerUrl: string;
    status: "submitting" | "confirmed";
    streamId?: string;
  };
  "audit.receipt": {
    hash: string;
    root: string;
    count: number;
    blockNumber: number;
  };
  "stream.opened": { streamId: string; fundedRaw: string };
  "stream.closed": { streamId: string; earnedRaw: string; refundedRaw: string };
  cleanup: {
    status: "attempting" | "closed" | "needs-attention";
    streamId: string;
  };
  "run.end": {
    status: "completed" | "denied" | "failed";
    fundedRaw: string | null;
    earnedRaw: string | null;
    refundedRaw: string | null;
    balances: Record<string, unknown>;
    transactions: Array<{ kind: string; hash: string }>;
    amountsVerified?: boolean;
  };
  error: { code: string; message: string };
}
export type RunEvent = {
  [K in keyof EventData]: {
    schemaVersion: 1;
    runId: string;
    seq: number;
    at: string;
    type: K;
    data: EventData[K];
  };
}[keyof EventData];
export function validateEvent(event: unknown): RunEvent;
export function validateRun(events: unknown[]): RunEvent[];
export function reduceRun(state: unknown, event: RunEvent): unknown;
