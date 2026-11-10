import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/app/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — PayPal ResolveAI" },
      { name: "description", content: "Choose a new password for your PayPal ResolveAI account." },
      { property: "og:title", content: "Set a new password — PayPal ResolveAI" },
      { property: "og:description", content: "Complete your password reset." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session && isRecovery) setReady(true);
      else if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <AuthLayout illustration={<ShieldCheck className="h-44 w-44 text-brand-sky" />} heading="Secure your account">
      <h1 className="text-3xl font-extrabold">Set a new password</h1>
      {!ready ? (
        <p className="mt-3 text-sm text-muted-foreground">Open this page from the reset link in your email. Verifying your link…</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {[{ id: "pw", label: "New password", v: pw, set: setPw }, { id: "pw2", label: "Confirm new password", v: pw2, set: setPw2 }].map((f) => (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={f.id} className="font-semibold">{f.label}</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id={f.id} type="password" autoComplete="new-password" value={f.v} onChange={(e) => f.set(e.target.value)} className="h-11 pl-10" />
              </div>
            </div>
          ))}
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
