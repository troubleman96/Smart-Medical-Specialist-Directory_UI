import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Activity, LogOut } from "lucide-react";

export function AppHeader() {
  const { user, roles, signOut } = useAuth();

  const handleSignOut = () => {
    signOut();
    toast.success("Signed out");
  };

  const dashboardHref = roles.includes("super_admin")
    ? "/admin"
    : roles.includes("hospital_admin")
      ? "/hospital"
      : "/appointments";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">MedDirectory</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to={dashboardHref} className="hidden sm:inline-flex text-sm font-medium text-foreground/80 hover:text-foreground px-3 py-2">
                Dashboard
              </Link>
              <span className="hidden md:inline text-sm text-muted-foreground">
                {user.full_name || user.username}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" className="text-sm font-medium px-3 py-2">Sign in</Link>
              <Link to="/register-hospital" className="hidden sm:inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                Register hospital
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
