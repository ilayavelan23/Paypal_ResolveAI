import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { HeroBanner, Panel, PanelTitle } from "@/components/app/ui-bits";
import { CaptureFlow } from "@/components/app/sandbox-flow";
import { TxTable } from "@/components/app/tx-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSandboxOrder, getPaypalStatus } from "@/lib/paypal.functions";
import { transactionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/sandbox")({
  head: () => ({
    meta: [
      { title: "PayPal Sandbox checkout — PayPal ResolveAI" },
      { name: "description", content: "Create, approve and capture a real PayPal Sandbox test payment." },
      { property: "og:title", content: "PayPal Sandbox checkout — PayPal ResolveAI" },
      { property: "og:description", content: "Run a verified PayPal Sandbox payment end-to-end." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SandboxPage,
});

function SandboxPage() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getPaypalStatus);
  const createFn = useServerFn(createSandboxOrder);
  const status = useQuery({ queryKey: ["paypal-status"], queryFn: () => statusFn() });
  const txs = useQuery(transactionsQuery());
  const sandbox = (txs.data ?? []).filter((t) => t.source === "paypal_sandbox");
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = sandbox.find((t) => t.id === activeId) ?? sandbox[0];
  const [merchant, setMerchant] = useState("ResolveAI Test Store");
  const [description, setDescription] = useState("Sandbox test order");
  const [amount, setAmount] = useState("49.99");
  const [key, setKey] = useState(() => crypto.randomUUID());

  const create = useMutation({
    mutationFn: () => createFn({ data: { merchant, description, amount: Number(amount), idempotencyKey: key } }),
    onSuccess: async (r) => {
      if (!r.ok) { toast.error(r.error); return; }
      setKey(crypto.randomUUID());
      await qc.invalidateQueries({ queryKey: ["transactions"] });
      setActiveId(r.transactionId);
      toast.success("Order created in PayPal Sandbox. Approve it next.");
    },
  });

  const amt = Number(amount);
  const valid = merchant.trim().length >= 2 && amt >= 1 && amt <= 5000;

  return (
    <>
      <PageHeader title="PayPal Sandbox" subtitle="Create, approve and capture a verified test payment" />
      <PageBody>
        <HeroBanner icon={<FlaskConical className="h-12 w-12 text-primary" />} title="Sandbox Payment Flow" subtitle="Orders v2 → buyer approval → capture → verified read-back. Sandbox money is not real." />
        {status.data && !status.data.configured && (
          <Panel className="flex items-start gap-3 border-warning bg-warning-soft">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
            <p className="text-sm">PayPal Sandbox credentials are not configured yet. Add <strong>PAYPAL_CLIENT_ID</strong> and <strong>PAYPAL_CLIENT_SECRET</strong> from your PayPal Developer Sandbox app to enable this flow.</p>
          </Panel>
        )}
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <Panel>
            <PanelTitle title="1. Create a test order" />
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate(); }}>
              <div className="space-y-1.5"><Label htmlFor="m">Merchant name</Label><Input id="m" value={merchant} maxLength={60} onChange={(e) => setMerchant(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="d">Description</Label><Input id="d" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="a">Amount (USD, 1–5000)</Label><Input id="a" type="number" min={1} max={5000} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div className="flex gap-2">{["9.99", "49.99", "249.99"].map((v) => <Button key={v} type="button" variant="outline" size="sm" onClick={() => setAmount(v)}>${v}</Button>)}</div>
              <Button type="submit" className="h-11 w-full" disabled={!valid || create.isPending || status.data?.configured === false}>
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create Sandbox order
              </Button>
            </form>
          </Panel>
          <Panel>
            <PanelTitle title="2. Approve & capture" subtitle={active ? undefined : "Create an order to begin."} />
            {active && <CaptureFlow tx={active} />}
          </Panel>
        </div>
        <Panel>
          <PanelTitle title="Your verified Sandbox transactions" />
          {sandbox.length ? <TxTable rows={sandbox} /> : <p className="text-sm text-muted-foreground">None yet.</p>}
        </Panel>
      </PageBody>
    </>
  );
}
