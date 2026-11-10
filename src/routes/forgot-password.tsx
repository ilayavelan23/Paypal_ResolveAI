import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, KeyRound, Mail, MailCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/app/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — PayPal ResolveAI" },
      { name: "description", content: "Reset your PayPal ResolveAI password securely." },
      { property: "og:title", content: "Forgot password — PayPal ResolveAI" },
      { property: "og:description", content: "We'll email you a secure reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) return setError("Enter a valid email address.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  if (sent) {
    return (
      <AuthLayout illustration={<MailCheck className="h-44 w-44 text-brand-sky" />} heading="Check Your Email" footnote={<p className="mt-3 text-sidebar-muted">We've sent a password reset link to {email}</p>}>
        <h1 className="text-3xl font-extrabold">Reset Link Sent!</h1>
        <p className="mt-2 text-sm text-muted-foreground">If an account exists for that address, a reset link is on its way. Please check your inbox (and spam folder) and follow the instructions.</p>
        <p className="mt-6 text-center text-sm">
          Didn't receive the email?{" "}
          <button className="font-semibold text-primary" onClick={() => send()} disabled={busy}>Resend Link</button>
        </p>
        <Link to="/auth" search={{ mode: "signin" }} className="mt-4 flex items-center justify-center gap-1 text-sm font-semibold text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Sign In
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout illustration={<KeyRound className="h-44 w-44 text-brand-sky" />} heading="Forgot Your Password?" footnote={<p className="mt-3 text-sidebar-muted">No worries. We'll help you reset it securely.</p>}>
      <h1 className="text-3xl font-extrabold">Forgot Password</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send a reset link</p>
      <form onSubmit={send} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="font-semibold">Email Address</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 pl-10" placeholder="you@example.com" />
          </div>
        </div>
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Sending…" : "Send Reset Link"}</Button>
      </form>
      <Link to="/auth" search={{ mode: "signin" }} className="mt-5 flex items-center justify-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Sign In
      </Link>
    </AuthLayout>
  );
}
