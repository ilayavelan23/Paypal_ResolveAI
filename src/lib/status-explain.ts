// Deterministic, non-AI explanations of payment statuses.
export const STATUS_EXPLAIN: Record<string, { what: string; reasons: string[]; actions: string[]; expected: string }> = {
  created: {
    what: "The order was created but the buyer has not approved it yet.",
    reasons: ["The buyer has not completed the PayPal approval step.", "The approval window was closed before finishing."],
    actions: ["Open the PayPal approval link and approve the payment.", "Return to ResolveAI and check approval.", "Capture the payment after approval."],
    expected: "After buyer approval",
  },
  approved: {
    what: "The buyer approved the payment in PayPal. Funds are not moved until the payment is captured.",
    reasons: ["Capture has not been requested yet."],
    actions: ["Capture the payment (requires your confirmation).", "Re-verify the status with PayPal afterwards."],
    expected: "Immediately after capture",
  },
  pending: {
    what: "The payment is still being processed. This usually means the merchant or PayPal hasn't finished confirming it.",
    reasons: ["Merchant is still confirming the order.", "Bank or network delay (usually 5–30 minutes).", "Additional security review (random check)."],
    actions: ["Wait 30 minutes and check the status again.", "Verify whether the amount was debited from your account.", "If it remains pending after 1 hour, contact the merchant or open a PayPal inquiry."],
    expected: "Usually within 30 minutes",
  },
  on_hold: {
    what: "The payment is on hold for review. Funds are not released until the review completes.",
    reasons: ["Risk rules flagged unusual signals.", "Verification of the account holder is required."],
    actions: ["Review the risk signals in Fraud Detection.", "Confirm whether you made this payment.", "If you don't recognize it, report it and secure your account."],
    expected: "After your confirmation",
  },
  completed: {
    what: "The payment completed successfully and funds were transferred to the merchant.",
    reasons: [],
    actions: ["Keep your receipt for reference.", "If there's a problem with the order, contact the merchant first.", "Refunds and disputes are available if needed."],
    expected: "Completed",
  },
  failed: {
    what: "The payment did not go through. No funds were captured.",
    reasons: ["The funding source declined the payment.", "Insufficient balance or an expired card.", "A security check stopped the payment."],
    actions: ["Check your funding source and try again.", "Use a different payment method.", "Contact your bank if the decline continues."],
    expected: "—",
  },
  refunded: {
    what: "This payment was fully refunded.",
    reasons: [],
    actions: ["Allow 1–5 business days for the credit to appear on the original payment method."],
    expected: "Refunded",
  },
  partially_refunded: {
    what: "Part of this payment was refunded.",
    reasons: [],
    actions: ["Check the Refund Center for the refunded amount and remaining balance."],
    expected: "Partially refunded",
  },
  voided: { what: "The order was voided and will not be captured.", reasons: [], actions: ["Create a new payment if needed."], expected: "—" },
  cancelled: { what: "The payment was cancelled.", reasons: [], actions: ["Create a new payment if needed."], expected: "—" },
};
