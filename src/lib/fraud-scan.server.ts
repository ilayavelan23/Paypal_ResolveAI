import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { assessAll } from "./fraud-rules";

/** Run the explainable rules over all of the user's transactions and upsert alerts (score >= 2.5). */
export async function runFraudScanFor(client: SupabaseClient<Database>, userId: string) {
  const { data: txs, error } = await client
    .from("transactions")
    .select("id, merchant, amount, status, created_at, location, device_status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const assessments = assessAll((txs ?? []).map((t) => ({ ...t, amount: Number(t.amount) })));
  const flagged = assessments.filter((a) => a.level !== "low");

  const { data: existing } = await client.from("fraud_alerts").select("transaction_id, status").eq("user_id", userId);
  const statusByTx = new Map((existing ?? []).map((e) => [e.transaction_id, e.status]));

  if (flagged.length) {
    const rows = flagged.map((a) => {
      const top = [...a.indicators].sort((x, y) => y.impact - x.impact)[0];
      return {
        user_id: userId,
        transaction_id: a.transactionId,
        severity: a.level,
        title: a.indicators.length > 1 ? `${top?.name ?? "Risk signals"} + ${a.indicators.length - 1} more` : (top?.name ?? "Risk signal"),
        explanation: a.indicators.map((i) => i.detail).join("; ") + ".",
        risk_score: a.score,
        indicators: a.indicators as unknown as Json,
        source: "rules",
        status: statusByTx.get(a.transactionId) ?? "open",
      };
    });
    const { error: upErr } = await client.from("fraud_alerts").upsert(rows, { onConflict: "user_id,transaction_id" });
    if (upErr) throw new Error(upErr.message);
  }
  return { scanned: assessments.length, flagged: flagged.length };
}
