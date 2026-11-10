import { cn } from "@/lib/utils";

/** Stylised "P" mark used for the ResolveAI brand. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 56" className={cn("h-9 w-auto", className)} aria-hidden="true">
      <defs>
        <linearGradient id="pm-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.17 240)" />
          <stop offset="1" stopColor="oklch(0.5 0.2 258)" />
        </linearGradient>
        <linearGradient id="pm-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.78 0.13 232)" />
          <stop offset="1" stopColor="oklch(0.62 0.17 245)" />
        </linearGradient>
      </defs>
      <path d="M8 2h20c10 0 16 6 14.5 15.5C41 27 34 32 25 32h-7l-3.2 20H3.5L8 2Z" fill="url(#pm-a)" />
      <path d="M17 12h14c6.5 0 10 4 9 10-1.2 7.5-7 11-14 11h-5l-3 19H8.5L17 12Z" fill="url(#pm-b)" opacity="0.92" />
    </svg>
  );
}

export function BrandLockup({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="leading-tight">
        <div className={cn("text-lg font-bold tracking-tight", tone === "light" ? "text-sidebar-foreground" : "text-foreground")}>
          PayPal ResolveAI
        </div>
        <div className={cn("text-[11px] font-medium", tone === "light" ? "text-sidebar-muted" : "text-muted-foreground")}>
          AI-Powered Payment Assistant
        </div>
      </div>
    </div>
  );
}
