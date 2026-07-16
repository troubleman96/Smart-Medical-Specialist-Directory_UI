import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { loginUser, registerPatient } from "@/lib/api/auth";
import { normalizeTzPhone } from "@/lib/phone";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (loading || !user) return;
    if (!user.phone_verified) {
      navigate({ to: "/verify-phone", replace: true });
      return;
    }
    navigate({ to: redirect || "/", replace: true });
  }, [user, loading, navigate, redirect]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-10 sm:py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex gap-1 rounded-lg bg-muted p-1 mb-6">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${mode === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>
          {mode === "signin" ? <SignInForm redirect={redirect} /> : <SignUpForm />}
        </div>
      </div>
    </div>
  );
}

function SignInForm({ redirect }: { redirect?: string }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeTzPhone(phone);
    if (!normalized) {
      toast.error("Enter a Tanzania number (07XX XXX XXX)");
      return;
    }

    setBusy(true);
    try {
      const { user } = await loginUser({ phone_number: normalized, password });
      await refresh();
      toast.success("Welcome back");
      navigate({ to: user.phone_verified ? redirect || "/" : "/verify-phone", replace: true });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <div>
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          required
          placeholder="0712 345 678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="pw">Password</Label>
        <PasswordInput
          id="pw"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={busy}>
        {busy ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeTzPhone(phone);
    if (!normalized) {
      toast.error("Enter a Tanzania number (07XX XXX XXX)");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setBusy(true);
    try {
      await registerPatient({ phone_number: normalized, password });
      await refresh();
      toast.success("Account created — verification code sent by SMS");
      navigate({ to: "/verify-phone", replace: true });
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-bold">Create patient account</h1>
      <p className="text-sm text-muted-foreground -mt-2">
        Register a hospital?{" "}
        <a href="/register-hospital" className="text-primary font-medium">
          Start here
        </a>
      </p>
      <div>
        <Label htmlFor="ph">Phone number</Label>
        <Input
          id="ph"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0712 345 678"
        />
      </div>
      <div>
        <Label htmlFor="pw">Password</Label>
        <PasswordInput
          id="pw"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={busy}>
        {busy ? "Creating..." : "Create account"}
      </Button>
    </form>
  );
}
