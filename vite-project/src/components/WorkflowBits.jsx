import {
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Circle,
} from "lucide-react";
import CopyButton from "./ui/CopyButton";
import { shortAddress } from "../lib/workflow-view.mjs";
export function DecisionBadge({ value }) {
  if (!value) return null;
  const tone = ["ALLOW", "OPEN", "CONTINUE", "Closed"].includes(value)
    ? "allow"
    : ["DENY", "BLOCK", "ERROR"].includes(value)
    ? "deny"
    : ["CLOSE", "Outage", "Attention"].includes(value)
    ? "warn"
    : "neutral";
  const Icon =
    tone === "allow"
      ? CheckCircle2
      : tone === "deny"
      ? XCircle
      : tone === "warn"
      ? AlertTriangle
      : Circle;
  return (
    <span className={`wf-badge wf-${tone}`}>
      <Icon size={12} aria-hidden="true" />
      {value}
    </span>
  );
}
export function Address({ value, label, full = false, kind = "address" }) {
  return (
    <div className={`wf-address ${full ? "wf-address-full" : ""}`}>
      <span title={value}>{full ? value : shortAddress(value)}</span>
      {value && (
        <>
          <CopyButton
            value={value}
            label={`Copy ${label}`}
            className="wf-icon"
          />
          <a
            className="wf-icon"
            href={`https://sepolia.etherscan.io/${kind}/${value}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`View ${label} on Etherscan`}
            title="Etherscan"
          >
            <ArrowUpRight size={14} />
          </a>
        </>
      )}
    </div>
  );
}
