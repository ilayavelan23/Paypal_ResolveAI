import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownUp, ArrowLeftRight, CheckCircle2, Clock, Database, FlaskConical, Search, XCircle } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { EmptyState, Panel } from "@/components/app/ui-bits";
import { TxTable } from "@/components/app/tx-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transactionsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions/")({
  head: () => ({
    meta: [
      { title: "Transactions — PayPal ResolveAI" },
      { name: "description", content: "Search, filter and analyze your payment activity." },
      { property: "og:title", content: "Transactions — PayPal ResolveAI" },
      { property: "og:description", content: "View, search, and analyze your payment activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(transactionsQuery()),
  component: TransactionsPage,
});

type SourceFilter = "all" | "paypal_sandbox" | "demo";

function TransactionsPage() {
  const { data: txs } = useSuspenseQuery(transactionsQuery());
  const [source, setSource] = useState<SourceFilter>("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("30");
  const [sort, setSort] = useState("date_desc");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const since = period === "all" ? 0 : Date.now() - Number(period) * 86_400_000;
    const query = q.trim().toLowerCase();
    const rows = txs.filter((t) => {
      if (source !== "all" && t.source !== source) return false;
      if (status !== "all" && t.status !== status) return false;
      if (new Date(t.created_at).getTime() < since) return false;
      if (!query) return true;
      return [t.merchant, t.description, t.reference, t.paypal_order_id, t.paypal_capture_id, String(t.amount)].some((v) => v?.toLowerCase().includes(query));
    });
    const [key, dir] = sort.split("_");
    rows.sort((a, b) => {
      const va = key === "amount" ? Number(a.amount) : new Date(a.created_at).getTime();
      const vb = key === "amount" ? Number(b.amount) : new Date(b.created_at).getTime();
      return dir === "asc" ? va - vb : vb - va;
    });
    return rows;
  }, [txs, source, status, period, sort, q]);

  const counts = {
    all: txs.length,
    paypal_sandbox: txs.filter((t) => t.source === "paypal_sandbox").length,
    demo: txs.filter((t) => t.source === "demo").length,
  };
  const stat = (s: string[]) => filtered.filter((t) => s.includes(t.status)).length;

  return (
    <>
      <PageHeader title="Transactions" subtitle="View, search, and analyze your payment activity" />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Mini icon={ArrowLeftRight} label="Total Transactions" value={filtered.length} cls="bg-info-soft text-info" />
          <Mini icon={CheckCircle2} label="Successful" value={stat(["completed"])} cls="bg-success-soft text-success" />
          <Mini icon={Clock} label="Pending" value={stat(["pending", "created", "approved", "on_hold"])} cls="bg-warning-soft text-warning" />
          <Mini icon={XCircle} label="Failed" value={stat(["failed"])} cls="bg-danger-soft text-danger" />
        </div>

        <Panel>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Data source">
              {([
                ["all", `All (${counts.all})`, ArrowLeftRight],
                ["paypal_sandbox", `PayPal Sandbox (${counts.paypal_sandbox})`, FlaskConical],
                ["demo", `Demo data (${counts.demo})`, Database],
              ] as const).map(([k, label, Icon]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={source === k}
                  onClick={() => setSource(k)}
                  className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold", source === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 w-40" aria-label="Period"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} placeholder="Search by merchant, amount, reference or PayPal ID…" className="h-10 pl-9" aria-label="Search transactions" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 w-full md:w-44" aria-label="Status filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["completed", "pending", "created", "approved", "on_hold", "failed", "refunded", "partially_refunded"].map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-10 w-full md:w-48" aria-label="Sort"><ArrowDownUp className="h-4 w-4" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest first</SelectItem>
                <SelectItem value="date_asc">Oldest first</SelectItem>
                <SelectItem value="amount_desc">Amount: high to low</SelectItem>
                <SelectItem value="amount_asc">Amount: low to high</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4">
            {filtered.length ? <TxTable rows={filtered} /> : <EmptyState icon={Search} title="No transactions match" body="Try a different search or filter." />}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <strong>Demo data</strong> is fictional sample data for exploring the app. <strong>PayPal Sandbox</strong> records were created and verified through the PayPal Sandbox API.
          </p>
        </Panel>
      </PageBody>
    </>
  );
}

function Mini({ icon: Icon, label, value, cls }: { icon: typeof Clock; label: string; value: number; cls: string }) {
  const [bg, fg] = cls.split(" ");
  return (
    <div className={cn("rounded-2xl border p-4 shadow-card", bg)}>
      <p className="flex items-center gap-2 text-sm font-medium"><Icon className={cn("h-5 w-5", fg)} /> {label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
    </div>
  );
}
