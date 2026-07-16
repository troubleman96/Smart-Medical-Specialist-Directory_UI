import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getHospitalSpecialists,
  createSpecialist,
  updateSpecialist,
  deleteSpecialist,
  type Specialist,
} from "@/lib/api/specialists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/hospital/specialists")({
  component: SpecialistsPage,
});

function SpecialistsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Specialist | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["specialists"],
    queryFn: () => getHospitalSpecialists(),
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteSpecialist(id),
    onSuccess: () => { toast.success("Deactivated"); qc.invalidateQueries({ queryKey: ["specialists"] }); },
    onError: (e: any) => toast.error(e.message),
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
            <SpecialistForm existing={editing} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["specialists"] }); }} />
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
  const [name, setName] = useState(existing?.full_name ?? "");
  const [spec, setSpec] = useState(existing?.specialization ?? "");
  const [license, setLicense] = useState(existing?.license_no ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (existing) {
        await updateSpecialist(existing.id, {
          full_name: name,
          specialization: spec,
          license_no: license,
          is_active: true,
        });
        toast.success("Updated");
      } else {
        await createSpecialist({
          full_name: name,
          specialization: spec,
          license_no: license,
        });
        toast.success("Specialist added");
      }
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label>Specialization</Label><Input required value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Cardiology" /></div>
      <div><Label>License #</Label><Input required value={license} onChange={(e) => setLicense(e.target.value)} /></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : "Save"}</Button>
    </form>
  );
}
