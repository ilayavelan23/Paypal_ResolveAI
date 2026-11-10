import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  PayPalError,
  approveLink,
  firstCapture,
  mapOrderStatus,
  paypalConfigured,
  paypalRequest,
  slimOrder,
  type PayPalOrder,
  type PayPalRefund,
} from "./paypal.server";
import { runFraudScanFor } from "./fraud-scan.server";

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string; code?: string | undefined };

function fail(e: unknown): Fail {
  if (e instanceof PayPalError) {
    console.error("[paypal]", e.status, e.issue, e.debugId, e.message);
    return { ok: false, error: e.message, code: e.issue };
  }
  console.error("[paypal] unexpected", e);
  return { ok: false, error: "Something went wrong talking to PayPal Sandbox. Please try again." };
}

function referenceFor(orderId: string) {
  return `PP-${orderId.slice(-8).toUpperCase()}`;
}

function safeOrigin(): string {
  const origin = getRequestHeader("origin") ?? "";
  try {
    const u = new URL(origin);
    if (u.protocol === "https:" || u.hostname === "localhost") return u.origin;
  } catch {
    /* fall through */
  }
  throw new PayPalError("Could not determine a safe return URL for PayPal approval.", 400, "BAD_ORIGIN");
}

export const getPaypalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    configured: paypalConfigured(),
    environment: "sandbox" as const,
    webhookConfigured: !!process.env["PAYPAL_WEBHOOK_ID"],
  }));

/** Live connectivity check: performs a real OAuth token request. */
export const testPaypalConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<Ok<{ checkedAt: string }> | Fail> => {
    try {
      const { getAccessToken } = await import("./paypal.server");
      await getAccessToken();
      return { ok: true, checkedAt: new Date().toISOString() };
    } catch (e) {
      return fail(e);
    }
  });

const createSchema = z.object({
  merchant: z.string().trim().min(2).max(60),
  description: z.string().trim().max(120).optional().default(""),
  amount: z.number().min(1).max(5000),
  idempotencyKey: z.string().uuid(),
});

export const createSandboxOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }): Promise<Ok<{ transactionId: string; orderId: string; approveUrl: string | null }> | Fail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      // Idempotency: same key → same transaction / same PayPal order.
      const { data: existing } = await supabaseAdmin
        .from("transactions")
        .select("id, user_id, paypal_order_id, approve_url")
        .eq("create_request_id", data.idempotencyKey)
        .maybeSingle();
      if (existing) {
        if (existing.user_id !== context.userId) return { ok: false, error: "Invalid request." };
        if (existing.paypal_order_id) {
          return { ok: true, transactionId: existing.id, orderId: existing.paypal_order_id, approveUrl: existing.approve_url };
        }
      }

      const origin = safeOrigin();
      const value = data.amount.toFixed(2);
      const order = await paypalRequest<PayPalOrder>("/v2/checkout/orders", {
        method: "POST",
        requestId: data.idempotencyKey,
        prefer: "return=representation",
        body: {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: data.idempotencyKey.slice(0, 32),
              description: (data.description || `Payment to ${data.merchant}`).slice(0, 127),
              soft_descriptor: "RESOLVEAI",
              amount: { currency_code: "USD", value },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "PayPal ResolveAI (Sandbox)",
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                return_url: `${origin}/paypal/return`,
                cancel_url: `${origin}/paypal/return?cancelled=1`,
              },
            },
          },
        },
      });

      const approveUrl = approveLink(order);
      const row = {
        user_id: context.userId,
        source: "paypal_sandbox",
        reference: referenceFor(order.id),
        merchant: data.merchant,
        description: data.description || null,
        category: "Sandbox test",
        amount: Number(value),
        currency: "USD",
        status: mapOrderStatus(order),
        payment_method: "PayPal (Sandbox)",
        paypal_order_id: order.id,
        paypal_status: order.status,
        approve_url: approveUrl,
        create_request_id: data.idempotencyKey,
        raw: slimOrder(order) as unknown as Json,
        verified_at: new Date().toISOString(),
      };
      const { data: tx, error } = await supabaseAdmin
        .from("transactions")
        .upsert(row, { onConflict: "paypal_order_id" })
        .select("id")
        .single();
      if (error || !tx) throw new Error(error?.message ?? "Could not store transaction");

      await supabaseAdmin.from("payment_events").insert({
        user_id: context.userId,
        transaction_id: tx.id,
        event_type: "order_created",
        title: "Order created in PayPal Sandbox",
        description: `Orders v2 returned status ${order.status}. Awaiting buyer approval.`,
        source: "paypal_api",
        payload: { order_id: order.id, status: order.status },
        occurred_at: order.create_time ?? new Date().toISOString(),
      });
      return { ok: true, transactionId: tx.id, orderId: order.id, approveUrl };
    } catch (e) {
      return fail(e);
    }
  });

const txIdSchema = z.object({ transactionId: z.string().uuid() });

async function loadOwnSandboxTx(supabase: Parameters<typeof runFraudScanFor>[0], transactionId: string) {
  const { data, error } = await supabase.from("transactions").select("*").eq("id", transactionId).maybeSingle();
  if (error || !data) throw new PayPalError("Transaction not found.", 404, "NOT_FOUND");
  if (data.source !== "paypal_sandbox" || !data.paypal_order_id) {
    throw new PayPalError("This is a DEMO transaction — it does not exist in PayPal and cannot be synced or captured.", 400, "DEMO_DATA");
  }
  return data;
}

/** Re-reads the order from PayPal and stores the verified state. */
export const syncSandboxOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => txIdSchema.parse(d))
  .handler(async ({ data, context }): Promise<Ok<{ status: string; paypalStatus: string }> | Fail> => {
    try {
      const tx = await loadOwnSandboxTx(context.supabase, data.transactionId);
      const order = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(tx.paypal_order_id!)}`);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const capture = firstCapture(order);
      const status = mapOrderStatus(order);
      await supabaseAdmin
        .from("transactions")
        .update({
          status: tx.status === "refunded" && status === "completed" ? tx.status : status,
          paypal_status: order.status,
          paypal_capture_id: capture?.id ?? tx.paypal_capture_id,
          paypal_capture_status: capture?.status ?? tx.paypal_capture_status,
          payer_email: order.payer?.email_address ?? tx.payer_email,
          payer_id: order.payer?.payer_id ?? tx.payer_id,
          raw: slimOrder(order) as unknown as Json,
          verified_at: new Date().toISOString(),
        })
        .eq("id", tx.id);
      if (order.status !== tx.paypal_status) {
        await supabaseAdmin.from("payment_events").insert({
          user_id: context.userId,
          transaction_id: tx.id,
          event_type: `order_${order.status.toLowerCase()}`,
          title: order.status === "APPROVED" ? "Buyer approved the payment" : `PayPal order status: ${order.status}`,
          description: "Verified by reading the order from PayPal Sandbox.",
          source: "paypal_api",
          payload: { order_id: order.id, status: order.status },
        });
      }
      return { ok: true, status, paypalStatus: order.status };
    } catch (e) {
      return fail(e);
    }
  });

/** Captures an APPROVED order. Requires explicit user confirmation. */
export const captureSandboxOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => txIdSchema.extend({ confirm: z.literal(true) }).parse(d))
  .handler(async ({ data, context }): Promise<Ok<{ status: string; captureId: string | null; captureStatus: string | null }> | Fail> => {
    try {
      const tx = await loadOwnSandboxTx(context.supabase, data.transactionId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Verify current state first — never capture blindly.
      const current = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(tx.paypal_order_id!)}`);
      if (current.status === "COMPLETED") {
        const cap = firstCapture(current);
        await supabaseAdmin
          .from("transactions")
          .update({ status: mapOrderStatus(current), paypal_status: current.status, paypal_capture_id: cap?.id ?? null, paypal_capture_status: cap?.status ?? null, raw: slimOrder(current) as unknown as Json, verified_at: new Date().toISOString() })
          .eq("id", tx.id);
        return { ok: true, status: mapOrderStatus(current), captureId: cap?.id ?? null, captureStatus: cap?.status ?? null };
      }
      if (current.status !== "APPROVED") {
        return { ok: false, error: `The buyer has not approved this order yet (PayPal status: ${current.status}). Approve it in the PayPal Sandbox window first.`, code: "NOT_APPROVED" };
      }

      // Stable idempotency key for this capture, persisted before calling PayPal.
      let captureKey = tx.capture_request_id;
      if (!captureKey) {
        captureKey = crypto.randomUUID();
        await supabaseAdmin.from("transactions").update({ capture_request_id: captureKey }).eq("id", tx.id);
      }

      const order = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(tx.paypal_order_id!)}/capture`, {
        method: "POST",
        requestId: captureKey,
        prefer: "return=representation",
        body: {},
      });
      const cap = firstCapture(order);
      const status = mapOrderStatus(order);
      await supabaseAdmin
        .from("transactions")
        .update({
          status,
          paypal_status: order.status,
          paypal_capture_id: cap?.id ?? null,
          paypal_capture_status: cap?.status ?? null,
          payer_email: order.payer?.email_address ?? current.payer?.email_address ?? null,
          payer_id: order.payer?.payer_id ?? current.payer?.payer_id ?? null,
          raw: slimOrder(order) as unknown as Json,
          verified_at: new Date().toISOString(),
        })
        .eq("id", tx.id);
      await supabaseAdmin.from("payment_events").insert({
        user_id: context.userId,
        transaction_id: tx.id,
        event_type: cap?.status === "COMPLETED" ? "capture_completed" : `capture_${(cap?.status ?? "unknown").toLowerCase()}`,
        title: cap?.status === "COMPLETED" ? "Payment captured" : `Capture status: ${cap?.status ?? "unknown"}`,
        description: cap?.status_details?.reason
          ? `PayPal reason: ${cap.status_details.reason}`
          : `Capture ${cap?.id ?? ""} confirmed by PayPal Sandbox.`,
        source: "paypal_api",
        payload: { order_id: order.id, capture_id: cap?.id, status: cap?.status },
        occurred_at: cap?.create_time ?? new Date().toISOString(),
      });
      await runFraudScanFor(context.supabase, context.userId).catch((e) => console.error("[fraud-scan]", e));
      return { ok: true, status, captureId: cap?.id ?? null, captureStatus: cap?.status ?? null };
    } catch (e) {
      return fail(e);
    }
  });

const refundSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.number().min(0.01).max(5000),
  reason: z.string().trim().min(3).max(200),
  confirm: z.literal(true),
  idempotencyKey: z.string().uuid(),
});

/** Refunds a completed Sandbox capture. Requires explicit user confirmation. */
export const refundSandboxCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => refundSchema.parse(d))
  .handler(async ({ data, context }): Promise<Ok<{ refundId: string; status: string }> | Fail> => {
    try {
      const tx = await loadOwnSandboxTx(context.supabase, data.transactionId);
      if (!tx.paypal_capture_id || (tx.status !== "completed" && tx.status !== "partially_refunded")) {
        return { ok: false, error: "Only completed, captured Sandbox payments can be refunded.", code: "NOT_REFUNDABLE" };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prior } = await supabaseAdmin.from("refunds").select("amount, status, request_id, id").eq("transaction_id", tx.id);
      const dupe = prior?.find((r) => r.request_id === data.idempotencyKey);
      const refunded = (prior ?? []).filter((r) => r.status === "completed" || r.status === "processing").reduce((s, r) => s + Number(r.amount), 0);
      if (!dupe && data.amount > Number(tx.amount) - refunded + 0.001) {
        return { ok: false, error: "Refund amount exceeds the remaining refundable balance.", code: "AMOUNT_TOO_HIGH" };
      }

      let refundRowId = dupe?.id;
      if (!refundRowId) {
        const { data: row, error } = await supabaseAdmin
          .from("refunds")
          .insert({ user_id: context.userId, transaction_id: tx.id, source: "paypal_sandbox", amount: data.amount, reason: data.reason, status: "requested", request_id: data.idempotencyKey })
          .select("id")
          .single();
        if (error || !row) throw new Error(error?.message);
        refundRowId = row.id;
      }

      const isFull = Math.abs(data.amount - (Number(tx.amount) - refunded)) < 0.005 && refunded === 0;
      const refund = await paypalRequest<PayPalRefund>(`/v2/payments/captures/${encodeURIComponent(tx.paypal_capture_id)}/refund`, {
        method: "POST",
        requestId: data.idempotencyKey,
        prefer: "return=representation",
        body: isFull ? { note_to_payer: data.reason.slice(0, 255) } : { amount: { currency_code: tx.currency, value: data.amount.toFixed(2) }, note_to_payer: data.reason.slice(0, 255) },
      });
      const status = refund.status === "COMPLETED" ? "completed" : refund.status === "PENDING" ? "processing" : refund.status === "FAILED" || refund.status === "CANCELLED" ? "failed" : "processing";
      await supabaseAdmin
        .from("refunds")
        .update({ status, paypal_refund_id: refund.id, paypal_status: refund.status, raw: refund as unknown as Json })
        .eq("id", refundRowId);
      if (status === "completed" || status === "processing") {
        const fully = refunded + data.amount >= Number(tx.amount) - 0.005;
        await supabaseAdmin.from("transactions").update({ status: fully ? "refunded" : "partially_refunded" }).eq("id", tx.id);
      }
      await supabaseAdmin.from("payment_events").insert({
        user_id: context.userId,
        transaction_id: tx.id,
        event_type: "refund_" + refund.status.toLowerCase(),
        title: `Refund ${refund.status.toLowerCase()}`,
        description: `Refund ${refund.id} of $${data.amount.toFixed(2)} confirmed by PayPal Sandbox.`,
        source: "paypal_api",
        payload: { refund_id: refund.id, status: refund.status },
      });
      return { ok: true, refundId: refund.id, status };
    } catch (e) {
      return fail(e);
    }
  });

/** Re-run the explainable fraud rules over all of the user's transactions. */
export const runFraudScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const r = await runFraudScanFor(context.supabase, context.userId);
      return { ok: true as const, ...r };
    } catch (e) {
      console.error("[fraud-scan]", e);
      return { ok: false as const, error: "Fraud scan failed. Please try again." };
    }
  });
