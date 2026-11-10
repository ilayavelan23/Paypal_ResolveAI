import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail, MailCheck, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthLayout, GoogleButton } from "@/components/app/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import shieldBot from "@/assets/auth-bot-shield.png";

type Search = { mode?: "signin" | "signup"; redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "signup" ? "signup" : "signin",
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — PayPal ResolveAI" },
      { name: "description", content: "Sign in or create your PayPal ResolveAI account to analyze payments with AI." },
      { property: "og:title", content: "Sign in — PayPal ResolveAI" },
      { property: "og:description", content: "Access your dashboard, transactions and AI assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safeRedirect(r?: string) {
  if (!r) return "/dashboard";
  try {
    const u = new URL(r, window.location.origin);
    if (u.origin !== window.location.origin) return "/dashboard";
    if (u.pathname === "/auth") return "/dashboard";
    return u.pathname + u.search;
  } catch {
    return "/dashboard";
  }
}

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(80),
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(8, "Use at least 8 characters").max(72),
    confirm: z.string(),
    agree: z.literal(true, { errorMap: () => ({ message: "Please accept the terms" }) }),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

function AuthPage() {
  const { mode, redirect } = Route.useSearch();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [agree, setAgree] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);
  const isSignup = mode === "signup";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.history.replace(safeRedirect(sessionStorage.getItem("resolveai-post-auth") ?? redirect));
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) router.history.replace(safeRedirect(sessionStorage.getItem("resolveai-post-auth") ?? redirect));
    });
    return () => data.subscription.unsubscribe();
  }, [router, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignup) {
        const parsed = signUpSchema.safeParse({ fullName, email, password, confirm, agree });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the form");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: parsed.data.fullName } },
        });
        if (error) throw error;
        if (!data.session) setConfirmSent(parsed.data.email);
      } else {
        const parsed = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") }).safeParse({ email, password });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the form");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg.includes("Invalid login") ? "Incorrect email or password." : msg);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    if (redirect) sessionStorage.setItem("resolveai-post-auth", safeRedirect(redirect));
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    router.history.replace(safeRedirect(sessionStorage.getItem("resolveai-post-auth") ?? redirect));
  }

  if (confirmSent) {
    return (
      <AuthLayout illustration={<MailCheck className="h-40 w-40 text-brand-sky" />} heading="Check Your Email">
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-success" />
          <h1 className="text-2xl font-extrabold">Confirm your email</h1>
          <p className="text-muted-foreground">
            We sent a confirmation link to <strong className="text-foreground">{confirmSent}</strong>. Click it to activate your account, then sign in.
          </p>
          <Link to="/auth" search={{ mode: "signin" }} className="text-sm font-semibold text-primary" onClick={() => setConfirmSent(null)}>
            Back to Sign In
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      illustration={<img src={shieldBot} alt="ResolveAI assistant holding a security shield" width={1024} height={1024} className="h-72 w-72 object-contain" />}
      heading={isSignup ? "Create Your ResolveAI Account" : "Your Intelligent Payment Partner"}
      bullets={isSignup ? ["Personalized payment insights", "Secure and private data", "Access across devices"] : ["Get instant payment support", "Monitor account activity", "Resolve issues with AI agents"]}
    >
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{isSignup ? "Create Your Account" : "Sign In to ResolveAI"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isSignup ? "Get started with ResolveAI in just a few steps" : "Access your dashboard, transactions, and AI assistant"}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {isSignup && (
          <Field label="Full Name" id="fullName" icon={User}>
            <Input id="fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 pl-10" placeholder="Your name" />
          </Field>
        )}
        <Field label="Email Address" id="email" icon={Mail}>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 pl-10" placeholder="you@example.com" />
        </Field>
        <Field label="Password" id="password" icon={Lock}>
          <Input id="password" type={show ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10 pl-10" placeholder="••••••••" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Field>
        {isSignup && (
          <Field label="Confirm Password" id="confirm" icon={Lock}>
            <Input id="confirm" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 pl-10" placeholder="••••••••" />
          </Field>
        )}
        {isSignup ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} /> I agree to the Terms of Service and Privacy Policy
          </label>
        ) : (
          <div className="flex justify-end text-sm">
            <Link to="/forgot-password" className="font-semibold text-primary">Forgot password?</Link>
          </div>
        )}
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Create Account" : "Sign In"}
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton onClick={google} />
      <p className="mt-3 text-center text-xs text-muted-foreground">PayPal Sandbox is connected after sign-in from the Sandbox page — it is not a login method.</p>
      <p className="mt-5 text-center text-sm">
        {isSignup ? "Already have an account? " : "Don't have an account? "}
        <Link to="/auth" search={{ mode: isSignup ? "signin" : "signup", redirect }} className="font-semibold text-primary">
          {isSignup ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </AuthLayout>
  );
}

function Field({ label, id, icon: Icon, children }: { label: string; id: string; icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-semibold">{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        {children}
      </div>
    </div>
  );
}
