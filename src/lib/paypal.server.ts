// Server-only PayPal Sandbox REST client. Credentials never leave the server.
export const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  status: number;
  override name = "PayPalError";
  issue: string | undefined;
  debugId: string | undefined;
  constructor(message: string, status: number, issue?: string, debugId?: string) {
    super(message);
    this.status = status;
    this.issue = issue;
    this.debugId = debugId;
  }
}

export function paypalConfigured() {
  return !!process.env["PAYPAL_CLIENT_ID"] && !!process.env["PAYPAL_CLIENT_SECRET"];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const clientId = process.env["PAYPAL_CLIENT_ID"];
  const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!clientId || !secret) {
    throw new PayPalError("PayPal Sandbox is not configured yet (missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).", 503, "NOT_CONFIGURED");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const status = res.status;
    if (status === 401) throw new PayPalError("PayPal rejected the Sandbox credentials. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.", 401, "INVALID_CLIENT");
    throw new PayPalError(`PayPal authentication failed (HTTP ${status}).`, status);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

type PayPalErrorBody = { name?: string; message?: string; debug_id?: string; details?: { issue?: string; description?: string }[] };

export async function paypalRequest<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; requestId?: string; prefer?: string } = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (init.requestId) headers["PayPal-Request-Id"] = init.requestId;
  if (init.prefer) headers["Prefer"] = init.prefer;

  const res = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = (json ?? {}) as PayPalErrorBody;
    const issue = err.details?.[0]?.issue ?? err.name;
    const desc = err.details?.[0]?.description ?? err.message ?? `PayPal request failed (HTTP ${res.status})`;
    throw new PayPalError(desc, res.status, issue, err.debug_id);
  }
  return json as T;
}

// ---------- Typed subsets of PayPal responses ----------
export type PayPalLink = { href: string; rel: string; method?: string };
export type PayPalCapture = {
  id: string;
  status: string;
  amount?: { currency_code: string; value: string };
  create_time?: string;
  update_time?: string;
  status_details?: { reason?: string };
};
export type PayPalOrder = {
  id: string;
  status: string; // CREATED | SAVED | APPROVED | VOIDED | COMPLETED | PAYER_ACTION_REQUIRED
  intent?: string;
  create_time?: string;
  update_time?: string;
  links?: PayPalLink[];
  payer?: { email_address?: string; payer_id?: string; name?: { given_name?: string; surname?: string } };
  purchase_units?: {
    reference_id?: string;
    description?: string;
    amount?: { currency_code: string; value: string };
    payments?: { captures?: PayPalCapture[]; refunds?: { id: string; status: string }[] };
  }[];
};
export type PayPalRefund = { id: string; status: string; amount?: { currency_code: string; value: string }; create_time?: string };

export function approveLink(order: PayPalOrder) {
  return order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href ?? null;
}

export function firstCapture(order: PayPalOrder): PayPalCapture | undefined {
  return order.purchase_units?.[0]?.payments?.captures?.[0];
}

/** Map verified PayPal order/capture state to the app's transaction status. */
export function mapOrderStatus(order: PayPalOrder): string {
  const capture = firstCapture(order);
  if (capture) {
    switch (capture.status) {
      case "COMPLETED":
        return "completed";
      case "PENDING":
        return "pending";
      case "DECLINED":
      case "FAILED":
        return "failed";
      case "REFUNDED":
        return "refunded";
      case "PARTIALLY_REFUNDED":
        return "partially_refunded";
    }
  }
  switch (order.status) {
    case "APPROVED":
      return "approved";
    case "COMPLETED":
      return "completed";
    case "VOIDED":
      return "voided";
    default:
      return "created";
  }
}

/** Keep stored PayPal payloads small and free of HATEOAS noise. */
export function slimOrder(order: PayPalOrder) {
  return {
    id: order.id,
    status: order.status,
    intent: order.intent,
    create_time: order.create_time,
    update_time: order.update_time,
    payer: order.payer ? { payer_id: order.payer.payer_id, email_address: order.payer.email_address } : undefined,
    purchase_units: order.purchase_units?.map((u) => ({
      reference_id: u.reference_id,
      amount: u.amount,
      captures: u.payments?.captures?.map((c) => ({ id: c.id, status: c.status, amount: c.amount, create_time: c.create_time, status_details: c.status_details })),
      refunds: u.payments?.refunds?.map((r) => ({ id: r.id, status: r.status })),
    })),
  };
}

export async function verifyWebhookSignature(headers: Headers, rawBody: string, webhookId: string) {
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const required = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"];
  for (const h of required) if (!headers.get(h)) return false;
  const result = await paypalRequest<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    },
  });
  return result.verification_status === "SUCCESS";
}
