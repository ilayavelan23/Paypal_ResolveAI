import { Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  ChevronDown,
  Database,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Network,
  Scale,
  Settings,
  ShieldCheck,
  Undo2,
  WifiOff,
} from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { alertsQuery, profileQuery } from "@/lib/queries";
import { getPaypalStatus } from "@/lib/paypal.functions";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import botImg from "@/assets/resolve-bot.png";
import { BrandLockup } from "./brand";
import { SeverityBadge } from "./badges";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "AI Assistant", icon: MessageSquareText },
  { to: "/agents", label: "Agent Workspace", icon: Network },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/sandbox", label: "PayPal Sandbox", icon: FlaskConical },
  { to: "/fraud", label: "Fraud Detection", icon: ShieldCheck },
  { to: "/refunds", label: "Refund Center", icon: Undo2 },
  { to: "/disputes", label: "Dispute Assistant", icon: Scale },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const ShellCtx = createContext<{ openMenu: () => void }>({ openMenu: () => {} });

function usePaypalStatus() {
  const fn = useServerFn(getPaypalStatus);
  return useQuery({ queryKey: ["paypal-status"], queryFn: () => fn(), staleTime: 60_000 });
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const status = usePaypalStatus();
  const configured = status.data?.configured;
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-sidebar px-3 py-5 text-sidebar-foreground">
      <Link to="/dashboard" className="px-2" onClick={onNavigate}>
        <BrandLockup />
      </Link>
      <nav className="flex flex-col gap-1" aria-label="Main">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-elevated" : "text-sidebar-foreground/90 hover:bg-sidebar-accent",
              )}
            >
              <item.icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border pt-4">
        <p className="px-2 pb-2 text-sm font-semibold">Data Source</p>
        <ul className="space-y-2 px-2 text-sm">
          <li className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><FlaskConical className="h-4 w-4" aria-hidden /> PayPal Sandbox</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", configured ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground")}>
              {status.isLoading ? "…" : configured ? "Connected" : "Setup needed"}
            </span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Database className="h-4 w-4" aria-hidden /> Simulated Data</span>
            <span className="rounded-full bg-sidebar-primary px-2 py-0.5 text-[11px] font-semibold text-sidebar-primary-foreground">Demo</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><WifiOff className="h-4 w-4" aria-hidden /> Unavailable Data</span>
            <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-semibold text-sidebar-muted">N/A</span>
          </li>
        </ul>
      </div>
      <div className="relative mt-auto overflow-hidden rounded-2xl bg-promo p-4">
        <div className="flex items-center gap-3">
          <img src={botImg} alt="" width={1024} height={1024} loading="lazy" className="h-14 w-14 shrink-0" />
          <div>
            <p className="font-bold">ResolveAI</p>
            <p className="text-xs text-sidebar-muted">Multi-Agent AI for Payments, Refunds & Disputes</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  return (
    <ShellCtx.Provider value={{ openMenu: () => setOpen(true) }}>
      <div className="flex min-h-screen w-full bg-background">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
          <SidebarBody />
        </aside>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </ShellCtx.Provider>
  );
}

function Notifications() {
  const alerts = useQuery(alertsQuery());
  const open = (alerts.data ?? []).filter((a) => a.status === "open");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative rounded-full p-2 text-foreground hover:bg-accent" aria-label={`Notifications (${open.length} open alerts)`}>
          <Bell className="h-5 w-5" />
          {open.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-card" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 font-semibold">Risk alerts</div>
        <ul className="max-h-80 overflow-y-auto">
          {open.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No open alerts.</li>}
          {open.slice(0, 6).map((a) => (
            <li key={a.id}>
              <Link to="/fraud/$id" params={{ id: a.transaction_id }} className="flex items-start justify-between gap-2 px-4 py-3 hover:bg-accent">
                <span className="text-sm">
                  <span className="block font-medium">{a.title}</span>
                  <span className="text-xs text-muted-foreground">Score {Number(a.risk_score)}/10</span>
                </span>
                <SeverityBadge level={a.severity} />
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const me = useQuery(profileQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const name = me.data?.profile?.full_name || me.data?.user.email || "Account";
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 hover:bg-accent">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {initials(name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-bold">{name}</span>
          <span className="block text-xs text-muted-foreground">{me.data?.profile?.account_type ?? "Personal"} Account</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{me.data?.user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">Settings & profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/sandbox">PayPal Sandbox checkout</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-danger">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: string; back?: boolean; actions?: ReactNode }) {
  const { openMenu } = useContext(ShellCtx);
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur sm:px-6">
      <button className="rounded-lg p-2 hover:bg-accent lg:hidden" onClick={openMenu} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      {back && (
        <button className="hidden rounded-lg p-2 hover:bg-accent sm:block" onClick={() => router.history.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="hidden truncate text-sm text-muted-foreground sm:block">{subtitle}</p>}
      </div>
      {actions}
      <Notifications />
      <UserMenu />
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-[1500px] flex-1 space-y-5 p-4 sm:p-6", className)}>{children}</main>;
}
