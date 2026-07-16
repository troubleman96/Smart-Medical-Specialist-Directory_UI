import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/AppHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listHospitals, verifyHospital, type Hospital } from "@/lib/api/hospitals";
import { getOverviewReport, type OverviewReport } from "@/lib/api/reports";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { redirect: "/admin" }, replace: true });
  }, [loading, user, navigate]);

  const { data: hospitals } = useQuery({
    enabled: roles.includes("super_admin"),
    queryKey: ["admin-hospitals"],
    queryFn: () => listHospitals(),
  });

  const { data: report } = useQuery({
    enabled: roles.includes("super_admin"),
    queryKey: ["admin-report"],
    queryFn: () => getOverviewReport(),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "VERIFIED" | "SUSPENDED" }) =>
      verifyHospital(id, status),
    onSuccess: (_r, v) => { toast.success(`Hospital ${v.status.toLowerCase()}`); qc.invalidateQueries({ queryKey: ["admin-hospitals"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading || !user) return <div className="min-h-screen bg-background"><AppHeader /></div>;

  if (!roles.includes("super_admin")) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container-page py-12 max-w-lg text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Super admin access required</h1>
          <p className="mt-2 text-muted-foreground">
            You need super admin privileges to access this page. Contact the system administrator.
          </p>
        </div>
      </div>
    );
  }

  const pending = hospitals?.filter((h) => h.status === "PENDING") ?? [];
  const others = hospitals?.filter((h) => h.status !== "PENDING") ?? [];
  const stats = report?.hospitals ?? { verified: 0, pending: 0, suspended: 0 };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-8">
        <p className="text-sm text-muted-foreground">Super admin</p>
        <h1 className="text-3xl font-bold">Platform overview</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatBox label="Verified" v={stats.verified} tone="green" />
          <StatBox label="Pending" v={stats.pending} tone="amber" />
          <StatBox label="Suspended" v={stats.suspended} tone="grey" />
        </div>

        {report && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatBox label="Total specialists" v={report.specialists.active} tone="green" />
            <StatBox label="Total appointments" v={report.appointments.total} tone="amber" />
            <StatBox label="Total searches" v={report.total_searches} tone="grey" />
          </div>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Verification queue</h2>
          {pending.length === 0 && <p className="mt-3 text-muted-foreground text-sm">Nothing pending. All clear.</p>}
          <div className="mt-4 space-y-3">
            {pending.map((h) => (
              <div key={h.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="font-semibold text-lg">{h.name}</div>
                    <div className="text-sm text-muted-foreground">{h.address || "No address"}</div>
                    <div className="text-xs text-muted-foreground mt-1">Reg: {h.registration_no || "—"} · {h.phone || "—"} · {h.email || "—"}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateStatus.mutate({ id: h.id, status: "VERIFIED" })}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: h.id, status: "SUSPENDED" })}>Reject</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">All hospitals</h2>
          <div className="mt-4 space-y-2">
            {others.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <div className="font-medium">{h.name}</div>
                  <div className="text-xs text-muted-foreground">{h.status.toLowerCase()}</div>
                </div>
                <div className="flex gap-2">
                  {h.status === "VERIFIED" && <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: h.id, status: "SUSPENDED" })}>Suspend</Button>}
                  {h.status === "SUSPENDED" && <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: h.id, status: "VERIFIED" })}>Reinstate</Button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatBox({ label, v, tone }: { label: string; v: number; tone: "green" | "amber" | "grey" }) {
  const c = tone === "green" ? "text-status-available" : tone === "amber" ? "text-status-busy" : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className={`text-4xl font-display font-bold ${c} tabular-nums`}>{v}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
