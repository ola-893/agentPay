import { ArrowUpRight } from "lucide-react";
import WorkflowDashboard from "../components/WorkflowDashboard";
export default function CREWorkflow() {
  return (
    <div className="workflow-page">
      <div className="workflow-title">
        <div>
          <h1>Fund once. Let CRE supervise the stream.</h1>
          <p>Many paid requests. One stream. Every decision visible.</p>
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
