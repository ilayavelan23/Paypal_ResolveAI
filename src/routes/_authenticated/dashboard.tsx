import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, startOfDay, subDays } from "date-fns";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  FlaskConical,
  Info,
  ListChecks,
  MessageCircle,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  Undo2,
  XCircle,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { HeroBanner, Panel, PanelTitle } from "@/components/app/ui-bits";
import { TxTable } from "@/components/app/tx-table";
import { BrandMark } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { alertsQuery, disputesQuery, profileQuery, refundsQuery, transactionsQuery } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import botImg from "@/assets/resolve-bot.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PayPal ResolveAI" },
      { name: "description", content: "Overview of your payments, risks, refunds, disputes and AI insights." },
      { property: "og:title", content: "Dashboard — PayPal ResolveAI" },
      { property: "og:description", content: "Your payments, risks and AI insights at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(transactionsQuery()),
      context.queryClient.ensureQueryData(alertsQuery()),
      context.queryClient.ensureQueryData(refundsQuery()),
      context.queryClient.ensureQueryData(disputesQuery()),
      context.queryClient.ensureQueryData(profileQuery()),
    ]),
  component: Dashboard,
});

const SUGGESTIONS = [
  { q: "Why is my payment pending?", icon: Clock },
  { q: "Is my most recent large transaction safe?", icon: ShieldCheck },
  { q: "How can I get a refund?", icon: Undo2 },
  { q: "Help me with a dispute", icon: MessageCircle },
];

function Dashboard() {
  const { data: txs } = useSuspenseQuery(transactionsQuery());
  const { data: alerts } = useSuspenseQuery(alertsQuery());
  const { data: refunds } = useSuspenseQuery(refundsQuery());
  const { data: disputes } = useSuspenseQuery(disputesQuery());
  const { data: me } = useSuspenseQuery(profileQuery());
  const [days, setDays] = useState("30");

  const stats = useMemo(() => {
    const completed = txs.filter((t) => t.status === "completed").length;
    const pending = txs.filter((t) => ["pending", "created", "approved", "on_hold"].includes(t.status)).length;
    const failed = txs.filter((t) => t.status === "failed").length;
    const sandbox = txs.filter((t) => t.source === "paypal_sandbox").length;
    return { total: txs.length, completed, pending, failed, sandbox };
  }, [txs]);

  const chart = useMemo(() => {
    const n = Number(days);
    const start = startOfDay(subDays(new Date(), n - 1));
    const buckets = Array.from({ length: n }, (_, i) => ({ day: subDays(new Date(), n - 1 - i), count: 0, volume: 0 }));
    for (const t of txs) {
      const d = new Date(t.created_at);
      if (d < start) continue;
      const idx = Math.floor((startOfDay(d).getTime() - start.getTime()) / 86_400_000);
      if (buckets[idx]) {
        buckets[idx].count += 1;
        buckets[idx].volume += Number(t.amount);
      }
    }
    return buckets.map((b) => ({ label: format(b.day, "MMM dd"), count: b.count, volume: Math.round(b.volume * 100) / 100 }));
  }, [txs, days]);

  const openAlerts = alerts.filter((a) => a.status === "open");
  const high = openAlerts.filter((a) => a.severity === "high").length;
  const settled = stats.completed + stats.failed;
  const health = Math.max(0, Math.min(100, Math.round((settled ? (stats.completed / settled) * 100 : 100) - high * 6 - (openAlerts.length - high) * 2)));
  const firstName = me?.profile?.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your payments, risks, and AI insights" />
      <PageBody>
        <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
          <div className="min-w-0 space-y-5">
            <HeroBanner
              title={<>Welcome{firstName ? `, ${firstName}` : ""} to PayPal ResolveAI 👋</>}
              subtitle="Your intelligent assistant for payments, fraud checks, refunds and disputes."
              aside={<BrandMark className="hidden h-16 sm:block" />}
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard tone="info" icon={ArrowLeftRight} label="Total Transactions" value={stats.total} note={`${stats.sandbox} Sandbox · ${stats.total - stats.sandbox} Demo`} />
              <StatCard tone="success" icon={CheckCircle2} label="Successful" value={stats.completed} note={pct(stats.completed, stats.total)} />
              <StatCard tone="warning" icon={Clock} label="Pending" value={stats.pending} note={pct(stats.pending, stats.total)} />
              <StatCard tone="danger" icon={XCircle} label="Failed" value={stats.failed} note={pct(stats.failed, stats.total)} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <Panel>
                <PanelTitle
                  icon={BarChart3}
                  title="Transaction Overview"
                  action={
                    <Select value={days} onValueChange={setDays}>
                      <SelectTrigger className="h-9 w-36" aria-label="Period"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 Days</SelectItem>
                        <SelectItem value="30">Last 30 Days</SelectItem>
                        <SelectItem value="90">Last 90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  }
                />
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart} margin={{ left: -20, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="fillTx" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} formatter={(v: number, n: string) => (n === "volume" ? formatMoney(v) : v)} />
                      <Area type="monotone" dataKey="count" name="Transactions" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#fillTx)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel>
                <PanelTitle
                  icon={ShieldCheck}
                  title="Risk Signals"
                  action={<span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">{openAlerts.length} active alerts</span>}
                />
                <ul className="divide-y">
                  {openAlerts.slice(0, 3).map((a) => {
                    const t = txs.find((x) => x.id === a.transaction_id);
                    return (
                      <li key={a.id}>
                        <Link to="/fraud/$id" params={{ id: a.transaction_id }} className="flex items-center gap-3 py-3 hover:text-primary">
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", a.severity === "high" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>
                            {a.severity === "high" ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{a.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{t ? `${t.merchant} · ${formatMoney(t.amount)}` : ""} · {Number(a.risk_score)}/10</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                  {openAlerts.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No open risk signals.</li>}
                </ul>
              </Panel>
            </div>

            <Panel>
              <PanelTitle
                icon={ListChecks}
                title="Recent Transactions"
                action={<Link to="/transactions" className="flex items-center gap-1 text-sm font-semibold text-primary">View All <ArrowRight className="h-4 w-4" /></Link>}
              />
              <TxTable rows={txs.slice(0, 6)} compact />
            </Panel>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniLink to="/refunds" icon={Undo2} label="Refunds" value={`${refunds.length} total · ${refunds.filter((r) => r.status === "processing" || r.status === "requested").length} in progress`} />
              <MiniLink to="/disputes" icon={Scale} label="Disputes" value={`${disputes.length} case file${disputes.length === 1 ? "" : "s"}`} />
              <MiniLink to="/sandbox" icon={FlaskConical} label="PayPal Sandbox" value={stats.sandbox ? `${stats.sandbox} verified record${stats.sandbox === 1 ? "" : "s"}` : "Create a test payment"} />
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl bg-navy p-5 text-sidebar-foreground shadow-elevated">
              <div className="flex items-start gap-3">
                <img src={botImg} alt="" width={1024} height={1024} loading="lazy" className="h-16 w-16" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-bold">AI Assistant</h2>
                    <span className="flex items-center gap-1.5 rounded-full bg-sidebar-accent px-2.5 py-1 text-xs"><span className="h-2 w-2 rounded-full bg-success" /> Online</span>
                  </div>
                  <p className="font-medium">Chat with ResolveAI</p>
                  <p className="text-sm text-sidebar-muted">Get instant help for transactions, refunds, disputes, and more.</p>
                </div>
              </div>
              <Button asChild className="mt-4 h-11 w-full bg-primary-soft text-primary hover:bg-primary-soft/90">
                <Link to="/assistant" search={{}}>Start a new conversation <Plus className="h-4 w-4" /></Link>
              </Button>
              <p className="mt-4 text-sm font-medium">Try asking:</p>
              <ul className="mt-2 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s.q}>
                    <Link to="/assistant" search={{ q: s.q }} className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5 text-sm hover:bg-sidebar-accent">
                      <s.icon className="h-4 w-4 text-sidebar-muted" /> <span className="flex-1">{s.q}</span> <ChevronRight className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <Panel>
              <PanelTitle icon={Sparkles} title="Daily Payment-Health Summary" subtitle="Computed from your transactions and risk rules" />
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <HealthRing value={health} />
                <ul className="flex-1 space-y-2.5 text-sm">
                  <Check ok={stats.completed >= stats.failed} text={stats.completed >= stats.failed ? "Most transactions are successful" : "Many payments are failing"} />
                  <Check ok={stats.pending === 0} warn text={`${stats.pending} transaction${stats.pending === 1 ? "" : "s"} need your attention`} />
                  <Check ok={high === 0} text={high === 0 ? "No high-risk signals open" : `${high} high-risk signal${high === 1 ? "" : "s"} to review`} />
                  <Check ok={openAlerts.length <= 1} warn text={`${openAlerts.length} open risk alert${openAlerts.length === 1 ? "" : "s"}`} />
                </ul>
              </div>
              <div className="mt-5 rounded-xl bg-primary-soft p-4">
                <p className="flex items-center gap-2 font-semibold text-primary"><Sparkles className="h-4 w-4" /> ResolveAI Insight</p>
                <p className="mt-1 text-sm text-secondary-foreground">
                  {openAlerts.length
                    ? `Review the ${openAlerts.length} flagged transaction${openAlerts.length === 1 ? "" : "s"} to keep your account secure. Risk signals are rule-based and not proof of fraud.`
                    : "Your payment activity looks healthy. No rule-based risk signals are open."}
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}% of total` : "—";
}

const TONES = {
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

function StatCard({ tone, icon: Icon, label, value, note }: { tone: keyof typeof TONES; icon: typeof Clock; label: string; value: number; note: string }) {
  return (
    <div className={cn("rounded-2xl border p-4 shadow-card", TONES[tone].split(" ")[0])}>
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-card", TONES[tone].split(" ")[1])}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
      <p className="text-3xl font-extrabold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function MiniLink({ to, icon: Icon, label, value }: { to: "/refunds" | "/disputes" | "/sandbox"; icon: typeof Clock; label: string; value: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card hover:border-primary">
      <Icon className="h-6 w-6 text-primary" />
      <span className="flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{value}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function Check({ ok, text, warn }: { ok: boolean; text: string; warn?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-5 w-5 text-success" /> : warn ? <AlertTriangle className="h-5 w-5 text-warning" /> : <XCircle className="h-5 w-5 text-danger" />}
      {text}
    </li>
  );
}

function HealthRing({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--success)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold">{value}%</span>
        <span className="text-xs text-muted-foreground">Health Score</span>
      </div>
    </div>
  );
}
