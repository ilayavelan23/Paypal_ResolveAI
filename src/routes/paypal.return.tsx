import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { syncSandboxOrder } from "@/lib/paypal.functions";
import { BrandLockup } from "@/components/app/brand";
import { CaptureFlow } from "@/components/app/sandbox-flow";
import { Panel } from "@/components/app/ui-bits";

type Search = { token?: string; PayerID?: string; cancelled?: string };

export const Route = createFileRoute("/paypal/return")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token.slice(0, 64) : undefined,
    PayerID: typeof s.PayerID === "string" ? s.PayerID.slice(0, 64) : undefined,
    cancelled: typeof s.cancelled === "string" ? s.cancelled : undefined,
  }),
  head: () => ({
    meta: [
      { title: "PayPal Sandbox approval — PayPal ResolveAI" },
      { name: "description", content: "Return from PayPal Sandbox and confirm capture of your test payment." },
      { property: "og:title", content: "PayPal Sandbox approval — PayPal ResolveAI" },
      { property: "og:description", content: "Confirm and capture your Sandbox payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReturnPage,
});

function ReturnPage() {
  const { token, cancelled } = Route.useSearch();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const sync = useServerFn(syncSandboxOrder);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const tx = useQuery({
    queryKey: ["transactions", "by-order", token],
    enabled: !!token && signedIn === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("paypal_order_id", token!).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) await sync({ data: { transactionId: data.id } });
      const { data: fresh } = await supabase.from("transactions").select("*").eq("paypal_order_id", token!).maybeSingle();
      return fresh;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-navy px-5 py-4">
        <BrandLockup />
      </div>
      <div className="mx-auto max-w-3xl space-y-4 p-5">
        <h1 className="text-2xl font-extrabold">{cancelled ? "Approval cancelled" : "Back from PayPal Sandbox"}</h1>
        {cancelled && (
          <Panel className="flex items-start gap-3">
            <XCircle className="h-6 w-6 shrink-0 text-danger" />
            <p className="text-sm">You cancelled the approval in PayPal. No payment was captured. You can start a new test payment from the Sandbox page.</p>
          </Panel>
        )}
        {signedIn === null && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
        {signedIn === false && (
          <Panel>
            <p className="text-sm">
              Your approval was recorded by PayPal. This browser tab isn't signed in — switch back to your original ResolveAI tab and press <strong>"Check approval"</strong>, or{" "}
              <Link to="/auth" search={{ mode: "signin", redirect: `/paypal/return?token=${token ?? ""}` }} className="font-semibold text-primary">sign in here</Link>.
            </p>
          </Panel>
        )}
        {signedIn && tx.isLoading && (
          <Panel className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Verifying the order with PayPal Sandbox…</Panel>
        )}
        {signedIn && tx.isSuccess && !tx.data && <Panel><p className="text-sm">We couldn't find this order in your account.</p></Panel>}
        {signedIn && tx.data && (
          <Panel>
            <CaptureFlow tx={tx.data} />
          </Panel>
        )}
        <Link to="/sandbox" className="inline-block text-sm font-semibold text-primary">← Go to PayPal Sandbox page</Link>
      </div>
    </div>
  );
}
