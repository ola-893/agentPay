import { workflowStatus, shortAddress } from "../lib/workflow-view.mjs";

export default function WorkflowRunStatus({ state }) {
  const status = workflowStatus(state);
  if (!status) return null;
  return (
    <div className={`wf-run-status wf-status-${status.tone}`} role="status" aria-live="polite" aria-atomic="true">
      <strong>{status.title}</strong>
      <p>{status.detail}</p>
      {status.hash && (
        <a href={`https://sepolia.etherscan.io/tx/${status.hash}`} target="_blank" rel="noreferrer">
          Inspect transaction {shortAddress(status.hash)} ↗
        </a>
      )}
    </div>
  );
}
