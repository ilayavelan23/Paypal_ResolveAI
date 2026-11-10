import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import { assessAll, assessTransaction, type RuleTx } from "../fraud-rules";
import { checkRefundEligibility } from "../refund-eligibility";
import { AGENT_IDS, AGENT_META, type AgentId, type AgentResult, type AgentRun, type AgentStreamEvent } from "./definitions";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

type DB = SupabaseClient<Database>;
type TxRow = Database["public"]["Tables"]["transactions"]["Row"];

const GROUNDING_RULES = `
STRICT GROUNDING RULES (always follow):
- Use ONLY the JSON data provided in the context. Never invent transaction IDs, amounts, dates, merchants, statuses or PayPal responses.
- If the information needed is not in the context, say clearly that it is not available.
- Every record has a "data_source": "DEMO" means fictional sample data (say so when you mention it — never present it as a real payment). "PAYPAL_SANDBOX" means the record was verified against the PayPal Sandbox API at "verified_at".
- Never state that fraud is confirmed. Describe "risk signals" or "potential" issues and explain the rule that produced them.
- Never claim you performed a financial action (refund, capture, dispute filing). Users must confirm such actions themselves in the app.
- Be concise, practical and friendly. Use plain language.`;

const SPECIALIST_PROMPTS: Record<AgentId, string> = {
  transaction_detective: `You are the Transaction Detective of PayPal ResolveAI. You investigate the user's transactions and explain payment statuses (created, approved, pending, completed, failed, on_hold, refunded), what each status typically means in PayPal, likely reasons, and what the timeline shows. Quote real identifiers (reference, PayPal order id, capture id) only when present.`,
  fraud_guardian: `You are the Fraud Guardian of PayPal ResolveAI. You explain the transparent rule-based risk assessment provided in "risk_assessment" (score 0-10 and indicators with fixed impacts). Explain each indicator in plain words and give safety recommendations. You MUST NOT change the score or add indicators that are not listed. If no indicators fired, say no rule-based risk signals were detected.`,
  refund_assistant: `You are the Refund Assistant of PayPal ResolveAI. You explain refund information using "refund_eligibility" (a deterministic check) and any existing refunds. Explain status, eligibility and next steps. Remind the user that refunds require their explicit confirmation in the Refund Center and that the merchant/PayPal makes the final decision.`,
  dispute_assistant: `You are the Dispute Assistant of PayPal ResolveAI. You prepare concise dispute summaries and evidence checklists (order confirmation, communication with seller, proof of issue, additional details) based on the context. Explain when a dispute is appropriate versus waiting or contacting the merchant. Disputes in this app are case files the user prepares; they are only filed with PayPal if the user does so on PayPal.`,
};

const routingSchema = z.object({
  intent: z.string(),
  agents: z.array(z.enum(AGENT_IDS)),
  focus_reference: z.string().nullable(),
});

const specialistSchema = z.object({
  headline: z.string(),
  status_label: z.string(),
  findings: z.array(z.string()),
  recommendation: z.string(),
});

function makeProvider(apiKey: string, runIdFetch: ReturnType<typeof createLovableAiGatewayRunIdFetch>) {
  return createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
}

const providerOptions = {
  openai: {
    store: false,
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    include: ["reasoning.encrypted_content"],
  },
};

function dataSource(t: TxRow) {
  return t.source === "paypal_sandbox" ? "PAYPAL_SANDBOX" : "DEMO";
}

function compactTx(t: TxRow) {
  return {
    id: t.id,
    reference: t.reference,
    data_source: dataSource(t),
    merchant: t.merchant,
    description: t.description,
    amount: Number(t.amount),
    currency: t.currency,
    status: t.status,
    created_at: t.created_at,
    payment_method: t.payment_method,
    ...(t.source === "paypal_sandbox"
      ? {
          paypal_order_id: t.paypal_order_id,
          paypal_order_status: t.paypal_status,
          paypal_capture_id: t.paypal_capture_id,
          paypal_capture_status: t.paypal_capture_status,
          payer_email: t.payer_email,
          verified_at: t.verified_at,
        }
      : { location: t.location }),
  };
}

function findFocus(txs: TxRow[], message: string, explicitId?: string | null, ref?: string | null): TxRow | null {
  if (explicitId) {
    const t = txs.find((x) => x.id === explicitId);
    if (t) return t;
  }
  const hay = `${message} ${ref ?? ""}`.toLowerCase();
  const byRef = txs.find(
    (t) => hay.includes(t.reference.toLowerCase()) || (t.paypal_order_id && hay.includes(t.paypal_order_id.toLowerCase())) || (t.paypal_capture_id && hay.includes(t.paypal_capture_id.toLowerCase())),
  );
  if (byRef) return byRef;
  const amounts = [...message.matchAll(/\$?\s?(\d+(?:\.\d{1,2})?)/g)].map((m) => Number(m[1]));
  const merchantHit = txs.find((t) => hay.includes(t.merchant.toLowerCase()) && (amounts.length === 0 || amounts.includes(Number(t.amount))));
  if (merchantHit) return merchantHit;
  const amountHit = amounts.length ? txs.find((t) => amounts.includes(Number(t.amount))) : undefined;
  if (amountHit) return amountHit;
  if (/sandbox|my (last|latest|recent) (payment|transaction)|test payment/.test(hay)) {
    return txs.find((t) => t.source === "paypal_sandbox") ?? null;
  }
  return null;
}

function keywordRouting(message: string): AgentId[] {
  const m = message.toLowerCase();
  const out = new Set<AgentId>();
  if (/(pending|status|transaction|payment|captur|approve|explain|sandbox|order)/.test(m)) out.add("transaction_detective");
  if (/(fraud|safe|suspicious|scam|risk|unauthori|duplicate|secure)/.test(m)) out.add("fraud_guardian");
  if (/(refund|money back|return)/.test(m)) out.add("refund_assistant");
  if (/(dispute|claim|evidence|chargeback|not received|seller)/.test(m)) out.add("dispute_assistant");
  if (out.size === 0) out.add("transaction_detective");
  return [...out];
}

async function loadContext(db: DB) {
  const [tx, alerts, refunds, disputes] = await Promise.all([
    db.from("transactions").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("fraud_alerts").select("transaction_id, severity, title, risk_score, status"),
    db.from("refunds").select("transaction_id, amount, status, reason, source, paypal_refund_id, paypal_status, created_at"),
    db.from("disputes").select("id, transaction_id, reference, reason, status, source, created_at"),
  ]);
  if (tx.error) throw new Error(tx.error.message);
  return { txs: tx.data ?? [], alerts: alerts.data ?? [], refunds: refunds.data ?? [], disputes: disputes.data ?? [] };
}

export type RunAgentsInput = {
  db: DB;
  userId: string;
  sessionId: string;
  message: string;
  transactionId?: string | null;
  history: { role: "user" | "assistant"; content: string }[];
  signal: AbortSignal;
  emit: (e: AgentStreamEvent) => void;
};

export async function runAgents(input: RunAgentsInput): Promise<{ content: string; run: AgentRun }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw Object.assign(new Error("AI is not configured (missing LOVABLE_API_KEY)."), { status: 500 });
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = makeProvider(apiKey, runIdFetch);
  const model = provider.responses(MODEL);

  const ctx = await loadContext(input.db);
  const ruleTxs: RuleTx[] = ctx.txs.map((t) => ({ ...t, amount: Number(t.amount) }));

  const historyMsgs: ModelMessage[] = input.history.slice(-8).map((h) => ({ role: h.role, content: h.content }));

  // ---------- 1. Coordinator: routing ----------
  const txIndex = ctx.txs.slice(0, 40).map((t) => `${t.reference} | ${dataSource(t)} | ${t.merchant} | $${Number(t.amount).toFixed(2)} | ${t.status} | ${t.created_at.slice(0, 16)}`).join("\n");
  let intent = "Payment help";
  let agents: AgentId[] = [];
  let focusRef: string | null = null;
  try {
    const routing = streamText({
      model,
      instructions: `You are the AI Coordinator of PayPal ResolveAI. Decide which specialist agents must handle the user's latest request. Agents: transaction_detective (payment status/explanations), fraud_guardian (safety, suspicious activity, risk), refund_assistant (refunds/eligibility), dispute_assistant (disputes, evidence, claims). Choose 1 to 4 agents — include every agent relevant to the request (e.g. "is it safe and what should I do" about a pending payment => transaction_detective + fraud_guardian + refund_assistant + dispute_assistant). "intent" is a short (max 8 words) description. "focus_reference" is the reference of the single transaction the user is asking about, chosen ONLY from the index below, or null.\n\nTransaction index (reference | source | merchant | amount | status | created):\n${txIndex || "(no transactions)"}`,
      messages: [...historyMsgs, { role: "user", content: input.message }],
      output: Output.object({ schema: routingSchema }),
      providerOptions,
      maxRetries: 1,
      abortSignal: input.signal,
    });
    const r = await routing.output;
    intent = r.intent.slice(0, 80) || intent;
    agents = [...new Set(r.agents)].filter((a): a is AgentId => (AGENT_IDS as readonly string[]).includes(a));
    focusRef = r.focus_reference;
  } catch (e) {
    if (!NoObjectGeneratedError.isInstance(e)) throw e;
    console.warn("[agents] routing fell back to keywords");
  }
  if (agents.length === 0) agents = keywordRouting(input.message);
  agents = AGENT_IDS.filter((a) => agents.includes(a));

  const focusTx = findFocus(ctx.txs, input.message, input.transactionId, focusRef);
  const focus = focusTx
    ? { id: focusTx.id, reference: focusTx.reference, merchant: focusTx.merchant, amount: Number(focusTx.amount), currency: focusTx.currency, status: focusTx.status, source: focusTx.source, verified_at: focusTx.verified_at }
    : null;
  input.emit({ type: "routing", intent, agents, focus });

  // ---------- 2. Deterministic facts ----------
  let events: unknown[] = [];
  if (focusTx) {
    const { data } = await input.db.from("payment_events").select("event_type, title, description, source, occurred_at").eq("transaction_id", focusTx.id).order("occurred_at");
    events = data ?? [];
  }
  const focusAssessment = focusTx ? assessTransaction({ ...focusTx, amount: Number(focusTx.amount) }, ruleTxs) : null;
  const flagged = assessAll(ruleTxs).filter((a) => a.level !== "low").slice(0, 10);
  const focusRefunds = focusTx ? ctx.refunds.filter((r) => r.transaction_id === focusTx.id) : [];
  const eligibility = focusTx ? checkRefundEligibility({ ...focusTx, amount: Number(focusTx.amount) }, focusRefunds.map((r) => ({ amount: Number(r.amount), status: r.status }))) : null;
  const sandboxCount = ctx.txs.filter((t) => t.source === "paypal_sandbox").length;

  const sharedContext = {
    now: new Date().toISOString(),
    focus_transaction: focusTx ? { ...compactTx(focusTx), timeline: events } : null,
    focus_note: focusTx ? undefined : "No specific transaction could be matched to the request. Do not guess one; you may refer to the recent transactions list.",
    risk_assessment: focusAssessment
      ? { method: "Transparent rules (amount vs. baseline, duplicates, frequency, location, device, failed attempts)", score_out_of_10: focusAssessment.score, level: focusAssessment.level, indicators: focusAssessment.indicators }
      : { method: "Transparent rules", flagged_transactions: flagged.map((f) => ({ reference: ctx.txs.find((t) => t.id === f.transactionId)?.reference, score: f.score, level: f.level, indicators: f.indicators.map((i) => i.detail) })) },
    refund_eligibility: eligibility,
    existing_refunds: focusTx ? focusRefunds : ctx.refunds.slice(0, 10),
    existing_disputes: ctx.disputes.filter((d) => !focusTx || d.transaction_id === focusTx.id).slice(0, 5),
    recent_transactions: ctx.txs.slice(0, 25).map(compactTx),
    totals: { transactions: ctx.txs.length, sandbox_verified: sandboxCount, demo: ctx.txs.length - sandboxCount },
  };
  const contextJson = JSON.stringify(sharedContext);

  // ---------- 3. Specialists in parallel ----------
  const results: AgentResult[] = await Promise.all(
    agents.map(async (agent) => {
      input.emit({ type: "agent_start", agent });
      let result: AgentResult;
      try {
        const s = streamText({
          model,
          instructions: `${SPECIALIST_PROMPTS[agent]}\n${GROUNDING_RULES}\n\nReturn: "headline" (one short sentence), "status_label" (2-4 words, e.g. "Pending (Processing)" or "Low risk 2/10"), "findings" (2-4 short bullet strings, each under 25 words), "recommendation" (one or two sentences).\n\nCONTEXT JSON:\n${contextJson}`,
          messages: [...historyMsgs, { role: "user", content: input.message }],
          output: Output.object({ schema: specialistSchema }),
          providerOptions,
          maxRetries: 1,
          abortSignal: input.signal,
        });
        const o = await s.output;
        result = { agent, headline: o.headline, status_label: o.status_label, findings: o.findings.slice(0, 5), recommendation: o.recommendation };
      } catch (e) {
        if (NoObjectGeneratedError.isInstance(e)) {
          result = { agent, headline: "Analysis could not be formatted.", status_label: "Unavailable", findings: e.text ? [e.text.slice(0, 300)] : [], recommendation: "Please try asking again." };
        } else throw e;
      }
      input.emit({ type: "agent_done", result });
      return result;
    }),
  );

  // ---------- 4. Coordinator: synthesis (streamed) ----------
  const risk = focusAssessment
    ? { score: Math.max(focusAssessment.score, 0), level: focusAssessment.level, basis: `Rule-based assessment of ${focusTx!.reference}` }
    : null;
  const final = streamText({
    model,
    instructions: `You are the AI Coordinator of PayPal ResolveAI. Combine the specialist results into ONE clear answer for the user, in Markdown. Structure: a 1-2 sentence direct answer, then "**What we found**" (bullets), then "**Recommended next steps**" (numbered, max 4). Mention the data source of the transaction (DEMO sample data vs. verified PayPal Sandbox record). If a risk score is given, state it exactly as provided and call it a rule-based risk signal, not proof. Keep it under 220 words.\n${GROUNDING_RULES}\n\nSPECIALIST RESULTS:\n${JSON.stringify(results.map((r) => ({ ...r, agent: AGENT_META[r.agent].name })))}\n\nRULE-BASED RISK: ${risk ? `${risk.score}/10 (${risk.level})` : "not computed (no single transaction in focus)"}\n\nCONTEXT JSON:\n${contextJson}`,
    messages: [...historyMsgs, { role: "user", content: input.message }],
    providerOptions,
    maxRetries: 1,
    abortSignal: input.signal,
  });
  let content = "";
  for await (const delta of final.textStream) {
    content += delta;
    input.emit({ type: "final_delta", text: delta });
  }
  if (!content.trim()) content = "I couldn't produce an answer this time. Please try rephrasing your question.";

  const run: AgentRun = {
    intent,
    agents,
    focus,
    results,
    risk,
    model: MODEL,
    data_sources: { demo: ctx.txs.length - sandboxCount, sandbox: sandboxCount },
  };
  return { content, run };
}

export function runToJson(run: AgentRun): Json {
  return run as unknown as Json;
}
