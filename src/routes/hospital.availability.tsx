import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHospitalSpecialists, type Specialist } from "@/lib/api/specialists";
import { listAvailability, setAvailability, type Availability } from "@/lib/api/availability";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/hospital/availability")({
  component: AvailabilityPage,
});

type Status = "AVAILABLE" | "BUSY" | "OFF";

function AvailabilityPage() {
  const qc = useQueryClient();

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const { data: specs } = useQuery({
    queryKey: ["specialists"],
    queryFn: () => getHospitalSpecialists(),
  });

  const { data: avs } = useQuery({
    queryKey: ["availability", dates[0], dates[6]],
    queryFn: () => listAvailability({ date_from: dates[0], date_to: dates[6] }),
  });

  const avMap = new Map<string, Status>();
  (avs ?? []).forEach((a) => avMap.set(`${a.specialist_id}|${a.date}`, a.status));

  const setStatus = useMutation({
    mutationFn: ({ specialistId, date, status }: { specialistId: number; date: string; status: Status }) =>
      setAvailability({ specialist_id: specialistId, date, status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const markAllToday = async () => {
    if (!specs) return;
    const today = dates[0];
    try {
      await Promise.all(
        specs.filter((s) => s.is_active).map((s) =>
          setAvailability({ specialist_id: s.id, date: today, status: "AVAILABLE" })
        )
      );
      toast.success("Marked all specialists available today");
      qc.invalidateQueries({ queryKey: ["availability"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const cycle: Record<Status, Status> = { OFF: "AVAILABLE", AVAILABLE: "BUSY", BUSY: "OFF" };

  const activeSpecs = (specs ?? []).filter((s) => s.is_active);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Tap any cell to cycle status. Green → Amber → Grey.</p>
        <Button variant="secondary" onClick={markAllToday}>Mark all available today</Button>
      </div>
      {activeSpecs.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Add specialists first.</div>}
      {activeSpecs.length > 0 && (
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
              {activeSpecs.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3 sticky left-0 bg-card">
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground">{s.specialization}</div>
                  </td>
                  {dates.map((d) => {
                    const st = (avMap.get(`${s.id}|${d}`) ?? "OFF") as Status;
                    const bg = st === "AVAILABLE" ? "bg-status-available" : st === "BUSY" ? "bg-status-busy" : "bg-status-off";
                    return (
                      <td key={d} className="p-2 text-center">
                        <button
                          onClick={() => setStatus.mutate({ specialistId: s.id, date: d, status: cycle[st] })}
                          className={`h-8 w-16 rounded-md ${bg} text-white text-[10px] font-bold uppercase tracking-wider hover:opacity-80`}
                        >
                          {st.toLowerCase()}
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
