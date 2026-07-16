import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/hospital/availability")({
  component: AvailabilityPage,
});

type Status = "available" | "busy" | "off";

function AvailabilityPage() {
  const { profile } = useAuth();
  const hid = profile?.hospital_id;
  const qc = useQueryClient();

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const { data } = useQuery({
    enabled: !!hid,
    queryKey: ["specialists-availability", hid],
    queryFn: async () => {
      const [{ data: specs }, { data: avs }] = await Promise.all([
        supabase.from("specialists").select("id, full_name, specialization").eq("hospital_id", hid!).eq("is_active", true).order("full_name"),
        supabase.from("availability").select("specialist_id, date, status").eq("hospital_id", hid!).gte("date", dates[0]).lte("date", dates[6]),
      ]);
      const map = new Map<string, Status>();
      (avs ?? []).forEach((a) => map.set(`${a.specialist_id}|${a.date}`, a.status as Status));
      return { specs: specs ?? [], map };
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ sid, date, status }: { sid: string; date: string; status: Status }) => {
      const { error } = await supabase.from("availability").upsert(
        { specialist_id: sid, hospital_id: hid!, date, status, updated_by: profile!.id },
        { onConflict: "specialist_id,date" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["specialists-availability", hid] }),
    onError: (e) => toast.error(e.message),
  });

  const markAllToday = async () => {
    if (!data) return;
    const today = dates[0];
    const rows = data.specs.map((s) => ({ specialist_id: s.id, hospital_id: hid!, date: today, status: "available" as Status, updated_by: profile!.id }));
    const { error } = await supabase.from("availability").upsert(rows, { onConflict: "specialist_id,date" });
    if (error) return toast.error(error.message);
    toast.success("Marked all specialists available today");
    qc.invalidateQueries({ queryKey: ["specialists-availability", hid] });
  };

  const cycle: Record<Status, Status> = { off: "available", available: "busy", busy: "off" };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Tap any cell to cycle status. Green → Amber → Grey.</p>
        <Button variant="secondary" onClick={markAllToday}>Mark all available today</Button>
      </div>
      {data && data.specs.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Add specialists first.</div>}
      {data && data.specs.length > 0 && (
        <div className="rounded-2xl border border-border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 sticky left-0 bg-muted/40 min-w-[180px]">Specialist</th>
                {dates.map((d) => {
                  const dt = new Date(d);
                  return <th key={d} className="p-3 text-center whitespace-nowrap">{dt.toLocaleDateString("en", { weekday: "short", day: "numeric" })}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {data.specs.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3 sticky left-0 bg-card">
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground">{s.specialization}</div>
                  </td>
                  {dates.map((d) => {
                    const st = (data.map.get(`${s.id}|${d}`) ?? "off") as Status;
                    const bg = st === "available" ? "bg-status-available" : st === "busy" ? "bg-status-busy" : "bg-status-off";
                    return (
                      <td key={d} className="p-2 text-center">
                        <button
                          onClick={() => setStatus.mutate({ sid: s.id, date: d, status: cycle[st] })}
                          className={`h-8 w-16 rounded-md ${bg} text-white text-[10px] font-bold uppercase tracking-wider hover:opacity-80`}
                        >
                          {st}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
