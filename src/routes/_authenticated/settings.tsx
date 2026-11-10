import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/app/app-shell";
import { HeroBanner, Panel, PanelTitle } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { getPaypalStatus, testPaypalConnection } from "@/lib/paypal.functions";
import { profileQuery } from "@/lib/queries";
import { BrandMark } from "@/components/app/brand";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PayPal ResolveAI" },
      { name: "description", content: "Manage your profile, PayPal Sandbox connection, data and preferences." },
      { property: "og:title", content: "Settings — PayPal ResolveAI" },
      { property: "og:description", content: "Account, connection and preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const me = useQuery(profileQuery());
  const statusFn = useServerFn(getPaypalStatus);
  const testFn = useServerFn(testPaypalConnection);
  const status = useQuery({ queryKey: ["paypal-status"], queryFn: () => statusFn() });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    setName(me.data?.profile?.full_name ?? "");
    setPhone(me.data?.profile?.phone ?? "");
    setTheme(localStorage.getItem("resolveai-theme") ?? "light");
  }, [me.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ full_name: name.trim().slice(0, 80), phone: phone.trim().slice(0, 30) || null }).eq("id", me.data!.user.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Profile saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });
  const test = useMutation({ mutationFn: () => testFn(), onSuccess: (r) => (r.ok ? toast.success("PayPal Sandbox OAuth succeeded.") : toast.error(r.error)) });
  async function resetDemo() {
    const { error } = await supabase.rpc("reset_demo_data");
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
    toast.success("Demo data reset. Sandbox records were kept.");
  }
  function pickTheme(t: string) {
    setTheme(t);
    localStorage.setItem("resolveai-theme", t);
    window.dispatchEvent(new Event("resolveai-theme"));
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your account, PayPal connection, security, and preferences" />
      <PageBody>
        <HeroBanner icon={<BrandMark className="h-14" />} title="Your ResolveAI Account" subtitle="Manage your profile, connections, security and app preferences." />
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <PanelTitle title="Account & Profile" subtitle={me.data?.user.email} />
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="n">Full name</Label><Input id="n" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="p">Phone</Label><Input id="p" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} /></div>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !me.data}>Save changes</Button>
            </div>
          </Panel>
          <Panel>
            <PanelTitle title="PayPal Connection" subtitle="Environment: Sandbox (api-m.sandbox.paypal.com)" />
            <p className="text-sm">Credentials: <strong>{status.data?.configured ? "Configured on server" : "Not configured"}</strong></p>
            <p className="text-sm">Webhook verification: <strong>{status.data?.webhookConfigured ? "Configured" : "Not configured (optional)"}</strong></p>
            <Button className="mt-3" variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>Test connection</Button>
          </Panel>
          <Panel>
            <PanelTitle title="Preferences" />
            <div className="flex gap-2">{["light", "system", "dark"].map((t) => <Button key={t} variant={theme === t ? "default" : "outline"} size="sm" onClick={() => pickTheme(t)} className="capitalize">{t}</Button>)}</div>
            <label className="mt-4 flex items-center justify-between text-sm">Payment, fraud and dispute alerts
              <Switch checked={me.data?.profile?.notifications_enabled ?? true} onCheckedChange={async (v) => { await supabase.from("profiles").update({ notifications_enabled: v }).eq("id", me.data!.user.id); qc.invalidateQueries({ queryKey: ["profile"] }); }} />
            </label>
          </Panel>
          <Panel>
            <PanelTitle title="Data & Privacy" subtitle="Demo data is fictional and separate from Sandbox records" />
            <Button variant="outline" onClick={resetDemo}>Reset demo data</Button>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
