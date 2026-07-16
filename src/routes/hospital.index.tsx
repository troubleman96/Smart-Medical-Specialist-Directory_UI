import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, Activity } from "lucide-react";

export const Route = createFileRoute("/hospital/")({
  component: Overview,
});

function Overview() {
  const { profile } = useAuth();
  const hid = profile?.hospital_id;
  const today = new Date().toISOString().slice(0, 10);

  const { data } = useQuery({
    enabled: !!hid,
    queryKey: ["hospital-overview", hid],
    queryFn: async () => {
      const [sp, av, ap] = await Promise.all([
        supabase.from("specialists").select("id", { count: "exact", head: true }).eq("hospital_id", hid!).eq("is_active", true),
        supabase.from("availability").select("id", { count: "exact", head: true }).eq("hospital_id", hid!).eq("date", today).eq("status", "available"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("hospital_id", hid!).eq("status", "requested"),
      ]);
      return { specialists: sp.count ?? 0, availableToday: av.count ?? 0, pending: ap.count ?? 0 };
    },
  });

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat icon={<Users />} label="Active specialists" value={data?.specialists ?? "—"} />
      <Stat icon={<Activity />} label="Available today" value={data?.availableToday ?? "—"} tone="green" />
      <Stat icon={<Calendar />} label="Pending appointments" value={data?.pending ?? "—"} tone="amber" />
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone?: "green" | "amber" }) {
  const c = tone === "green" ? "bg-status-available/15 text-status-available" : tone === "amber" ? "bg-status-busy/15 text-status-busy" : "bg-primary/10 text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className={`grid h-10 w-10 place-items-center rounded-lg ${c}`}>{icon}</div>
      <div className="mt-4 text-3xl font-display font-bold tabular-nums">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
