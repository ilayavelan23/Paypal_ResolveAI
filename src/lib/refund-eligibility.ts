/**
 * Refund Assistant — deterministic eligibility guidance.
 * This is guidance only; PayPal (or the merchant) makes the final decision.
 */
export type EligibilityTx = {
  status: string;
  amount: number;
  created_at: string;
  source: string;
  paypal_capture_id?: string | null;
};

export type EligibilityRefund = { amount: number; status: string };

export type EligibilityCheck = { label: string; passed: boolean };

export type EligibilityResult = {
  verdict: "eligible" | "not_yet" | "not_eligible" | "already_refunded";
  title: string;
  checks: EligibilityCheck[];
  refundableAmount: number;
  canRefundViaSandboxApi: boolean;
  nextSteps: string[];
};

export const REFUND_WINDOW_DAYS = 180;

export function checkRefundEligibility(
  tx: EligibilityTx,
  refunds: EligibilityRefund[],
  now: Date = new Date(),
): EligibilityResult {
  const ageDays = (now.getTime() - new Date(tx.created_at).getTime()) / 86_400_000;
  const refunded = refunds
    .filter((r) => r.status === "completed" || r.status === "processing")
    .reduce((s, r) => s + Number(r.amount), 0);
  const refundableAmount = Math.max(0, Math.round((Number(tx.amount) - refunded) * 100) / 100);

  const checks: EligibilityCheck[] = [
    { label: "Payment completed successfully", passed: tx.status === "completed" || tx.status === "partially_refunded" },
    { label: `Within the ${REFUND_WINDOW_DAYS}-day refund window`, passed: ageDays <= REFUND_WINDOW_DAYS },
    { label: "Refundable balance remaining", passed: refundableAmount > 0 },
  ];

  const canRefundViaSandboxApi =
    tx.source === "paypal_sandbox" && !!tx.paypal_capture_id && checks.every((c) => c.passed);

  if (tx.status === "refunded" || refundableAmount === 0) {
    return {
      verdict: "already_refunded",
      title: "Already refunded",
      checks,
      refundableAmount: 0,
      canRefundViaSandboxApi: false,
      nextSteps: ["No action needed — the full amount has already been refunded or is being processed."],
    };
  }
  if (tx.status === "pending" || tx.status === "created" || tx.status === "approved" || tx.status === "on_hold") {
    return {
      verdict: "not_yet",
      title: "Not refundable yet",
      checks,
      refundableAmount,
      canRefundViaSandboxApi: false,
      nextSteps: [
        "Wait for the payment to complete or be cancelled — pending payments cannot be refunded yet.",
        "If it stays pending for more than 24 hours, contact the merchant.",
      ],
    };
  }
  if (tx.status === "failed" || tx.status === "cancelled" || tx.status === "voided") {
    return {
      verdict: "not_eligible",
      title: "Nothing to refund",
      checks,
      refundableAmount: 0,
      canRefundViaSandboxApi: false,
      nextSteps: ["No funds were captured for this payment, so there is nothing to refund.", "Check your funding source if you still see a hold."],
    };
  }
  if (ageDays > REFUND_WINDOW_DAYS) {
    return {
      verdict: "not_eligible",
      title: "Outside refund window",
      checks,
      refundableAmount,
      canRefundViaSandboxApi: false,
      nextSteps: ["Contact the merchant directly — the standard refund window has passed."],
    };
  }
  return {
    verdict: "eligible",
    title: "Eligible for refund",
    checks,
    refundableAmount,
    canRefundViaSandboxApi,
    nextSteps: [
      "Contact the merchant first — most refunds are issued by the seller.",
      canRefundViaSandboxApi
        ? "As the Sandbox merchant you can issue the refund below (requires confirmation)."
        : "If the merchant does not respond within 3 days, open a dispute with PayPal.",
      "Refunds usually take 1–5 business days to appear on the original payment method.",
    ],
  };
}
