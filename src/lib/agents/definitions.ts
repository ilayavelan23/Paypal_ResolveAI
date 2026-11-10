// Shared (client + server) agent metadata.
export const AGENT_IDS = ["transaction_detective", "fraud_guardian", "refund_assistant", "dispute_assistant"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export const AGENT_META: Record<AgentId | "coordinator", { name: string; tagline: string; tone: "info" | "warning" | "success" | "violet" | "primary" }> = {
  coordinator: { name: "AI Coordinator", tagline: "Routes requests and combines final answers", tone: "primary" },
  transaction_detective: { name: "Transaction Detective", tagline: "Analyzes payment status and issues", tone: "info" },
  fraud_guardian: { name: "Fraud Guardian", tagline: "Checks for suspicious activity", tone: "warning" },
  refund_assistant: { name: "Refund Assistant", tagline: "Guides refund eligibility and status", tone: "success" },
  dispute_assistant: { name: "Dispute Assistant", tagline: "Helps prepare and resolve disputes", tone: "violet" },
};

export type AgentResult = {
  agent: AgentId;
  headline: string;
  status_label: string;
  findings: string[];
  recommendation: string;
};

export type AgentRun = {
  intent: string;
  agents: AgentId[];
  focus: null | {
    id: string;
    reference: string;
    merchant: string;
    amount: number;
    currency: string;
    status: string;
    source: string;
    verified_at: string | null;
  };
  results: AgentResult[];
  risk: { score: number; level: "low" | "medium" | "high"; basis: string } | null;
  model: string;
  data_sources: { demo: number; sandbox: number };
};

export type AgentStreamEvent =
  | { type: "session"; sessionId: string; userMessageId: string }
  | { type: "routing"; intent: string; agents: AgentId[]; focus: AgentRun["focus"] }
  | { type: "agent_start"; agent: AgentId }
  | { type: "agent_done"; result: AgentResult }
  | { type: "final_delta"; text: string }
  | { type: "done"; messageId: string; run: AgentRun; content: string }
  | { type: "error"; message: string; status?: number };
