import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar, X } from "lucide-react";

export const Route = createFileRoute("/appointments")({
  component: Appointments,
});

function Appointments() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/appointments" }, replace: true });
  }, [loading, user, navigate]);

  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["appointments", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, reference, status, scheduled_at, created_at, specialist:specialists(full_name, specialization), hospital:hospitals(name, address, phone)")
        .eq("patient_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("appts-patient")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `patient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["appointments", "mine"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Appointment cancelled"); qc.invalidateQueries({ queryKey: ["appointments", "mine"] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-8 max-w-3xl">
        <h1 className="text-3xl font-bold">My appointments</h1>
        {isLoading && <p className="mt-6 text-muted-foreground">Loading...</p>}
        {data && data.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No appointments yet</p>
            <Link to="/" className="mt-4 inline-flex text-primary text-sm">Find a specialist →</Link>
          </div>
        )}
        <div className="mt-6 space-y-3">
          {data?.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-muted-foreground">{a.reference}</div>
                  <div className="mt-0.5 font-semibold">Dr. {a.specialist?.full_name}</div>
                  <div className="text-sm text-muted-foreground">{a.specialist?.specialization} — {a.hospital?.name}</div>
                  {a.scheduled_at && <div className="mt-1 text-sm">{new Date(a.scheduled_at).toLocaleString()}</div>}
                </div>
                <StatusPill s={a.status} />
              </div>
              {(a.status === "requested" || a.status === "confirmed") && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => cancel.mutate(a.id)}
                    disabled={cancel.isPending}
                  >
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    requested: "bg-status-busy/15 text-status-busy border-status-busy/30",
    confirmed: "bg-status-available/15 text-status-available border-status-available/40",
    cancelled: "bg-destructive/10 text-destructive border-destructive/30",
    completed: "bg-primary/10 text-primary border-primary/30",
  };
  return <span className={`text-xs font-semibold uppercase px-2 py-1 rounded-full border ${map[s]}`}>{s}</span>;
}
