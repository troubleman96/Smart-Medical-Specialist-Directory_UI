import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyAppointments, updateAppointmentStatus, type Appointment } from "@/lib/api/appointments";
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
    queryFn: () => getMyAppointments(),
    refetchInterval: 30000,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => updateAppointmentStatus(id, "CANCELLED"),
    onSuccess: () => { toast.success("Appointment cancelled"); qc.invalidateQueries({ queryKey: ["appointments", "mine"] }); },
    onError: (e: any) => toast.error(e.message),
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
            <AppointmentCard key={a.id} appointment={a} onCancel={() => cancel.mutate(a.id)} isCancelling={cancel.isPending} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AppointmentCard({ appointment: a, onCancel, isCancelling }: { appointment: Appointment; onCancel: () => void; isCancelling: boolean }) {
  const statusMap: Record<string, string> = {
    REQUESTED: "bg-status-busy/15 text-status-busy border-status-busy/30",
    CONFIRMED: "bg-status-available/15 text-status-available border-status-available/40",
    CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
    COMPLETED: "bg-primary/10 text-primary border-primary/30",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono text-muted-foreground">{a.reference_number}</div>
          <div className="mt-0.5 font-semibold">Appointment #{a.id}</div>
          <div className="text-sm text-muted-foreground">Status: {a.status}</div>
          {a.scheduled_at && <div className="mt-1 text-sm">{new Date(a.scheduled_at).toLocaleString()}</div>}
        </div>
        <span className={`text-xs font-semibold uppercase px-2 py-1 rounded-full border ${statusMap[a.status] || "border-border"}`}>{a.status.toLowerCase()}</span>
      </div>
      {(a.status === "REQUESTED" || a.status === "CONFIRMED") && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant="ghost" size="sm"
            onClick={onCancel}
            disabled={isCancelling}
          >
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
