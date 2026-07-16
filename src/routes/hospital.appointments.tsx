import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/hospital/appointments")({
  component: HospitalAppointments,
});

function HospitalAppointments() {
  const { profile } = useAuth();
  const hid = profile?.hospital_id;
  const qc = useQueryClient();

  const { data } = useQuery({
    enabled: !!hid,
    queryKey: ["h-appointments", hid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, reference, status, scheduled_at, created_at, specialist:specialists(full_name, specialization), patient:profiles!appointments_patient_id_fkey(full_name, phone)")
        .eq("hospital_id", hid!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!hid) return;
    const ch = supabase.channel("h-appts")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `hospital_id=eq.${hid}` },
        () => qc.invalidateQueries({ queryKey: ["h-appointments", hid] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hid, qc]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status, appt }: { id: string; status: "confirmed" | "cancelled" | "completed"; appt: any }) => {
      const { error } = await supabase.from("appointments").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      // Log-only SMS
      const phone = appt.patient?.phone;
      if (phone && (status === "confirmed" || status === "cancelled")) {
        const msg = status === "confirmed"
          ? `Your appointment ${appt.reference} with Dr. ${appt.specialist?.full_name} is confirmed for ${appt.scheduled_at ? new Date(appt.scheduled_at).toLocaleString() : "the scheduled time"}.`
          : `Your appointment ${appt.reference} has been cancelled.`;
        await supabase.rpc("log_sms", { _appointment_id: id, _hospital_id: hid!, _phone: phone, _message: msg });
      }
    },
    onSuccess: (_r, vars) => { toast.success(`Appointment ${vars.status}`); qc.invalidateQueries({ queryKey: ["h-appointments", hid] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {data && data.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No appointments yet.</div>}
      {data?.map((a: any) => (
        <div key={a.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="text-xs font-mono text-muted-foreground">{a.reference}</div>
              <div className="mt-0.5 font-semibold">{a.patient?.full_name || "Patient"} · {a.patient?.phone}</div>
              <div className="text-sm text-muted-foreground">Dr. {a.specialist?.full_name} — {a.specialist?.specialization}</div>
              {a.scheduled_at && <div className="mt-1 text-sm">{new Date(a.scheduled_at).toLocaleString()}</div>}
            </div>
            <span className="text-xs font-semibold uppercase px-2 py-1 rounded-full border border-border">{a.status}</span>
          </div>
          {a.status === "requested" && (
            <div className="mt-4 flex gap-2 pt-4 border-t border-border">
              <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: "confirmed", appt: a })}>Confirm</Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: a.id, status: "cancelled", appt: a })}>Cancel</Button>
            </div>
          )}
          {a.status === "confirmed" && (
            <div className="mt-4 flex gap-2 pt-4 border-t border-border">
              <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: a.id, status: "completed", appt: a })}>Mark completed</Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: a.id, status: "cancelled", appt: a })}>Cancel</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
