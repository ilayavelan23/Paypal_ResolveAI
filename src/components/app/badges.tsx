import { CheckCircle2, Database, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-success-soft text-success" },
  pending: { label: "Pending", cls: "bg-warning-soft text-warning-foreground" },
  created: { label: "Awaiting approval", cls: "bg-info-soft text-info" },
  approved: { label: "Approved", cls: "bg-info-soft text-info" },
  failed: { label: "Failed", cls: "bg-danger-soft text-danger" },
  on_hold: { label: "On hold", cls: "bg-warning-soft text-warning-foreground" },
  refunded: { label: "Refunded", cls: "bg-violet-soft text-violet" },
  partially_refunded: { label: "Partially refunded", cls: "bg-violet-soft text-violet" },
  voided: { label: "Voided", cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  // refunds
  requested: { label: "Requested", cls: "bg-info-soft text-info" },
  under_review: { label: "Under review", cls: "bg-info-soft text-info" },
  processing: { label: "Processing", cls: "bg-info-soft text-info" },
  // disputes
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  opened: { label: "Opened", cls: "bg-info-soft text-info" },
  evidence_submitted: { label: "Evidence ready", cls: "bg-info-soft text-info" },
  resolved: { label: "Resolved", cls: "bg-success-soft text-success" },
  closed: { label: "Closed", cls: "bg-muted text-muted-foreground" },
  // alerts
  open: { label: "Open", cls: "bg-warning-soft text-warning-foreground" },
  confirmed_legit: { label: "Confirmed by you", cls: "bg-success-soft text-success" },
  reported: { label: "Reported", cls: "bg-danger-soft text-danger" },
  dismissed: { label: "Dismissed", cls: "bg-muted text-muted-foreground" },
};

export function statusLabel(status: string) {
  return STATUS_STYLES[status]?.label ?? status;
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", s.cls, className)}>
      {s.label}
    </span>
  );
}

export function SourceBadge({ source, verified, className }: { source: string; verified?: boolean; className?: string }) {
  if (source === "paypal_sandbox") {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary whitespace-nowrap", className)}>
        <FlaskConical className="h-3 w-3" aria-hidden />
        PayPal Sandbox
        {verified && <CheckCircle2 className="h-3 w-3 text-success" aria-label="verified" />}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground whitespace-nowrap", className)}>
      <Database className="h-3 w-3" aria-hidden />
      Demo data
    </span>
  );
}

export function SeverityBadge({ level, className }: { level: string; className?: string }) {
  const map: Record<string, string> = {
    high: "bg-danger-soft text-danger",
    medium: "bg-warning-soft text-warning-foreground",
    low: "bg-success-soft text-success",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", map[level] ?? "bg-muted", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {level}
    </span>
  );
}
