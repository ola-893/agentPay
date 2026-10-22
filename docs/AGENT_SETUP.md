# Retired frontend agent setup

The browser agent console and local draft editor have been removed. The frontend contains only Workflow and Docs. Workflow has recorded replay and a local CLI dashboard with bounded Preview/Pay controls; it has no browser wallet connection or separate agent editor. See the [dashboard guide](WORKFLOW_DASHBOARD.md). The former `/agent` route is no longer available.

To run an AI agent with local CRE supervision, follow the [AI CLI guide](AI_AGENT_DEMO.md). To integrate strict onchain authorization separately, use the [GuardedPaymentClient reference](sdk/guarded-payment-client.md). Saved browser drafts and CRE simulation captures cannot authorize that strict path.

The previous interface and its verification records remain in Git history. No CLI, SDK or smart-contract functionality was removed with the browser pages.
