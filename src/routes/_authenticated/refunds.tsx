import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { HeroBanner, Panel, PanelTitle } from "@/components/app/ui-bits";
import { SourceBadge, StatusBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { refundSandboxCapture } from "@/lib/paypal.functions";
import { refundsQuery, transactionsQuery } from "@/lib/queries";
import { checkRefundEligibility } from "@/lib/refund-eligibility";
import { formatDate, formatMoney } from "@/lib/format";

type Search = { txn?: string | undefined };

export const Route = createFileRoute("/_authenticated/refunds")({
  validateSearch: (s: Record<string, unknown>): Search => ({ txn: typeof s["txn"] === "string" ? s["txn"] : undefined }),
  head: () => ({
    meta: [
      { title: "Refund Center — PayPal ResolveAI" },
      { name: "description", content: "Track refunds, check eligibility and get guidance." },
      { property: "og:title", content: "Refund Center — PayPal ResolveAI" },
      { property: "og:description", content: "Refund tracking and eligibility guidance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  const { txn } = Route.useSearch();
  const qc = useQueryClient();
  const txs = useQuery(transactionsQuery());
  const refunds = useQuery(refundsQuery());
  const refundFn = useServerFn(refundSandboxCapture);
  const [sel, setSel] = useState<string | undefined>(txn);
  const [open, setOpen] = useState(false);
  const tx = txs.data?.find((t) => t.id === (sel ?? txs.data?.[0]?.id));
  const txRefunds = (refunds.data ?? []).filter((r) => r.transaction_id === tx?.id);
  const elig = tx ? checkRefundEligibility({ ...tx, amount: Number(tx.amount) }, txRefunds.map((r) => ({ amount: Number(r.amount), status: r.status }))) : null;
  const [key, setKey] = useState(() => crypto.randomUUID());

  const refund = useMutation({
    mutationFn: () => refundFn({ data: { transactionId: tx!.id, amount: elig!.refundableAmount, reason: "Requested via ResolveAI", confirm: true, idempotencyKey: key } }),
    onSuccess: (r) => {
      setKey(crypto.randomUUID());
      qc.invalidateQueries({ queryKey: ["refunds"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      r.ok ? toast.success(`PayPal Sandbox refund ${r.refundId}: ${r.status}`) : toast.error(r.error);
    },
  });

  return (
    <>
      <PageHeader title="Refund Center" subtitle="Track your refund, check eligibility, and get guidance" />
      <PageBody>
        <HeroBanner icon={<Undo2 className="h-12 w-12 text-primary" />} title="Refund Assistant" subtitle="Eligibility guidance is deterministic; PayPal or the merchant makes the final decision." />
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <PanelTitle title="Refund Eligibility Check" />
            <Select value={tx?.id ?? ""} onValueChange={setSel}>
              <SelectTrigger aria-label="Transaction"><SelectValue placeholder="Choose a transaction" /></SelectTrigger>
              <SelectContent>{(txs.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.reference} · {t.merchant} · {formatMoney(t.amount)}</SelectItem>)}</SelectContent>
            </Select>
            {tx && elig && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2"><SourceBadge source={tx.source} /><StatusBadge status={tx.status} /></div>
                <p className={`rounded-xl p-3 text-lg font-bold ${elig.verdict === "eligible" ? "bg-success-soft text-success" : "bg-warning-soft text-warning-foreground"}`}>{elig.title}</p>
                <ul className="space-y-1 text-sm">{elig.checks.map((c) => <li key={c.label} className="flex items-center gap-2">{c.passed ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}{c.label}</li>)}</ul>
                <ol className="list-decimal pl-5 text-sm text-muted-foreground">{elig.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
                {elig.canRefundViaSandboxApi && <Button onClick={() => setOpen(true)} disabled={refund.isPending}>Refund {formatMoney(elig.refundableAmount)} via PayPal Sandbox</Button>}
              </div>
            )}
          </Panel>
          <Panel>
            <PanelTitle title="My Refund Requests" />
            <ul className="divide-y text-sm">
              {(refunds.data ?? []).map((r) => {
                const t = txs.data?.find((x) => x.id === r.transaction_id);
                return <li key={r.id} className="flex items-center justify-between gap-2 py-2"><span><span className="block font-semibold">{t?.merchant}</span><span className="text-xs text-muted-foreground">{t?.reference} · {formatDate(r.created_at)}</span></span><span>{formatMoney(r.amount)}</span><SourceBadge source={r.source} /><StatusBadge status={r.status} /></li>;
              })}
              {refunds.data?.length === 0 && <li className="py-4 text-muted-foreground">No refunds yet.</li>}
            </ul>
          </Panel>
        </div>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Refund {elig ? formatMoney(elig.refundableAmount) : ""}?</AlertDialogTitle>
              <AlertDialogDescription>This sends a real refund request to PayPal Sandbox for capture {tx?.paypal_capture_id}. It cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => refund.mutate()}>Yes, refund</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageBody>
    </>
  );
}
