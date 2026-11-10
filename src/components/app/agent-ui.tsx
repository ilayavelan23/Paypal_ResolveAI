import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Loader2, RefreshCw, Scale, Search, ShieldCheck, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { AGENT_META, type AgentId, type AgentResult, type AgentRun } from "@/lib/agents/definitions";
import type { LiveRun } from "@/hooks/use-agent-chat";
import { cn } from "@/lib/utils";
import { SeverityBadge, SourceBadge } from "./badges";

export const AGENT_ICON: Record<AgentId | "coordinator", LucideIcon> = {
  coordinator: Workflow,
  transaction_detective: Search,
  fraud_guardian: ShieldCheck,
  refund_assistant: RefreshCw,
  dispute_assistant: Scale,
};

export const AGENT_TONE: Record<AgentId | "coordinator", { bg: string; fg: string }> = {
  coordinator: { bg: "bg-primary-soft", fg: "text-primary" },
  transaction_detective: { bg: "bg-info-soft", fg: "text-info" },
  fraud_guardian: { bg: "bg-warning-soft", fg: "text-warning" },
  refund_assistant: { bg: "bg-success-soft", fg: "text-success" },
  dispute_assistant: { bg: "bg-violet-soft", fg: "text-violet" },
};

export function AgentIcon({ agent, className }: { agent: AgentId | "coordinator"; className?: string }) {
  const Icon = AGENT_ICON[agent];
  const t = AGENT_TONE[agent];
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", t.bg, t.fg, className)}>
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

/** One collapsed-by-default block per specialist agent inside an assistant message. */
export function AgentResultBlocks({ agents, results, running }: { agents: AgentId[]; results: AgentResult[]; running?: boolean }) {
  return (
    <div className="space-y-2">
      {agents.map((a) => {
        const r = results.find((x) => x.agent === a);
        return (
          <Tool key={a} defaultOpen={false} className="mb-0 bg-card">
            <ToolHeader type="dynamic-tool" toolName={a} title={AGENT_META[a].name} state={r ? "output-available" : running ? "input-available" : "output-error"} />
            <ToolContent>
              <div className="space-y-2 px-4 pb-4 text-sm">
                {r ? (
                  <>
                    <p className="font-semibold">{r.headline}</p>
                    <p className="text-xs text-muted-foreground">Status: {r.status_label}</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {r.findings.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground">{r.recommendation}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">{running ? "Working…" : "No result."}</p>
                )}
              </div>
            </ToolContent>
          </Tool>
        );
      })}
    </div>
  );
}

export function RunMeta({ run }: { run: Pick<AgentRun, "focus" | "risk"> }) {
  if (!run.focus && !run.risk) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {run.focus && (
        <Link to="/transactions/$id" params={{ id: run.focus.id }} className="rounded-full bg-muted px-2.5 py-0.5 font-mono font-semibold hover:text-primary">
          {run.focus.reference}
        </Link>
      )}
      {run.focus && <SourceBadge source={run.focus.source} verified={!!run.focus.verified_at} />}
      {run.risk && (
        <span className="flex items-center gap-1">
          Rule-based risk {run.risk.score}/10 <SeverityBadge level={run.risk.level} />
        </span>
      )}
    </div>
  );
}

/** Progress checklist shown while the coordinator is orchestrating. */
export function AgentProgress({ live }: { live: LiveRun }) {
  return (
    <div className="rounded-xl border bg-primary-soft/60 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        {!live.done && <Loader2 className="h-4 w-4 animate-spin text-primary" />} {live.done ? "Multi-Agent Analysis complete" : "Multi-Agent Analysis in Progress…"}
      </p>
      {!live.intent && !live.done && <p className="mt-2 text-sm text-muted-foreground">AI Coordinator is reading your request…</p>}
      <ul className="mt-2 space-y-1.5 text-sm">
        {live.agents.map((a) => {
          const done = live.results.some((r) => r.agent === a);
          const started = live.started.includes(a);
          return (
            <li key={a} className="flex items-center gap-2">
              {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : started ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className="font-semibold">{AGENT_META[a].name}</span>
              <span className="text-muted-foreground">— {done ? "done" : started ? "working…" : "queued"}</span>
            </li>
          );
        })}
        {live.agents.length > 0 && live.results.length === live.agents.length && !live.done && (
          <li className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> <span className="font-semibold">AI Coordinator</span>
            <span className="text-muted-foreground">— combining results…</span>
          </li>
        )}
      </ul>
    </div>
  );
}
