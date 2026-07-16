import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/AppHeader";
import { useQuery } from "@tanstack/react-query";
import { getMyHospital } from "@/lib/api/hospitals";

export const Route = createFileRoute("/hospital")({
  component: HospitalLayout,
});

function HospitalLayout() {
  const { user, roles, hospitalId, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth", search: { redirect: location.pathname }, replace: true }); return; }
    if (!roles.includes("hospital_admin")) { navigate({ to: "/", replace: true }); }
  }, [loading, user, roles, navigate, location.pathname]);

  const { data: hospital } = useQuery({
    enabled: !!hospitalId,
    queryKey: ["hospital"],
    queryFn: () => getMyHospital(),
  });

  if (loading || !user) return <div className="min-h-screen bg-background"><AppHeader /></div>;

  if (hospital && hospital.status !== "VERIFIED") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container-page py-10 max-w-lg text-center">
          <h1 className="text-2xl font-bold">Awaiting verification</h1>
          <p className="mt-2 text-muted-foreground">Your hospital ({hospital.name}) is <b>{hospital.status}</b>. You'll unlock the dashboard once a super admin approves you.</p>
          <Link to="/pending" className="mt-4 inline-flex text-primary">View status</Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { to: "/hospital", label: "Overview", exact: true },
    { to: "/hospital/specialists", label: "Specialists" },
    { to: "/hospital/availability", label: "Availability" },
    { to: "/hospital/appointments", label: "Appointments" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-8">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Hospital admin</p>
            <h1 className="text-3xl font-bold">{hospital?.name || "Dashboard"}</h1>
          </div>
        </div>
        <nav className="mt-6 flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map((t) => {
            const active = t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
