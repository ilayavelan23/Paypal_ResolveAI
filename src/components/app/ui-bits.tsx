import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>{children}</section>;
}

export function PanelTitle({
  icon: Icon,
  title,
  subtitle,
  action,
  iconClass,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  iconClass?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon && <Icon className={cn("mt-0.5 h-5 w-5 shrink-0 text-primary", iconClass)} aria-hidden />}
        <div>
          <h2 className="text-base font-bold text-foreground sm:text-lg">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function HeroBanner({
  icon,
  title,
  subtitle,
  aside,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle: string;
  aside?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-hero p-5 shadow-card sm:p-6">
      <div className="pointer-events-none absolute -right-16 -bottom-24 h-56 w-[28rem] rounded-[100%] bg-brand-sky/30 blur-2xl" aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {icon}
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-brand-navy sm:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-secondary-foreground sm:text-base">{subtitle}</p>
          </div>
        </div>
        {aside}
      </div>
    </div>
  );
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground break-all">{children}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: { label: string; sub?: string }[]; current: number }) {
  return (
    <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.label} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cn("absolute top-3.5 right-1/2 h-1 w-full -translate-y-1/2", i <= current ? "bg-success" : "bg-border")}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-4 text-[10px] font-bold",
                done && "border-success bg-success text-success-foreground",
                active && "border-primary-soft bg-primary text-primary-foreground",
                !done && !active && "border-muted bg-border text-muted-foreground",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={cn("mt-2 text-xs font-semibold sm:text-sm", active ? "text-primary" : "text-foreground")}>{s.label}</span>
            {s.sub && <span className="text-[11px] text-muted-foreground sm:text-xs">{s.sub}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
