import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AgentId, AgentResult, AgentRun, AgentStreamEvent } from "@/lib/agents/definitions";

export type LiveRun = {
  question: string;
  intent?: string;
  agents: AgentId[];
  focus?: AgentRun["focus"];
  started: AgentId[];
  results: AgentResult[];
  text: string;
  done: boolean;
  error?: string;
  run?: AgentRun;
};

export function useAgentChat(opts: { onSession?: (id: string) => void } = {}) {
  const qc = useQueryClient();
  const [live, setLive] = useState<LiveRun | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (args: { message: string; sessionId?: string | null; transactionId?: string | null }) => {
      if (busy) return;
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLive({ question: args.message, agents: [], started: [], results: [], text: "", done: false });
      let sessionId = args.sessionId ?? null;
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Your session expired. Please sign in again.");
        const res = await fetch("/api/agents/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: args.message, sessionId, transactionId: args.transactionId ?? null }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as AgentStreamEvent;
            if (ev.type === "session") {
              if (ev.sessionId !== sessionId) {
                sessionId = ev.sessionId;
                opts.onSession?.(ev.sessionId);
              }
              qc.invalidateQueries({ queryKey: ["chat_sessions"] });
              qc.invalidateQueries({ queryKey: ["chat_messages", ev.sessionId] });
            }
            setLive((prev) => {
              if (!prev) return prev;
              switch (ev.type) {
                case "routing":
                  return { ...prev, intent: ev.intent, agents: ev.agents, focus: ev.focus };
                case "agent_start":
                  return { ...prev, started: [...prev.started, ev.agent] };
                case "agent_done":
                  return { ...prev, results: [...prev.results, ev.result] };
                case "final_delta":
                  return { ...prev, text: prev.text + ev.text };
                case "done":
                  return { ...prev, text: ev.content, run: ev.run, done: true };
                case "error":
                  return { ...prev, error: ev.message, done: true };
                default:
                  return prev;
              }
            });
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? (e.name === "AbortError" ? "Stopped." : e.message) : "Something went wrong.";
        setLive((prev) => (prev ? { ...prev, error: msg, done: true } : prev));
      } finally {
        setBusy(false);
        abortRef.current = null;
        if (sessionId) {
          await qc.invalidateQueries({ queryKey: ["chat_messages", sessionId] });
          qc.invalidateQueries({ queryKey: ["chat_sessions"] });
        }
      }
    },
    [busy, qc, opts],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => setLive(null), []);

  return { live, busy, send, stop, reset };
}
