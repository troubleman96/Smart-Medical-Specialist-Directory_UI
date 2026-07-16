import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/hospital/specialists")({
  component: SpecialistsPage,
});

type Specialist = { id: string; full_name: string; specialization: string; license_no: string | null; photo_url: string | null; is_active: boolean };

function SpecialistsPage() {
  const { profile } = useAuth();
  const hid = profile?.hospital_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Specialist | null>(null);

  const { data, isLoading } = useQuery({
    enabled: !!hid,
    queryKey: ["specialists", hid],
    queryFn: async () => {
      const { data, error } = await supabase.from("specialists").select("*").eq("hospital_id", hid!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Specialist[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("specialists").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deactivated"); qc.invalidateQueries({ queryKey: ["specialists", hid] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} specialists</p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add specialist</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} specialist</DialogTitle></DialogHeader>
            <SpecialistForm existing={editing} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["specialists", hid] }); }} />
          </DialogContent>
        </Dialog>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {data && data.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">No specialists yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first specialist to appear in patient search.</p>
        </div>
      )}
      <div className="grid gap-3 sm:hidden">
        {data?.map((s) => (
          <div key={s.id} className={`rounded-xl border p-4 ${s.is_active ? "bg-card" : "bg-muted/40 opacity-70"}`}>
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{s.full_name}</div>
                <div className="text-sm text-muted-foreground">{s.specialization}</div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                {s.is_active && <Button variant="ghost" size="icon" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {data && data.length > 0 && (
        <div className="hidden sm:block rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Name</th><th className="p-3">Specialization</th><th className="p-3">License</th><th className="p-3">Status</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3 font-medium">{s.full_name}</td>
                  <td className="p-3">{s.specialization}</td>
                  <td className="p-3 text-muted-foreground">{s.license_no || "—"}</td>
                  <td className="p-3">{s.is_active ? <span className="text-status-available font-medium">Active</span> : <span className="text-muted-foreground">Inactive</span>}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    {s.is_active && <Button variant="ghost" size="sm" onClick={() => del.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SpecialistForm({ existing, onDone }: { existing: Specialist | null; onDone: () => void }) {
  const { profile } = useAuth();
  const hid = profile?.hospital_id!;
  const [name, setName] = useState(existing?.full_name ?? "");
  const [spec, setSpec] = useState(existing?.specialization ?? "");
  const [license, setLicense] = useState(existing?.license_no ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (existing) {
      const { error } = await supabase.from("specialists").update({ full_name: name, specialization: spec, license_no: license || null, is_active: true }).eq("id", existing.id);
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Updated");
    } else {
      const { error } = await supabase.from("specialists").insert({ hospital_id: hid, full_name: name, specialization: spec, license_no: license || null });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Specialist added");
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label>Specialization</Label><Input required value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Cardiology" /></div>
      <div><Label>License #</Label><Input value={license} onChange={(e) => setLicense(e.target.value)} /></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : "Save"}</Button>
    </form>
  );
}
