import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { formatMoney, formatShortDateTime } from "@/lib/format";
import type { Transaction } from "@/lib/queries";
import { SourceBadge, StatusBadge } from "./badges";

export function MerchantAvatar({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-bold text-primary" aria-hidden>
      {letter}
    </span>
  );
}

export function TxTable({ rows, compact }: { rows: Transaction[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="bg-muted text-left text-xs font-semibold text-muted-foreground">
            <th className="rounded-l-lg px-3 py-2.5">Date & Time</th>
            <th className="px-3 py-2.5">Merchant / Description</th>
            <th className="px-3 py-2.5 text-right">Amount</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Source</th>
            {!compact && <th className="rounded-r-lg px-3 py-2.5 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b last:border-b-0 hover:bg-accent/50">
              <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{formatShortDateTime(t.created_at)}</td>
              <td className="px-3 py-3">
                <Link to="/transactions/$id" params={{ id: t.id }} className="flex items-center gap-2.5 font-medium hover:text-primary">
                  <MerchantAvatar name={t.merchant} />
                  <span>
                    <span className="block">{t.merchant}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{t.reference}</span>
                  </span>
                </Link>
              </td>
              <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{formatMoney(t.amount, t.currency)}</td>
              <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
              <td className="px-3 py-3"><SourceBadge source={t.source} verified={!!t.verified_at} /></td>
              {!compact && (
                <td className="px-3 py-3 text-right">
                  <Link to="/transactions/$id" params={{ id: t.id }} className="inline-flex rounded-lg p-1.5 text-primary hover:bg-primary-soft" aria-label={`View ${t.reference}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
