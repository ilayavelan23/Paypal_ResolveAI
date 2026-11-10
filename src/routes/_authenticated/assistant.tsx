import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { MessageSquare, Network, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/app-shell";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AgentIcon, AgentProgress, AgentResultBlocks, RunMeta } from "@/components/app/agent-ui";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { messagesQuery, sessionsQuery } from "@/lib/queries";
import { AGENT_IDS, AGENT_META, type AgentRun } from "@/lib/agents/definitions";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import botImg from "@/assets/resolve-bot.png";

type Search = { session?: string | undefined; txn?: string | undefined; q?: string | undefined };

export const Route = createFileRoute("/_authenticated/assistant")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    session: typeof s["session"] === "string" ? s["session"] : undefined,
    txn: typeof s["txn"] === "string" ? s["txn"] : undefined,
    q: typeof s["q"] === "string" ? s["q"].slice(0, 500) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI Assistant — PayPal ResolveAI" },
      { name: "description", content: "Chat with the ResolveAI multi-agent assistant about payments, refunds, disputes and security." },
      { property: "og:title", content: "AI Assistant — PayPal ResolveAI" },
      { property: "og:description", content: "Multi-agent AI help for your payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { session, txn, q } = Route.useSearch();
  const navigate = useNavigate();
  const sessions = useQuery(sessionsQuery());
  const messages = useQuery({ ...messagesQuery(session ?? "none"), enabled: !!session });
  const { live, busy, send, stop, reset } = useAgentChat({
    onSession: (id) => navigate({ to: "/assistant", search: { session: id, txn }, replace: true }),
  });
  const autoSent = useRef(false);

  useEffect(() => {
    if (q && !session && !autoSent.current) {
      autoSent.current = true;
      send({ message: q, transactionId: txn ?? null });
    }
  }, [q, session, txn, send]);

  const persisted = messages.data ?? [];
  const showLive = live && !(live.done && persisted.some((m) => m.role === "assistant" && m.content === live.text));
  const activeAgents = live && !live.done ? live.agents : [];

  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Get help with payments, refunds, disputes and security using multi-agent AI" />
      <div className="grid flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_260px]">
        <aside className="hidden rounded-2xl border bg-card p-3 shadow-card lg:block">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Conversations</h2>
            <Link to="/assistant" search={{}} onClick={reset} className="flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> New Chat</Link>
          </div>
          <ul className="space-y-1">
            {(sessions.data ?? []).map((s) => (
              <li key={s["id"]}>
                <Link to="/assistant" search={{ session: s["id"] }} onClick={reset} className={cn("block rounded-xl px-3 py-2 text-sm hover:bg-accent", s["id"] === session && "bg-primary-soft")}>
                  <span className="flex items-center gap-2 font-medium"><MessageSquare className="h-4 w-4 shrink-0 text-primary" /> <span className="truncate">{s["title"]}</span></span>
                  <span className="text-xs text-muted-foreground">{timeAgo(s["updated_at"])}</span>
                </Link>
              </li>
            ))}
            {sessions.data?.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No conversations yet.</li>}
          </ul>
        </aside>

        <section className="flex min-h-[70vh] flex-col rounded-2xl border bg-card shadow-card">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-3">
              <img src={botImg} alt="ResolveAI" width={1024} height={1024} className="h-10 w-10" />
              <div>
                <p className="font-bold">ResolveAI</p>
                <p className="text-xs text-muted-foreground">AI Coordinator + 4 specialist agents</p>
              </div>
            </div>
            {session && (
              <Link to="/agents" search={{ session }} className="flex items-center gap-1 text-sm font-semibold text-primary"><Network className="h-4 w-4" /> Agent Workspace</Link>
            )}
          </div>
          <Conversation className="flex-1">
            <ConversationContent>
              {!session && !live && (
                <ConversationEmptyState
                  icon={<img src={botImg} alt="" width={1024} height={1024} className="h-20 w-20" />}
                  title="Ask ResolveAI anything about your payments"
                  description="Answers use only your own transactions — DEMO sample data or verified PayPal Sandbox records."
                />
              )}
              {persisted.map((m) => (
                <Message key={m.id} from={m.role as "user" | "assistant"}>
                  <MessageContent className={m.role === "user" ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground" : ""}>
                    {m.role === "assistant" ? (
                      <>
                        {m.agent_run && <RunMeta run={m.agent_run as unknown as AgentRun} />}
                        <MessageResponse>{m.content}</MessageResponse>
                        {m.agent_run && <AgentResultBlocks agents={(m.agent_run as unknown as AgentRun).agents} results={(m.agent_run as unknown as AgentRun).results} />}
                      </>
                    ) : (
                      m.content
                    )}
                  </MessageContent>
                </Message>
              ))}
              {showLive && live && (
                <>
                  {!persisted.some((m) => m.role === "user" && m.content === live.question) && (
                    <Message from="user"><MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">{live.question}</MessageContent></Message>
                  )}
                  <Message from="assistant">
                    <MessageContent>
                      <AgentProgress live={live} />
                      {live.text ? <MessageResponse>{live.text}</MessageResponse> : !live.done && <Shimmer>Agents are analyzing your data…</Shimmer>}
                      {live.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{live.error}</p>}
                      {live.agents.length > 0 && <AgentResultBlocks agents={live.agents} results={live.results} running={!live.done} />}
                    </MessageContent>
                  </Message>
                </>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="border-t p-3">
            <PromptInput
              onSubmit={(msg) => {
                const text = msg.text.trim();
                if (!text || busy) return;
                send({ message: text, sessionId: session ?? null, transactionId: txn ?? null });
              }}
            >
              <PromptInputTextarea placeholder="Ask anything about your payments…" maxLength={2000} />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={busy ? "streaming" : "ready"} onStop={stop} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </section>

        <aside className="hidden rounded-2xl border bg-card p-4 shadow-card xl:block">
          <h2 className="mb-3 font-bold">AI Agents</h2>
          <ul className="space-y-3">
            {(["coordinator", ...AGENT_IDS] as const).map((a) => (
              <li key={a} className="flex items-start gap-3">
                <AgentIcon agent={a} />
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold">
                    {AGENT_META[a].name}
                    {(a === "coordinator" ? busy : activeAgents.includes(a as (typeof AGENT_IDS)[number])) && <span className="h-2 w-2 animate-pulse rounded-full bg-success" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{AGENT_META[a].tagline}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
