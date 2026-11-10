import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { EmptyState, HeroBanner, Panel, PanelTitle } from "@/components/app/ui-bits";
import { AgentIcon, RunMeta } from "@/components/app/agent-ui";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { messagesQuery, sessionsQuery } from "@/lib/queries";
import { AGENT_META, type AgentRun } from "@/lib/agents/definitions";
import botImg from "@/assets/resolve-bot.png";

type Search = { session?: string | undefined };

export const Route = createFileRoute("/_authenticated/agents")({
  validateSearch: (s: Record<string, unknown>): Search => ({ session: typeof s["session"] === "string" ? s["session"] : undefined }),
  head: () => ({
    meta: [
      { title: "Multi-Agent Workspace — PayPal ResolveAI" },
      { name: "description", content: "See how the AI Coordinator routed your request and what each specialist agent found." },
      { property: "og:title", content: "Multi-Agent Workspace — PayPal ResolveAI" },
      { property: "og:description", content: "One request. Multiple specialized agents. One unified answer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { session } = Route.useSearch();
  const sessions = useQuery(sessionsQuery());
  const sid = session ?? sessions.data?.[0]?.id;
  const msgs = useQuery({ ...messagesQuery(sid ?? "none"), enabled: !!sid });
  const last = [...(msgs.data ?? [])].reverse().find((m) => m.role === "assistant" && m.agent_run);
  const question = last ? [...(msgs.data ?? [])].filter((m) => m.role === "user" && m.created_at <= last.created_at).pop() : undefined;
  const run = last?.agent_run as unknown as AgentRun | undefined;

  return (
    <>
      <PageHeader title="Multi-Agent AI Workspace" subtitle="AI Coordinator works with specialized agents to analyze and resolve your payment issue" />
      <PageBody>
        <HeroBanner
          icon={<img src={botImg} alt="" width={1024} height={1024} className="h-16 w-16" />}
          title="AI Multi-Agent System"
          subtitle="One request. Multiple specialized agents. A clear, unified solution."
        />
        {!run ? (
          <EmptyState icon={MessageSquareText} title="No agent analysis yet" body="Ask the AI Assistant a question to see the orchestration here." action={<Button asChild><Link to="/assistant" search={{}}>Open AI Assistant</Link></Button>} />
        ) : (
          <>
            <Panel>
              <PanelTitle title="AI Coordinator — Task Orchestration" subtitle={`Intent: ${run.intent}`} />
              <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
                <div className="rounded-xl border bg-muted p-3 text-sm md:max-w-xs">“{question?.content}”</div>
                <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-primary md:rotate-0" />
                <div className="flex items-center gap-2 rounded-xl border bg-primary-soft p-3"><AgentIcon agent="coordinator" /> <span className="font-bold">AI Coordinator</span></div>
                <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-primary md:rotate-0" />
                <ul className="grid flex-1 gap-2 sm:grid-cols-2">
                  {run.agents.map((a) => (
                    <li key={a} className="flex items-center gap-2 rounded-xl border p-2 text-sm font-semibold"><AgentIcon agent={a} className="h-7 w-7" /> {AGENT_META[a].name}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3"><RunMeta run={run} /></div>
            </Panel>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {run.results.map((r) => (
                <Panel key={r.agent}>
                  <div className="mb-2 flex items-center gap-2"><AgentIcon agent={r.agent} /><div><p className="font-bold">{AGENT_META[r.agent].name}</p><p className="text-xs text-success">Completed · {r.status_label}</p></div></div>
                  <p className="text-sm font-semibold">{r.headline}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{r.findings.map((f) => <li key={f}>{f}</li>)}</ul>
                </Panel>
              ))}
            </div>
            <section className="rounded-2xl bg-navy p-5 text-sidebar-foreground">
              <h2 className="mb-2 text-lg font-bold">Final Recommendation (AI Coordinator)</h2>
              <div className="prose-sm"><MessageResponse>{last!.content}</MessageResponse></div>
              <Button asChild className="mt-3"><Link to="/assistant" search={{ session: sid }}>Ask a follow-up</Link></Button>
            </section>
          </>
        )}
      </PageBody>
    </>
  );
}
