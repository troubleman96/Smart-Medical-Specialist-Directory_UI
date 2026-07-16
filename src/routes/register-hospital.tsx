import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { registerHospital } from "@/lib/api/hospitals";
import { normalizeTzPhone } from "@/lib/phone";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";

export const Route = createFileRoute("/register-hospital")({
  component: RegisterHospital,
});

const DAR = { lat: -6.7924, lng: 39.2083 };

function RegisterHospital() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [address, setAddress] = useState("");
  const [hPhone, setHPhone] = useState("");
  const [hEmail, setHEmail] = useState("");
  const [coords, setCoords] = useState(DAR);

  const [adminPhone, setAdminPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedAdminPhone = normalizeTzPhone(adminPhone);
    if (!normalizedAdminPhone) return toast.error("Enter a Tanzania number (07XX XXX XXX)");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");

    setBusy(true);
    try {
      await registerHospital({
        name,
        registration_no: regNo || undefined,
        latitude: coords.lat,
        longitude: coords.lng,
        address: address || undefined,
        phone: hPhone || undefined,
        email: hEmail || undefined,
        admin_phone_number: normalizedAdminPhone,
        admin_password: password,
      });
      toast.success("Registered — a confirmation SMS was sent. Sign in to verify your phone.");
      navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-8 sm:py-12 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Hospital registration
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold">List your hospital</h1>
        <p className="mt-2 text-muted-foreground">
          Register once, then manage your specialists and availability. Your account activates after
          super-admin verification.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          {step === 1 && (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
              <h2 className="text-xl font-semibold">Hospital details</h2>
              <Field label="Hospital name" required value={name} onChange={setName} />
              <Field label="Registration number" value={regNo} onChange={setRegNo} />
              <Field label="Address" value={address} onChange={setAddress} />
              <Field
                label="Hospital phone"
                value={hPhone}
                onChange={setHPhone}
                placeholder="0712 345 678"
              />
              <Field label="Hospital email" type="email" value={hEmail} onChange={setHEmail} />
              <div>
                <Label className="mb-2 block">Pin your location</Label>
                <div className="rounded-lg overflow-hidden border border-border">
                  <LocationPicker value={coords} onChange={setCoords} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              </div>
              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    if (!name) return toast.error("Hospital name required");
                    setStep(2);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
              <h2 className="text-xl font-semibold">Admin account</h2>
              <p className="text-sm text-muted-foreground">
                You'll use this phone number to sign in and manage your hospital.
              </p>
              <Field
                label="Admin phone number"
                required
                value={adminPhone}
                onChange={setAdminPhone}
                placeholder="0712 345 678"
              />
              <div>
                <Label>
                  Password<span className="text-destructive"> *</span>
                </Label>
                <PasswordInput
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="pt-2 flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Submitting..." : "Submit for verification"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
