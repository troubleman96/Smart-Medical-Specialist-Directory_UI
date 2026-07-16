import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPublicSpecialist } from "@/lib/api/specialists";
import { listAvailability } from "@/lib/api/availability";
import { createAppointment } from "@/lib/api/appointments";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "@/components/LocationPicker";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Calendar as CalIcon } from "lucide-react";

export const Route = createFileRoute("/specialist/$id")({
  component: SpecialistDetail,
});

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function SpecialistDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [time, setTime] = useState("10:00");

  const specialistId = Number(id);

  const { data: specialist, isLoading, isError } = useQuery({
    queryKey: ["specialist", specialistId],
    queryFn: () => getPublicSpecialist(specialistId),
  });

  const start = isoDate(new Date());
  const end = new Date(); end.setDate(end.getDate() + 7);
  const endStr = isoDate(end);

  const { data: availability } = useQuery({
    queryKey: ["availability", specialistId, start, endStr],
    queryFn: () => listAvailability({ specialist_id: specialistId, date_from: start, date_to: endStr }),
    enabled: !!user,
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!user || !selectedDate || !specialist) throw new Error("Sign in first");
      const scheduled = new Date(`${selectedDate}T${time}:00`).toISOString();
      return createAppointment({
        specialist_id: specialistId,
        hospital_id: specialist.hospital.id,
        scheduled_at: scheduled,
      });
    },
    onSuccess: (appt) => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(`Booked! Reference ${appt.reference_number}`);
      navigate({ to: "/appointments" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Loading />;
  if (isError || !specialist) return <NotFoundBlock />;

  const availByDate = new Map((availability ?? []).map((a) => [a.date, a.status]));

  const next7: Array<{ date: string; label: string; sub: string; status: "available" | "busy" | "off" }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = isoDate(d);
    const apiStatus = availByDate.get(iso);
    next7.push({
      date: iso,
      label: d.toLocaleDateString("en", { weekday: "short" }),
      sub: d.toLocaleDateString("en", { day: "numeric", month: "short" }),
      status: apiStatus ? (apiStatus.toLowerCase() as "available" | "busy" | "off") : "off",
    });
  }

  const hosp = specialist.hospital as any;

  return (
    <div className="min-h-screen bg-background pb-32">
      <AppHeader />
      <div className="container-page py-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm font-medium text-primary">{specialist.specialization}</p>
              <h1 className="mt-1 text-3xl font-bold">{specialist.full_name}</h1>
              {specialist.license_no && <p className="text-sm text-muted-foreground mt-1">License #{specialist.license_no}</p>}
              <div className="mt-5 border-t border-border pt-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold">{hosp.name}</div>
                    {hosp.address && <div className="text-sm text-muted-foreground">{hosp.address}</div>}
                    {hosp.phone && <div className="text-sm text-muted-foreground mt-1">{hosp.phone}</div>}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-card overflow-hidden">
              <LocationPicker
                value={{ lat: hosp.latitude, lng: hosp.longitude }}
                interactive={false}
                height={220}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 h-fit lg:sticky lg:top-20">
            <h2 className="text-xl font-semibold">Book appointment</h2>
            <p className="text-sm text-muted-foreground mt-1">Next 7 days</p>
            {!user && (
              <p className="mt-2 text-sm text-muted-foreground">
                <Link to="/auth" className="text-primary font-medium">Sign in</Link> to see availability and book.
              </p>
            )}
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {next7.map((d) => {
                const disabled = d.status === "off";
                const selected = selectedDate === d.date;
                return (
                  <button
                    key={d.date}
                    disabled={disabled || !user}
                    onClick={() => setSelectedDate(d.date)}
                    className={`rounded-lg p-2 text-center border transition ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : disabled
                          ? "border-border bg-muted/40 text-muted-foreground opacity-60 cursor-not-allowed"
                          : "border-border hover:border-primary"
                    }`}
                  >
                    <div className="text-[10px] uppercase font-semibold">{d.label}</div>
                    <div className="text-sm font-bold">{d.sub.split(" ")[0]}</div>
                    <div
                      className={`mt-1 h-1.5 w-1.5 rounded-full mx-auto ${
                        d.status === "available" ? "bg-status-available" :
                        d.status === "busy" ? "bg-status-busy" : "bg-status-off"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            {selectedDate && (
              <div className="mt-4 space-y-3">
                <label className="text-sm font-medium">Preferred time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full h-11 rounded-lg border border-input bg-background px-3"
                />
                <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-3 text-sm">
                  <StatusBadge status={(availByDate.get(selectedDate)?.toLowerCase() as "available" | "busy" | "off") ?? "off"} size="sm" />
                </div>
              </div>
            )}
            <Button
              size="lg"
              className="mt-5 w-full"
              disabled={!selectedDate || book.isPending}
              onClick={() => {
                if (!user) {
                  navigate({ to: "/auth", search: { redirect: window.location.pathname } });
                  return;
                }
                book.mutate();
              }}
            >
              <CalIcon className="h-4 w-4" />
              {user ? (book.isPending ? "Booking..." : "Book appointment") : "Sign in to book"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">You'll receive an SMS confirmation once the hospital confirms.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-10 text-muted-foreground">Loading specialist...</div>
    </div>
  );
}
function NotFoundBlock() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-10">Specialist not found. <Link to="/" className="text-primary">Back home</Link></div>
    </div>
  );
}
