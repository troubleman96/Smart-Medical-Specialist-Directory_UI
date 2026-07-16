import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Stethoscope, Building2, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Central Dar es Salaam
const DAR_DEFAULT = { lat: -6.7924, lng: 39.2083 };

export const Route = createFileRoute("/")({
  component: Home,
});

type NearbyRow = {
  specialist_id: string;
  specialist_name: string;
  specialization: string;
  photo_url: string | null;
  hospital_id: string;
  hospital_name: string;
  hospital_address: string | null;
  hospital_lat: number;
  hospital_lng: number;
  distance_km: number;
  availability_status: "available" | "busy" | "off";
};

const SPECIALIZATIONS = [
  "", "Cardiology", "Dermatology", "Pediatrics", "Gynecology",
  "Orthopedics", "Neurology", "Psychiatry", "Dentistry", "General Practice",
  "Ophthalmology", "ENT", "Urology", "Oncology",
];

function Home() {
  const [coords, setCoords] = useState(DAR_DEFAULT);
  const [locationLabel, setLocationLabel] = useState("Dar es Salaam (default)");
  const [specialization, setSpecialization] = useState("");
  const [radius, setRadius] = useState(15);
  const [searched, setSearched] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    toast.loading("Getting your location...", { id: "loc" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLabel("Your current location");
        toast.success("Location captured", { id: "loc" });
      },
      () => toast.error("Couldn't get your location — using Dar es Salaam center", { id: "loc" }),
      { timeout: 8000 }
    );
  };

  const query = useQuery({
    queryKey: ["nearby", coords.lat, coords.lng, specialization, radius],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_specialists", {
        lat: coords.lat,
        lng: coords.lng,
        specialization_filter: specialization || null,
        radius_km: radius,
        date_filter: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      return (data as NearbyRow[]) ?? [];
    },
    enabled: searched,
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <section className="container-page pt-8 sm:pt-14 pb-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Dar es Salaam</p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold leading-tight">
            Find an <span className="text-primary">available specialist</span> near you.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Real-time availability from verified hospitals. See the distance, see the status, book in under a minute.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-surface-elevated border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specialization</label>
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="mt-1.5 w-full h-11 rounded-lg border border-input bg-background px-3 text-base"
              >
                {SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>{s || "Any specialization"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</label>
              <div className="mt-1.5 flex gap-2">
                <div className="flex-1 h-11 rounded-lg border border-input bg-background px-3 flex items-center text-sm gap-2">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{locationLabel}</span>
                </div>
                <Button type="button" variant="secondary" onClick={useMyLocation} className="h-11">
                  Use mine
                </Button>
              </div>
            </div>
            <Button
              size="lg"
              className="h-11 sm:self-end"
              onClick={() => setSearched(true)}
            >
              <Search className="h-4 w-4" /> Search
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Within</span>
            {[5, 10, 15, 25, 50].map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`rounded-full px-3 py-1 border text-sm ${radius === r ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page pb-24">
        {!searched && <PromoGrid />}
        {searched && query.isLoading && <SkeletonList />}
        {searched && query.isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            Couldn't load results. Please try again.
          </div>
        )}
        {searched && query.data && query.data.length === 0 && (
          <EmptyState onWiden={() => setRadius((r) => Math.min(r * 2, 100))} />
        )}
        {searched && query.data && query.data.length > 0 && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{query.data.length} specialists nearby</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {query.data.map((r) => <SpecialistCard key={r.specialist_id} r={r} />)}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function SpecialistCard({ r }: { r: NearbyRow }) {
  return (
    <Link
      to="/specialist/$id"
      params={{ id: r.specialist_id }}
      className="group block rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusBadge status={r.availability_status} size="lg" />
        <div className="text-right">
          <div className="text-2xl font-display font-bold text-primary tabular-nums">{r.distance_km.toFixed(1)}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">km away</div>
        </div>
      </div>
      <h3 className="mt-4 text-lg font-semibold">{r.specialist_name}</h3>
      <p className="text-sm text-muted-foreground">{r.specialization}</p>
      <div className="mt-4 pt-4 border-t border-border flex items-start gap-2 text-sm">
        <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <div className="font-medium">{r.hospital_name}</div>
          {r.hospital_address && <div className="text-muted-foreground text-xs">{r.hospital_address}</div>}
        </div>
      </div>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
        View & book <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-40 mt-4" />
          <Skeleton className="h-4 w-24 mt-2" />
          <Skeleton className="h-4 w-full mt-6" />
          <Skeleton className="h-4 w-2/3 mt-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onWiden }: { onWiden: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Stethoscope className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No specialists found nearby</h3>
      <p className="mt-1 text-sm text-muted-foreground">Try widening your search radius or changing the specialization.</p>
      <Button onClick={onWiden} className="mt-5">Double the search radius</Button>
    </div>
  );
}

function PromoGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <FeatureCard icon={<MapPin />} title="See the distance" text="Every result sorted by how close it actually is to you — not paid placement." />
      <FeatureCard icon={<Stethoscope />} title="Real availability" text="Green means the specialist is on duty today. Grey means don't waste your trip." />
      <FeatureCard icon={<Building2 />} title="Verified hospitals" text="Every listed hospital is registered and approved on the platform." />
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// use imported Input/Skeleton to avoid unused-import lint
void Input;
