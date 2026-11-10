import { format, formatDistanceToNow } from "date-fns";

export function formatMoney(amount: number | string | null | undefined, currency = "USD") {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "MMM dd, yyyy · hh:mm a");
}

export function formatShortDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "MMM dd, hh:mm a");
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "MMM dd, yyyy");
}

export function timeAgo(value: string | Date | null | undefined) {
  if (!value) return "—";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function initials(name: string | null | undefined) {
  if (!name) return "RA";
  const parts = name.replace(/[^\p{L}\s.]/gu, "").split(/[\s.]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "RA").slice(0, 2);
}

export const DISPUTE_REASON_LABEL: Record<string, string> = {
  item_not_received: "Item not received",
  not_as_described: "Significantly not as described",
  unauthorized: "Unauthorized transaction",
  duplicate_charge: "Duplicate charge",
  billing_issue: "Billing issue",
  other: "Other",
};
