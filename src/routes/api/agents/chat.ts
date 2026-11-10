import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { APICallError } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { AgentStreamEvent } from "@/lib/agents/definitions";

const bodySchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(2000),
  transactionId: z.string().uuid().nullable().optional(),
});

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function safeAiError(e: unknown): { message: string; status: number } {
  if (APICallError.isInstance(e)) {
    const s = e.statusCode ?? 500;
    if (s === 402) return { status: 402, message: "AI credits are exhausted for this workspace. Add credits in workspace billing to continue." };
    if (s === 429) return { status: 429, message: "The AI service is busy right now. Please wait a moment and try again." };
    if (s === 403) return { status: 403, message: "AI access is currently blocked for this workspace." };
    return { status: s, message: "The AI service returned an error. Please try again." };
  }
  if (e instanceof Error && e.name === "AbortError") return { status: 499, message: "Stopped." };
  return { status: 500, message: "Something went wrong while the agents were working. Please try again." };
}

export const Route = createFileRoute("/api/agents/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const db = userClient(token);
        const { data: claims, error: authErr } = await db.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (authErr || !userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        // Session (create if missing; RLS guarantees ownership).
        let sessionId = body.sessionId ?? null;
        if (sessionId) {
          const { data } = await db.from("chat_sessions").select("id").eq("id", sessionId).maybeSingle();
          if (!data) return Response.json({ error: "Conversation not found" }, { status: 404 });
        } else {
          const { data, error } = await db
            .from("chat_sessions")
            .insert({ user_id: userId, title: body.message.slice(0, 60), transaction_id: body.transactionId ?? null })
            .select("id")
            .single();
          if (error || !data) return Response.json({ error: "Could not start conversation" }, { status: 500 });
          sessionId = data.id;
        }

        const { data: historyRows } = await db
          .from("chat_messages")
          .select("role, content")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(8);
        const history = (historyRows ?? []).reverse() as { role: "user" | "assistant"; content: string }[];

        const { data: userMsg, error: msgErr } = await db
          .from("chat_messages")
          .insert({ session_id: sessionId, user_id: userId, role: "user", content: body.message })
          .select("id")
          .single();
        if (msgErr || !userMsg) return Response.json({ error: "Could not save message" }, { status: 500 });

        const encoder = new TextEncoder();
        const sid = sessionId;
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const emit = (e: AgentStreamEvent) => {
              try {
                controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
              } catch {
                /* client went away */
              }
            };
            emit({ type: "session", sessionId: sid, userMessageId: userMsg.id });
            try {
              const { runAgents, runToJson } = await import("@/lib/agents/agents.server");
              const { content, run } = await runAgents({
                db,
                userId,
                sessionId: sid,
                message: body.message,
                transactionId: body.transactionId ?? null,
                history,
                signal: request.signal,
                emit,
              });
              const { data: saved } = await db
                .from("chat_messages")
                .insert({ session_id: sid, user_id: userId, role: "assistant", content, agent_run: runToJson(run) })
                .select("id")
                .single();
              await db.from("chat_sessions").update({ transaction_id: run.focus?.id ?? null, updated_at: new Date().toISOString() }).eq("id", sid);
              emit({ type: "done", messageId: saved?.id ?? "", run, content });
            } catch (e) {
              console.error("[agents]", e);
              const err = safeAiError(e);
              emit({ type: "error", message: err.message, status: err.status });
            } finally {
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            }
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
        });
      },
    },
  },
});
