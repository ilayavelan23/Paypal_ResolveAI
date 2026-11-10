/**
 * Fraud Guardian — transparent, explainable rules.
 * Every indicator carries a plain-language detail and a fixed impact so the
 * resulting score can always be explained. These are risk SIGNALS, never a
 * confirmation of fraud.
 */

export type RuleTx = {
  id: string;
  merchant: string;
  amount: number;
  status: string;
  created_at: string;
  location?: string | null;
  device_status?: string | null;
};

export type RiskIndicator = {
  code: "HIGH_AMOUNT" | "DUPLICATE" | "RAPID_FREQUENCY" | "NEW_LOCATION" | "NEW_DEVICE" | "FAILED_ATTEMPTS" | "LARGE_ABSOLUTE";
  name: string;
  detail: string;
  impact: number;
};

export type RiskAssessment = {
  transactionId: string;
  score: number;
  level: "low" | "medium" | "high";
  indicators: RiskIndicator[];
};

export const RULE_WEIGHTS = {
  HIGH_AMOUNT: 3.0,
  NEW_LOCATION: 2.5,
  DUPLICATE: 2.5,
  RAPID_FREQUENCY: 2.0,
  NEW_DEVICE: 1.5,
  FAILED_ATTEMPTS: 1.5,
  LARGE_ABSOLUTE: 1.0,
} as const;

const MIN = 60_000;
const HOUR = 60 * MIN;

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function riskLevel(score: number): "low" | "medium" | "high" {
  if (score >= 6) return "high";
  if (score >= 2.5) return "medium";
  return "low";
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let max = 0;
  for (const [k, c] of counts) if (c > max) { best = k; max = c; }
  return best;
}

export function assessTransaction(tx: RuleTx, all: RuleTx[]): RiskAssessment {
  const others = all.filter((t) => t.id !== tx.id);
  const t0 = new Date(tx.created_at).getTime();
  const indicators: RiskIndicator[] = [];
  const amount = Number(tx.amount);

  // 1. Amount vs the user's own baseline (needs >= 3 completed payments to compare against)
  const baseline = others.filter((t) => t.status === "completed").map((t) => Number(t.amount));
  if (baseline.length >= 3) {
    const avg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    if (avg > 0 && amount >= avg * 3) {
      indicators.push({
        code: "HIGH_AMOUNT",
        name: "Unusual amount",
        detail: `${money(amount)} is about ${(amount / avg).toFixed(1)}x your average of ${money(avg)}`,
        impact: RULE_WEIGHTS.HIGH_AMOUNT,
      });
    }
  }

  // 2. Same merchant + same amount within 24h
  const dup = others.find(
    (t) =>
      t.merchant.toLowerCase() === tx.merchant.toLowerCase() &&
      Number(t.amount) === amount &&
      Math.abs(new Date(t.created_at).getTime() - t0) <= 24 * HOUR &&
      t.status !== "failed",
  );
  if (dup && tx.status !== "failed") {
    const mins = Math.round(Math.abs(new Date(dup.created_at).getTime() - t0) / MIN);
    indicators.push({
      code: "DUPLICATE",
      name: "Possible duplicate",
      detail: `Same merchant and amount (${money(amount)}) ${mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`} apart`,
      impact: RULE_WEIGHTS.DUPLICATE,
    });
  }

  // 3. 3+ payments within a 10-minute window
  const burst = all.filter((t) => Math.abs(new Date(t.created_at).getTime() - t0) <= 10 * MIN);
  if (burst.length >= 3) {
    indicators.push({
      code: "RAPID_FREQUENCY",
      name: "Unusual payment frequency",
      detail: `${burst.length} payments within 10 minutes`,
      impact: RULE_WEIGHTS.RAPID_FREQUENCY,
    });
  }

  // 4. Location differs from the most common location
  const usual = mostCommon(others.map((t) => t.location).filter((l): l is string => !!l));
  if (tx.location && usual && tx.location !== usual) {
    indicators.push({
      code: "NEW_LOCATION",
      name: "New location",
      detail: `Initiated from ${tx.location} (usual: ${usual})`,
      impact: RULE_WEIGHTS.NEW_LOCATION,
    });
  }

  // 5. Unrecognized device
  if (tx.device_status === "new") {
    indicators.push({ code: "NEW_DEVICE", name: "New device", detail: "Unrecognized browser/device", impact: RULE_WEIGHTS.NEW_DEVICE });
  }

  // 6. Repeated failed attempts at the same merchant within 1h
  const failed = all.filter(
    (t) =>
      t.status === "failed" &&
      t.merchant.toLowerCase() === tx.merchant.toLowerCase() &&
      Math.abs(new Date(t.created_at).getTime() - t0) <= HOUR,
  );
  if (failed.length >= 2) {
    indicators.push({
      code: "FAILED_ATTEMPTS",
      name: "Repeated attempts",
      detail: `${failed.length} failed attempts at ${tx.merchant} within 1 hour`,
      impact: RULE_WEIGHTS.FAILED_ATTEMPTS,
    });
  }

  // 7. Large absolute amount
  if (amount >= 500) {
    indicators.push({ code: "LARGE_ABSOLUTE", name: "High amount", detail: `${money(amount)} — review recommended`, impact: RULE_WEIGHTS.LARGE_ABSOLUTE });
  }

  const raw = indicators.reduce((s, i) => s + i.impact, 0);
  const score = Math.min(10, Math.round(raw * 10) / 10);
  return { transactionId: tx.id, score, level: riskLevel(score), indicators };
}

export function assessAll(all: RuleTx[]): RiskAssessment[] {
  return all.map((t) => assessTransaction(t, all));
}

export function overallRisk(assessments: RiskAssessment[]): "low" | "medium" | "high" {
  if (assessments.some((a) => a.level === "high")) return "high";
  if (assessments.some((a) => a.level === "medium")) return "medium";
  return "low";
}
