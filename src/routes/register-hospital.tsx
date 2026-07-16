import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { normalizeTzPhone } from "@/lib/phone";
import { MapPin } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";

export const Route = createFileRoute("/register-hospital")({
  component: RegisterHospital,
});

const DAR = { lat: -6.7924, lng: 39.2083 };

function RegisterHospital() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // hospital
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [address, setAddress] = useState("");
  const [hPhone, setHPhone] = useState("");
  const [hEmail, setHEmail] = useState("");
  const [coords, setCoords] = useState(DAR);

  // admin
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nAdmin = normalizeTzPhone(adminPhone);
    if (!nAdmin) return toast.error("Enter admin phone as Tanzania number");
    const nHosp = hPhone ? normalizeTzPhone(hPhone) : null;
    if (hPhone && !nHosp) return toast.error("Enter hospital phone as Tanzania number");
    if (password.length < 6) return toast.error("Password must be at least 6 chars");

    setBusy(true);
    // 1. sign up hospital admin
    const { data: signup, error: signupErr } = await supabase.auth.signUp({
      email: adminEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/pending`,
        data: { full_name: adminName, phone: nAdmin, role: "hospital_admin" },
      },
    });
    if (signupErr || !signup.user) { setBusy(false); toast.error(signupErr?.message || "Signup failed"); return; }

    // ensure a session (email confirmation might be enabled)
    let session = signup.session;
    if (!session) {
      const { data: signIn, error: siErr } = await supabase.auth.signInWithPassword({ email: adminEmail, password });
      if (siErr || !signIn.session) { setBusy(false); toast.error("Signed up. Please sign in and try registering hospital again."); return; }
      session = signIn.session;
    }

    // 2. insert hospital
    const { data: hospital, error: hErr } = await supabase
      .from("hospitals")
      .insert({
        name, registration_no: regNo || null, address: address || null,
        phone: nHosp, email: hEmail || null,
        latitude: coords.lat, longitude: coords.lng,
        created_by: signup.user.id,
      })
      .select().single();
    if (hErr || !hospital) { setBusy(false); toast.error(hErr?.message || "Hospital creation failed"); return; }

    // 3. link profile
    const { error: pErr } = await supabase.from("profiles").update({ hospital_id: hospital.id }).eq("id", signup.user.id);
    if (pErr) { setBusy(false); toast.error(pErr.message); return; }

    setBusy(false);
    toast.success("Registered — awaiting verification");
    navigate({ to: "/pending", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container-page py-8 sm:py-12 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Hospital registration</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold">List your hospital</h1>
        <p className="mt-2 text-muted-foreground">
          Register once, then manage your specialists and availability. Your account activates after super-admin verification.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          {step === 1 && (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
              <h2 className="text-xl font-semibold">Hospital details</h2>
              <Field label="Hospital name" required value={name} onChange={setName} />
              <Field label="Registration number" value={regNo} onChange={setRegNo} />
              <Field label="Address" value={address} onChange={setAddress} />
              <Field label="Hospital phone" value={hPhone} onChange={setHPhone} placeholder="0712 345 678" />
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
                <Button type="button" onClick={() => { if (!name) return toast.error("Hospital name required"); setStep(2); }}>
                  Continue
                </Button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
              <h2 className="text-xl font-semibold">Admin account</h2>
              <p className="text-sm text-muted-foreground">You'll use this to sign in and manage your hospital.</p>
              <Field label="Full name" required value={adminName} onChange={setAdminName} />
              <Field label="Email" type="email" required value={adminEmail} onChange={setAdminEmail} />
              <Field label="Phone" required value={adminPhone} onChange={setAdminPhone} placeholder="0712 345 678" />
              <Field label="Password" type="password" required value={password} onChange={setPassword} />
              <div className="pt-2 flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" disabled={busy}>{busy ? "Submitting..." : "Submit for verification"}</Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input type={type} required={required} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
