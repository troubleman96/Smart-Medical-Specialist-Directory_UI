import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { getMyHospital } from "@/lib/api/hospitals";

export const Route = createFileRoute("/pending")({
  component: Pending,
});

function Pending() {
  const { hospitalId } = useAuth();
  const { data: hospital } = useQuery({
    enabled: !!hospitalId,
    queryKey: ["hospital"],
    queryFn: () => getMyHospital(),
  });

  const verified = hospital?.status === "VERIFIED";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-16 max-w-lg text-center">
        <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${verified ? "bg-status-available/15 text-status-available" : "bg-status-busy/15 text-status-busy"}`}>
          {verified ? <CheckCircle2 className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </div>
        <h1 className="mt-6 text-3xl font-bold">
          {verified ? "You're verified!" : "Awaiting verification"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {verified
            ? "Your hospital is now live in the directory. Head to your dashboard to add specialists."
            : "Thanks for registering. A super admin will review your hospital shortly. You'll be notified when you're approved."}
        </p>
        {hospital && (
          <div className="mt-8 rounded-xl border border-border bg-card p-5 text-left">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Registered hospital</div>
            <div className="text-lg font-semibold mt-1">{hospital.name}</div>
            <div className="text-sm text-muted-foreground mt-1">Status: {hospital.status}</div>
          </div>
        )}
        <div className="mt-8">
          {verified ? (
            <Link to="/hospital" className="rounded-lg bg-primary px-4 py-2.5 text-primary-foreground font-medium">Go to dashboard</Link>
          ) : (
            <Link to="/" className="text-sm text-primary font-medium">Back to home</Link>
          )}
        </div>
      </div>
    </div>
  );
}
