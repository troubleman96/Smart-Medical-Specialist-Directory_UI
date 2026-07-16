import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHospitalAppointments, updateAppointmentStatus, type Appointment } from "@/lib/api/appointments";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/hospital/appointments")({
  component: HospitalAppointments,
});

function HospitalAppointments() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["h-appointments"],
    queryFn: () => getHospitalAppointments(),
    refetchInterval: 30000,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "CONFIRMED" | "CANCELLED" | "COMPLETED" }) =>
      updateAppointmentStatus(id, status),
    onSuccess: (_r, vars) => { toast.success(`Appointment ${vars.status.toLowerCase()}`); qc.invalidateQueries({ queryKey: ["h-appointments"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMap: Record<string, string> = {
    REQUESTED: "bg-status-busy/15 text-status-busy border-status-busy/30",
    CONFIRMED: "bg-status-available/15 text-status-available border-status-available/40",
    CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
    COMPLETED: "bg-primary/10 text-primary border-primary/30",
  };

  return (
    <div className="space-y-3">
      {data && data.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No appointments yet.</div>}
      {data?.map((a) => (
        <div key={a.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="text-xs font-mono text-muted-foreground">{a.reference_number}</div>
              <div className="mt-0.5 font-semibold">Appointment #{a.id}</div>
              <div className="text-sm text-muted-foreground">Specialist #{a.specialist} · Hospital #{a.hospital}</div>
              {a.scheduled_at && <div className="mt-1 text-sm">{new Date(a.scheduled_at).toLocaleString()}</div>}
            </div>
            <span className={`text-xs font-semibold uppercase px-2 py-1 rounded-full border ${statusMap[a.status] || "border-border"}`}>{a.status.toLowerCase()}</span>
          </div>
          {a.status === "REQUESTED" && (
            <div className="mt-4 flex gap-2 pt-4 border-t border-border">
              <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: "CONFIRMED" })}>Confirm</Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: a.id, status: "CANCELLED" })}>Cancel</Button>
            </div>
          )}
          {a.status === "CONFIRMED" && (
            <div className="mt-4 flex gap-2 pt-4 border-t border-border">
              <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: a.id, status: "COMPLETED" })}>Mark completed</Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: a.id, status: "CANCELLED" })}>Cancel</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
