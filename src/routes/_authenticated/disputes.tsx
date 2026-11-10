import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Circle, Scale, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { HeroBanner, Panel, PanelTitle } from "@/components/app/ui-bits";
import { SourceBadge, StatusBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { disputesQuery, evidenceQuery, transactionsQuery } from "@/lib/queries";
import { DISPUTE_REASON_LABEL, formatMoney } from "@/lib/format";

type Search = { txn?: string };
const CHECKLIST = [
  ["order_confirmation", "Transaction or order confirmation"],
  ["seller_communication", "Communication with the seller"],
  ["proof_of_issue", "Proof of non-delivery / issue"],
  ["additional_details", "Additional details (optional)"],
] as const;
const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];

export const Route = createFileRoute("/_authenticated/disputes")({
  validateSearch: (s: Record<string, unknown>): Search => ({ txn: typeof s.txn === "string" ? s.txn : undefined }),
  head: () => ({
    meta: [
      { title: "Dispute Assistant — PayPal ResolveAI" },
      { name: "description", content: "Prepare dispute case files, organize evidence and track status." },
      { property: "og:title", content: "Dispute Assistant — PayPal ResolveAI" },
      { property: "og:description", content: "Dispute summaries and evidence checklists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DisputesPage,
});

function DisputesPage() {
  const { txn } = Route.useSearch();
  const qc = useQueryClient();
  const txs = useQuery(transactionsQuery());
  const disputes = useQuery(disputesQuery());
  const [selected, setSelected] = useState<string | undefined>();
  const dispute = disputes.data?.find((d) => d.id === (selected ?? disputes.data?.[0]?.id));
  const evidence = useQuery({ ...evidenceQuery(dispute?.id ?? "none"), enabled: !!dispute });
  const [newTx, setNewTx] = useState<string | undefined>(txn);
  const [reason, setReason] = useState("item_not_received");
  const [desc, setDesc] = useState("");
  const [item, setItem] = useState<string>("order_confirmation");

  async function create() {
    if (!newTx) return toast.error("Choose a transaction");
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("disputes").insert({ user_id: u.user!.id, transaction_id: newTx, reference: `CASE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, reason, description: desc.slice(0, 1000), status: "draft" }).select("id").single();
    if (error) return toast.error(error.message);
    setSelected(data.id);
    setDesc("");
    qc.invalidateQueries({ queryKey: ["disputes"] });
    toast.success("Case file created");
  }

  async function upload(file: File) {
    if (!dispute) return;
    if (!ALLOWED.includes(file.type)) return toast.error("Only JPG, PNG or PDF files are allowed.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Max 10 MB per file.");
    const { data: u } = await supabase.auth.getUser();
    const path = `${u.user!.id}/${dispute.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_").slice(0, 80)}`;
    const up = await supabase.storage.from("dispute-evidence").upload(path, file, { contentType: file.type });
    if (up.error) return toast.error(up.error.message);
    const { error } = await supabase.from("dispute_evidence").insert({ user_id: u.user!.id, dispute_id: dispute.id, file_name: file.name.slice(0, 120), file_path: path, file_size: file.size, mime_type: file.type, checklist_item: item });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["evidence", dispute.id] });
    toast.success("Evidence uploaded");
  }

  async function remove(id: string, path: string | null) {
    if (path) await supabase.storage.from("dispute-evidence").remove([path]);
    await supabase.from("dispute_evidence").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["evidence", dispute?.id] });
  }

  async function setStatus(status: string) {
    if (!dispute) return;
    await supabase.from("disputes").update({ status }).eq("id", dispute.id);
    qc.invalidateQueries({ queryKey: ["disputes"] });
  }

  const t = txs.data?.find((x) => x.id === dispute?.transaction_id);
  const done = new Set((evidence.data ?? []).map((e) => e.checklist_item));

  return (
    <>
      <PageHeader title="Dispute Management & Evidence Center" subtitle="Prepare a dispute case file, organize evidence and track status" />
      <PageBody>
        <HeroBanner icon={<Scale className="h-12 w-12 text-violet" />} title="Dispute Assistant" subtitle="Case files are prepared in ResolveAI. File the dispute itself in PayPal's Resolution Center." />
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Panel>
            <PanelTitle title="Start a case file" />
            <div className="space-y-3">
              <Select value={newTx} onValueChange={setNewTx}>
                <SelectTrigger aria-label="Transaction"><SelectValue placeholder="Choose transaction" /></SelectTrigger>
                <SelectContent>{(txs.data ?? []).map((x) => <SelectItem key={x.id} value={x.id}>{x.reference} · {x.merchant} · {formatMoney(x.amount)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger aria-label="Reason"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DISPUTE_REASON_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} placeholder="Describe what happened" />
              <Button onClick={create}>Create case file</Button>
            </div>
            <PanelTitle title="Your cases" />
            <ul className="space-y-1">
              {(disputes.data ?? []).map((d) => (
                <li key={d.id}><button onClick={() => setSelected(d.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent ${d.id === dispute?.id ? "bg-primary-soft" : ""}`}><span className="font-mono">{d.reference}</span><StatusBadge status={d.status} /></button></li>
              ))}
            </ul>
          </Panel>
          {dispute && (
            <Panel>
              <PanelTitle title={`Case ${dispute.reference}`} subtitle={`${DISPUTE_REASON_LABEL[dispute.reason]} · ${t?.merchant ?? ""} ${t ? formatMoney(t.amount) : ""}`} action={<SourceBadge source={dispute.source === "demo" ? "demo" : t?.source ?? "demo"} />} />
              <div className="mb-4 flex flex-wrap gap-2">
                {["draft", "evidence_submitted", "under_review", "resolved", "closed"].map((s) => <Button key={s} size="sm" variant={dispute.status === s ? "default" : "outline"} onClick={() => setStatus(s)}>{s.replace("_", " ")}</Button>)}
              </div>
              <p className="mb-2 text-sm font-semibold">Evidence checklist ({done.size}/4)</p>
              <ul className="mb-4 space-y-1 text-sm">{CHECKLIST.map(([k, l]) => <li key={k} className="flex items-center gap-2">{done.has(k) ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}{l}</li>)}</ul>
              <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center">
                <Select value={item} onValueChange={setItem}><SelectTrigger className="sm:w-64" aria-label="Checklist item"><SelectValue /></SelectTrigger><SelectContent>{CHECKLIST.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Upload className="h-4 w-4" /> Upload (JPG, PNG, PDF ≤ 10 MB)<input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /></label>
              </div>
              <ul className="mt-3 divide-y text-sm">
                {(evidence.data ?? []).map((e) => <li key={e.id} className="flex items-center justify-between py-2"><span>{e.file_name} <span className="text-xs text-muted-foreground">· {(e.file_size / 1024).toFixed(0)} KB{e.note ? ` · ${e.note}` : ""}</span></span><button aria-label="Delete" onClick={() => remove(e.id, e.file_path)}><Trash2 className="h-4 w-4 text-danger" /></button></li>)}
              </ul>
            </Panel>
          )}
        </div>
      </PageBody>
    </>
  );
}
