import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Clock, MessageSquareText, Scale, ShieldCheck, Undo2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { KV, Panel, PanelTitle } from "@/components/app/ui-bits";
import { SeverityBadge, SourceBadge, StatusBadge } from "@/components/app/badges";
import { CaptureFlow } from "@/components/app/sandbox-flow";
import { Button } from "@/components/ui/button";
import { eventsQuery, transactionsQuery } from "@/lib/queries";
import { assessTransaction } from "@/lib/fraud-rules";
import { STATUS_EXPLAIN } from "@/lib/status-explain";
import { formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/transactions/$id")({
  head: () => ({
    meta: [
      { title: "Transaction details — PayPal ResolveAI" },
      { name: "description", content: "Payment information, timeline, risk assessment and recommended actions." },
      { property: "og:title", content: "Transaction details — PayPal ResolveAI" },
      { property: "og:description", content: "Investigate a payment with ResolveAI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(transactionsQuery()),
  component: TxDetail,
});

function TxDetail() {
  const { id } = Route.useParams();
  const { data: txs } = useSuspenseQuery(transactionsQuery());
  const tx = txs.find((t) => t.id === id);
  const events = useQuery(eventsQuery(id));
  const risk = useMemo(() => (tx ? assessTransaction({ ...tx, amount: Number(tx.amount) }, txs.map((t) => ({ ...t, amount: Number(t.amount) }))) : null), [tx, txs]);
  if (!tx) return <><PageHeader title="Transaction not found" back /><PageBody><p>This transaction doesn't exist or isn't yours.</p></PageBody></>;
  const ex = STATUS_EXPLAIN[tx.status] ?? STATUS_EXPLAIN.pending!;

  return (
    <>
      <PageHeader title="Transaction Details" subtitle="Payment information, analysis, and recommended actions" back />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
          <Panel>
            <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="font-mono text-lg font-bold">{tx.reference}</h2><StatusBadge status={tx.status} /></div>
            <KV label="Merchant">{tx.merchant}</KV>
            <KV label="Amount">{formatMoney(tx.amount, tx.currency)} ({tx.currency})</KV>
            <KV label="Payment method">{tx.payment_method ?? "—"}</KV>
            <KV label="Initiated on">{formatDateTime(tx.created_at)}</KV>
            <KV label="Expected completion">{ex.expected}</KV>
            {tx.paypal_order_id && <KV label="PayPal order ID"><span className="font-mono">{tx.paypal_order_id}</span></KV>}
            {tx.paypal_capture_id && <KV label="PayPal capture ID"><span className="font-mono">{tx.paypal_capture_id}</span></KV>}
            <KV label="Data source"><SourceBadge source={tx.source} verified={!!tx.verified_at} /></KV>
          </Panel>
          <div className="space-y-5">
            <Panel>
              <PanelTitle title="What's happening?" subtitle="Standard status explanation" />
              <p className="text-sm">{ex.what}</p>
              {ex.reasons.length > 0 && <><p className="mt-3 text-sm font-semibold">Possible reasons</p><ul className="list-disc pl-5 text-sm">{ex.reasons.map((r) => <li key={r}>{r}</li>)}</ul></>}
              <p className="mt-3 text-sm font-semibold">Recommended actions</p>
              <ol className="list-decimal pl-5 text-sm">{ex.actions.map((r) => <li key={r}>{r}</li>)}</ol>
              <Button asChild className="mt-4"><Link to="/assistant" search={{ txn: tx.id, q: `Investigate transaction ${tx.reference}: explain its status, risk and my options.` }}><MessageSquareText className="h-4 w-4" /> Investigate with AI agents</Link></Button>
            </Panel>
            {risk && (
              <Panel>
                <PanelTitle icon={ShieldCheck} title="Risk Assessment" subtitle="Transparent rule-based signals — not proof of fraud" action={<SeverityBadge level={risk.level} />} />
                <p className="text-sm font-semibold">Score {risk.score}/10</p>
                <ul className="mt-2 space-y-1 text-sm">{risk.indicators.length ? risk.indicators.map((i) => <li key={i.code}>• <strong>{i.name}</strong>: {i.detail} (+{i.impact})</li>) : <li>No rules triggered.</li>}</ul>
              </Panel>
            )}
          </div>
        </div>
        {tx.source === "paypal_sandbox" && <Panel><PanelTitle title="PayPal Sandbox actions" /><CaptureFlow tx={tx} /></Panel>}
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <PanelTitle icon={Clock} title="Transaction Timeline" />
            <ol className="space-y-3">
              {(events.data ?? []).map((e) => (
                <li key={e.id} className="flex justify-between gap-3 border-l-2 border-primary pl-3 text-sm">
                  <span><span className="block font-semibold">{e.title}</span><span className="text-muted-foreground">{e.description}</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.occurred_at)}</span>
                </li>
              ))}
              {events.data?.length === 0 && <li className="text-sm text-muted-foreground">No timeline events recorded.</li>}
            </ol>
          </Panel>
          <Panel>
            <PanelTitle title="Related Actions" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="outline" className="h-14"><Link to="/refunds" search={{ txn: tx.id }}><Undo2 className="h-4 w-4" /> Check refund eligibility</Link></Button>
              <Button asChild variant="outline" className="h-14"><Link to="/disputes" search={{ txn: tx.id }}><Scale className="h-4 w-4" /> Prepare a dispute</Link></Button>
              <Button asChild variant="outline" className="h-14"><Link to="/fraud/$id" params={{ id: tx.id }}><ShieldCheck className="h-4 w-4" /> Fraud investigation</Link></Button>
              <Button asChild variant="outline" className="h-14"><a href="https://www.paypal.com/us/smarthelp/contact-us" target="_blank" rel="noopener noreferrer">Contact PayPal support</a></Button>
            </div>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
