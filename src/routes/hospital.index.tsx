import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getHospitalSpecialists } from "@/lib/api/specialists";
import { getHospitalAppointments } from "@/lib/api/appointments";
import { Users, Calendar, Activity } from "lucide-react";

export const Route = createFileRoute("/hospital/")({
  component: Overview,
});

function Overview() {
  const { data: specialists } = useQuery({
    queryKey: ["specialists"],
    queryFn: () => getHospitalSpecialists(),
  });

  const { data: appointments } = useQuery({
    queryKey: ["h-appointments"],
    queryFn: () => getHospitalAppointments(),
  });

  const activeCount = specialists?.filter((s) => s.is_active).length ?? 0;
  const pendingCount = appointments?.filter((a) => a.status === "REQUESTED").length ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat icon={<Users />} label="Active specialists" value={activeCount} />
      <Stat icon={<Activity />} label="Total specialists" value={specialists?.length ?? 0} tone="green" />
      <Stat icon={<Calendar />} label="Pending appointments" value={pendingCount} tone="amber" />
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
