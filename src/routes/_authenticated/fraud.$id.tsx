import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, MessageSquareText, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { KV, Panel, PanelTitle } from "@/components/app/ui-bits";
import { SeverityBadge, SourceBadge, StatusBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { alertsQuery, transactionsQuery } from "@/lib/queries";
import { assessTransaction } from "@/lib/fraud-rules";
import { formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fraud/$id")({
  head: () => ({
    meta: [
      { title: "Fraud Investigation — PayPal ResolveAI" },
      { name: "description", content: "Detailed risk indicators and recommendations for a transaction." },
      { property: "og:title", content: "Fraud Investigation — PayPal ResolveAI" },
      { property: "og:description", content: "Explainable risk analysis for a suspicious transaction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FraudDetail,
});

function FraudDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const txs = useQuery(transactionsQuery());
  const alerts = useQuery(alertsQuery());
  const [confirm, setConfirm] = useState<null | "confirmed_legit" | "reported">(null);
  const tx = txs.data?.find((t) => t.id === id);
  const alert = alerts.data?.find((a) => a.transaction_id === id);
  const risk = useMemo(() => (tx && txs.data ? assessTransaction({ ...tx, amount: Number(tx.amount) }, txs.data.map((t) => ({ ...t, amount: Number(t.amount) }))) : null), [tx, txs.data]);

  async function setStatus(status: "confirmed_legit" | "reported") {
    if (!alert) return;
    const { error } = await supabase.from("fraud_alerts").update({ status }).eq("id", alert.id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "reported" ? "Marked as reported. Secure your account and contact PayPal." : "Thanks — marked as authorized by you.");
    qc.invalidateQueries({ queryKey: ["fraud_alerts"] });
  }

  if (!tx || !risk) return <><PageHeader title="Fraud Investigation" back /><PageBody><p className="text-sm text-muted-foreground">Loading…</p></PageBody></>;
  return (
    <>
      <PageHeader title="Fraud Investigation" subtitle="Risk analysis, indicators, and recommendations" back />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <div className="mb-3 flex items-center gap-2"><h2 className="font-mono text-lg font-bold">{tx.reference}</h2><StatusBadge status={tx.status} /></div>
            <KV label="Merchant">{tx.merchant}</KV>
            <KV label="Amount">{formatMoney(tx.amount, tx.currency)}</KV>
            <KV label="Date">{formatDateTime(tx.created_at)}</KV>
            <KV label="Location">{tx.location ?? "—"}</KV>
            <KV label="Source"><SourceBadge source={tx.source} verified={!!tx.verified_at} /></KV>
            {alert && <KV label="Review status"><StatusBadge status={alert.status} /></KV>}
          </Panel>
          <Panel>
            <PanelTitle icon={ShieldAlert} title={`Risk Score ${risk.score}/10`} subtitle="Rule-based signals, not a fraud verdict" action={<SeverityBadge level={risk.level} />} />
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1">Indicator</th><th>Details</th><th className="text-right">Impact</th></tr></thead>
              <tbody>
                {risk.indicators.map((i) => <tr key={i.code} className="border-t"><td className="py-2 font-semibold">{i.name}</td><td>{i.detail}</td><td className="text-right text-danger">+{i.impact}</td></tr>)}
                {risk.indicators.length === 0 && <tr><td colSpan={3} className="py-3 text-muted-foreground">No rules triggered for this transaction.</td></tr>}
              </tbody>
            </table>
          </Panel>
        </div>
        <Panel>
          <PanelTitle title="Next Steps" subtitle="Your confirmation is required" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Button className="h-14" disabled={!alert} onClick={() => setConfirm("confirmed_legit")}><CheckCircle2 className="h-4 w-4" /> This was me</Button>
            <Button variant="outline" className="h-14 border-danger text-danger" disabled={!alert} onClick={() => setConfirm("reported")}><ShieldAlert className="h-4 w-4" /> Not me — report</Button>
            <Button asChild variant="outline" className="h-14"><Link to="/assistant" search={{ txn: tx.id, q: `Is transaction ${tx.reference} safe? Explain its risk signals.` }}><MessageSquareText className="h-4 w-4" /> Ask Fraud Guardian</Link></Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Marking a transaction here records your review in ResolveAI only. To report unauthorized activity to PayPal, use PayPal's Resolution Center.</p>
        </Panel>
        <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm === "reported" ? "Report this transaction?" : "Confirm you authorized this payment?"}</AlertDialogTitle>
              <AlertDialogDescription>{tx.merchant} · {formatMoney(tx.amount)} · {tx.reference}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirm && setStatus(confirm)}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageBody>
    </>
  );
}
