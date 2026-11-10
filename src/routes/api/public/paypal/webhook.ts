import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookSignature, PayPalError } from "@/lib/paypal.server";

type WebhookEvent = {
  id: string;
  event_type: string;
  create_time?: string;
  summary?: string;
  resource?: {
    id?: string;
    status?: string;
    supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
    links?: { href: string; rel: string }[];
  };
};

const STATUS_BY_EVENT: Record<string, string | undefined> = {
  "CHECKOUT.ORDER.APPROVED": "approved",
  "PAYMENT.CAPTURE.COMPLETED": "completed",
  "PAYMENT.CAPTURE.PENDING": "pending",
  "PAYMENT.CAPTURE.DENIED": "failed",
  "PAYMENT.CAPTURE.DECLINED": "failed",
  "PAYMENT.CAPTURE.REFUNDED": "refunded",
  "PAYMENT.CAPTURE.REVERSED": "refunded",
};

export const Route = createFileRoute("/api/public/paypal/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookId = process.env["PAYPAL_WEBHOOK_ID"];
        if (!webhookId) return new Response("Webhook not configured", { status: 503 });

        const raw = await request.text();
        if (raw.length > 256_000) return new Response("Payload too large", { status: 413 });

        let verified = false;
        try {
          verified = await verifyWebhookSignature(request.headers, raw, webhookId);
        } catch (e) {
          console.error("[paypal-webhook] verification error", e instanceof PayPalError ? e.message : e);
          return new Response("Verification failed", { status: 400 });
        }
        if (!verified) return new Response("Invalid signature", { status: 400 });

        const event = JSON.parse(raw) as WebhookEvent;
        if (!event.id || !event.event_type) return new Response("Bad event", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Locate the related transaction by order id or capture id.
        const res = event.resource ?? {};
        const orderId =
          event.event_type.startsWith("CHECKOUT.ORDER") ? res.id : res.supplementary_data?.related_ids?.order_id;
        const captureId = event.event_type.startsWith("PAYMENT.CAPTURE") ? res.id : res.supplementary_data?.related_ids?.capture_id;

        let tx: { id: string; user_id: string; status: string } | null = null;
        if (orderId) {
          const { data } = await supabaseAdmin.from("transactions").select("id, user_id, status").eq("paypal_order_id", orderId).maybeSingle();
          tx = data;
        }
        if (!tx && captureId) {
          const { data } = await supabaseAdmin.from("transactions").select("id, user_id, status").eq("paypal_capture_id", captureId).maybeSingle();
          tx = data;
        }

        // Idempotency: the unique paypal_event_id makes redeliveries a no-op.
        const { error: insErr } = await supabaseAdmin.from("payment_events").insert({
          user_id: tx?.user_id ?? null,
          transaction_id: tx?.id ?? null,
          event_type: event.event_type.toLowerCase(),
          title: `Webhook: ${event.event_type}`,
          description: event.summary ?? "Verified PayPal webhook event.",
          source: "paypal_webhook",
          paypal_event_id: event.id,
          payload: { resource_id: res.id, status: res.status, order_id: orderId, capture_id: captureId },
          occurred_at: event.create_time ?? new Date().toISOString(),
        });
        if (insErr) {
          if (insErr.code === "23505") return Response.json({ received: true, duplicate: true });
          console.error("[paypal-webhook] insert", insErr.message);
          return new Response("Storage error", { status: 500 });
        }

        const nextStatus = STATUS_BY_EVENT[event.event_type];
        if (tx && nextStatus) {
          const update: Record<string, unknown> = { status: nextStatus, verified_at: new Date().toISOString() };
          if (event.event_type.startsWith("PAYMENT.CAPTURE") && res.id && !event.event_type.endsWith("REFUNDED")) {
            update["paypal_capture_id"] = res.id;
            update["paypal_capture_status"] = res.status ?? null;
          }
          // Don't downgrade a captured payment back to "approved".
          if (!(nextStatus === "approved" && ["completed", "refunded", "partially_refunded"].includes(tx.status))) {
            await supabaseAdmin.from("transactions").update(update).eq("id", tx.id);
          }
        }
        return Response.json({ received: true });
      },
    },
  },
});
