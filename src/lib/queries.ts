import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Transaction = Tables<"transactions">;
export type PaymentEvent = Tables<"payment_events">;
export type FraudAlert = Tables<"fraud_alerts">;
export type Refund = Tables<"refunds">;
export type Dispute = Tables<"disputes">;
export type DisputeEvidence = Tables<"dispute_evidence">;
export type ChatSession = Tables<"chat_sessions">;
export type ChatMessage = Tables<"chat_messages">;
export type Profile = Tables<"profiles">;

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const transactionsQuery = () =>
  queryOptions({
    queryKey: ["transactions"],
    queryFn: async () =>
      unwrap(await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500)),
  });

export const transactionQuery = (id: string) =>
  queryOptions({
    queryKey: ["transactions", id],
    queryFn: async () => unwrap(await supabase.from("transactions").select("*").eq("id", id).maybeSingle()),
  });

export const eventsQuery = (transactionId: string) =>
  queryOptions({
    queryKey: ["events", transactionId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("payment_events")
          .select("*")
          .eq("transaction_id", transactionId)
          .order("occurred_at", { ascending: true }),
      ),
  });

export const alertsQuery = () =>
  queryOptions({
    queryKey: ["fraud_alerts"],
    queryFn: async () =>
      unwrap(await supabase.from("fraud_alerts").select("*").order("risk_score", { ascending: false })),
  });

export const refundsQuery = () =>
  queryOptions({
    queryKey: ["refunds"],
    queryFn: async () => unwrap(await supabase.from("refunds").select("*").order("created_at", { ascending: false })),
  });

export const disputesQuery = () =>
  queryOptions({
    queryKey: ["disputes"],
    queryFn: async () => unwrap(await supabase.from("disputes").select("*").order("created_at", { ascending: false })),
  });

export const evidenceQuery = (disputeId: string) =>
  queryOptions({
    queryKey: ["evidence", disputeId],
    queryFn: async () =>
      unwrap(
        await supabase.from("dispute_evidence").select("*").eq("dispute_id", disputeId).order("created_at"),
      ),
  });

export const sessionsQuery = () =>
  queryOptions({
    queryKey: ["chat_sessions"],
    queryFn: async () =>
      unwrap(await supabase.from("chat_sessions").select("*").order("updated_at", { ascending: false }).limit(100)),
  });

export const messagesQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["chat_messages", sessionId],
    queryFn: async () =>
      unwrap(
        await supabase.from("chat_messages").select("*").eq("session_id", sessionId).order("created_at"),
      ),
  });

export const profileQuery = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { user: { id: u.user.id, email: u.user.email ?? "", confirmed: !!u.user.email_confirmed_at, provider: u.user.app_metadata?.provider ?? "email", lastSignIn: u.user.last_sign_in_at ?? null }, profile };
    },
  });
