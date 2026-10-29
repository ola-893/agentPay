import { ArrowUpRight } from "lucide-react";
import WorkflowDashboard from "../components/WorkflowDashboard";
export default function CREWorkflow() {
  return (
    <div className="workflow-page">
      <div className="workflow-title">
        <div>
          <h1>Fund once. Guard agent spending.</h1>
          <p>CRE checks fixed rules. A separate signer approves the intent; the escrow verifies it.</p>
        </div>
        <a
          href="https://github.com/ola-893/agentPay/tree/main/cre/payment-guard"
          target="_blank"
          rel="noreferrer"
        >
          Workflow source <ArrowUpRight size={14} />
        </a>
      </div>
      <WorkflowDashboard />
    </div>
  );
}
