import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { verifyOtp, resendOtp } from "@/lib/api/auth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/verify-phone")({
  component: VerifyPhonePage,
});

const RESEND_COOLDOWN = 30;

function VerifyPhonePage() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (user.phone_verified) {
      navigate({ to: "/", replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!user || user.phone_verified) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }

    setBusy(true);
    try {
      await verifyOtp(code);
      await refresh();
      toast.success("Phone number verified");
      navigate({ to: "/", replace: true });
    } catch (err: any) {
      toast.error(err.message || "Invalid or expired code");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await resendOtp();
      toast.success("New code sent");
      setCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      toast.error(err.message || "Could not resend code");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-10 sm:py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Verify your phone</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a 6-digit code by SMS to{" "}
            <span className="font-medium text-foreground">{user.phone_number}</span>.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4 text-left">
            <div>
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                className="text-center text-lg tracking-[0.5em]"
                placeholder="------"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "Verifying..." : "Verify"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-4 text-sm">
            <button
              onClick={resend}
              disabled={cooldown > 0}
              className="text-primary font-medium disabled:text-muted-foreground disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
            </button>
            <a href="/" className="text-muted-foreground hover:text-foreground">
              Skip for now
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
