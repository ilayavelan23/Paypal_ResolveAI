import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, Loader2, MessageSquareText, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { captureSandboxOrder, syncSandboxOrder } from "@/lib/paypal.functions";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Transaction } from "@/lib/queries";
import { KV, Stepper } from "./ui-bits";
import { SourceBadge, StatusBadge } from "./badges";

export function stepFor(tx: Transaction) {
  if (["completed", "refunded", "partially_refunded"].includes(tx.status)) return 4;
  if (tx.status === "pending") return 3;
  if (tx.status === "approved") return 2;
  return 1;
}

export function CaptureFlow({ tx }: { tx: Transaction }) {
  const qc = useQueryClient();
  const sync = useServerFn(syncSandboxOrder);
  const capture = useServerFn(captureSandboxOrder);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["events", tx.id] });
    qc.invalidateQueries({ queryKey: ["fraud_alerts"] });
  };

  const syncM = useMutation({
    mutationFn: () => sync({ data: { transactionId: tx.id } }),
    onSuccess: (r) => {
      refresh();
      if (!r.ok) toast.error(r.error);
      else if (r.paypalStatus === "APPROVED") toast.success("Buyer approval confirmed by PayPal. You can capture now.");
      else toast.info(`PayPal reports order status: ${r.paypalStatus}`);
    },
  });
  const captureM = useMutation({
    mutationFn: () => capture({ data: { transactionId: tx.id, confirm: true } }),
    onSuccess: (r) => {
      refresh();
      if (!r.ok) toast.error(r.error);
      else if (r.captureStatus === "COMPLETED") toast.success("Payment captured and verified by PayPal Sandbox.");
      else toast.warning(`PayPal returned capture status ${r.captureStatus ?? "unknown"}.`);
    },
  });

  const step = stepFor(tx);
  const captured = step >= 3;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Sandbox order</p>
          <p className="font-mono text-lg font-bold">{tx.paypal_order_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={tx.status} />
          <SourceBadge source={tx.source} verified={!!tx.verified_at} />
        </div>
      </div>

      <Stepper
        current={step}
        steps={[
          { label: "Created", sub: "Orders v2" },
          { label: "Buyer approval", sub: "PayPal Sandbox" },
          { label: "Capture", sub: "Your confirmation" },
          { label: "Verified", sub: "Read back from PayPal" },
        ]}
      />

      {!captured && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Button asChild disabled={!tx.approve_url} variant={step === 1 ? "default" : "outline"} className="h-11">
            <a href={tx.approve_url ?? "#"} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> 1. Approve in PayPal
            </a>
          </Button>
          <Button variant="outline" className="h-11" onClick={() => syncM.mutate()} disabled={syncM.isPending}>
            {syncM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} 2. Check approval
          </Button>
          <Button className="h-11" onClick={() => setConfirmOpen(true)} disabled={tx.status !== "approved" || captureM.isPending}>
            {captureM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} 3. Capture payment
          </Button>
        </div>
      )}
      {!captured && (
        <p className="text-xs text-muted-foreground">
          Approval opens PayPal Sandbox in a new tab. Log in with a Sandbox <strong>personal (buyer)</strong> account, approve, then come back and press "Check approval".
        </p>
      )}

      <div className="rounded-xl border bg-muted/40 p-4">
        <KV label="Merchant">{tx.merchant}</KV>
        <KV label="Amount">{formatMoney(tx.amount, tx.currency)}</KV>
        <KV label="PayPal order status">{tx.paypal_status ?? "—"}</KV>
        <KV label="Capture ID">{tx.paypal_capture_id ? <span className="font-mono">{tx.paypal_capture_id}</span> : "—"}</KV>
        <KV label="Capture status">{tx.paypal_capture_status ?? "—"}</KV>
        <KV label="Payer">{tx.payer_email ?? "—"}</KV>
        <KV label="Last verified with PayPal">{formatDateTime(tx.verified_at)}</KV>
      </div>

      {captured && (
        <div className="flex flex-col gap-3 rounded-xl bg-success-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="h-5 w-5" /> PayPal Sandbox confirmed capture status {tx.paypal_capture_status}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => syncM.mutate()} disabled={syncM.isPending}>
              <RefreshCw className="h-4 w-4" /> Re-verify
            </Button>
            <Button asChild size="sm">
              <Link to="/assistant" search={{ txn: tx.id, q: `Explain my PayPal Sandbox transaction ${tx.reference} — is it complete and safe?` }}>
                <MessageSquareText className="h-4 w-4" /> Ask ResolveAI to explain
              </Link>
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Capture {formatMoney(tx.amount, tx.currency)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This calls PayPal Sandbox to capture order {tx.paypal_order_id} for {tx.merchant}. Sandbox money is not real, but the capture is a real API action and cannot be undone (you can refund it afterwards).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => captureM.mutate()}>Yes, capture payment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
