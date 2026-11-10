import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { HeroBanner, Panel, PanelTitle } from "@/components/app/ui-bits";
import { SeverityBadge, StatusBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { runFraudScan } from "@/lib/paypal.functions";
import { alertsQuery, transactionsQuery } from "@/lib/queries";
import { formatMoney, formatShortDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fraud/")({
  head: () => ({
    meta: [
      { title: "Fraud Detection — PayPal ResolveAI" },
      { name: "description", content: "Explainable risk signals and safety recommendations for your payments." },
      { property: "og:title", content: "Fraud Detection — PayPal ResolveAI" },
      { property: "og:description", content: "Monitor suspicious activity with transparent rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FraudPage,
});

function FraudPage() {
  const qc = useQueryClient();
  const alerts = useQuery(alertsQuery());
  const txs = useQuery(transactionsQuery());
  const scanFn = useServerFn(runFraudScan);
  const scan = useMutation({
    mutationFn: () => scanFn(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["fraud_alerts"] });
      r.ok ? toast.success(`Scanned ${r.scanned} transactions, ${r.flagged} flagged.`) : toast.error(r.error);
    },
  });
  const list = alerts.data ?? [];
  return (
    <>
      <PageHeader title="Fraud Detection" subtitle="Monitor suspicious activity and payment risks" />
      <PageBody>
        <HeroBanner icon={<ShieldCheck className="h-12 w-12 text-primary" />} title="Fraud Guardian" subtitle="Risk signals come from transparent rules. They are not proof of fraud." aside={<Button onClick={() => scan.mutate()} disabled={scan.isPending}>{scan.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Re-run risk scan</Button>} />
        <div className="grid grid-cols-3 gap-3">
          {(["high", "medium", "low"] as const).map((l) => (
            <Panel key={l}><p className="text-sm capitalize">{l} risk</p><p className="text-3xl font-extrabold">{list.filter((a) => a.severity === l).length}</p></Panel>
          ))}
        </div>
        <Panel>
          <PanelTitle title="Flagged Transactions" />
          <ul className="divide-y">
            {list.map((a) => {
              const t = txs.data?.find((x) => x.id === a.transaction_id);
              return (
                <li key={a.id}>
                  <Link to="/fraud/$id" params={{ id: a.transaction_id }} className="flex flex-wrap items-center gap-3 py-3 hover:text-primary">
                    <span className="flex-1"><span className="block font-semibold">{a.title}</span><span className="text-xs text-muted-foreground">{t ? `${t.merchant} · ${formatMoney(t.amount)} · ${formatShortDateTime(t.created_at)}` : ""}</span></span>
                    <span className="text-sm">{Number(a.risk_score)}/10</span>
                    <SeverityBadge level={a.severity} />
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              );
            })}
            {list.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No flagged transactions.</li>}
          </ul>
        </Panel>
      </PageBody>
    </>
  );
}
