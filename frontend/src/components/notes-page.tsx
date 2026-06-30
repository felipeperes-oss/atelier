import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api, type Note } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function NotesPage({ scope, title, subtitle }: { scope: "general" | "individual"; title: string; subtitle: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [t, setT] = useState(""); const [c, setC] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", scope, user?.id],
    queryFn: async () => {
      return api.notes.list({ scope, userId: scope === "individual" ? user!.id : undefined });
    },
    enabled: !!user,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      return api.profiles.list();
    },
  });
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? "";

  function openNew() { setEditing(null); setT(""); setC(""); setOpen(true); }
  function openEdit(n: Note) { setEditing(n); setT(n.title); setC(n.content ?? ""); setOpen(true); }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await api.notes.update(editing.id, { title: t.trim(), content: c.trim() || null });
      } else {
        await api.notes.create({ title: t.trim(), content: c.trim() || null, scope, user_id: user!.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Salvo");
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.notes.remove(id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); toast.success("Removido"); },
  });

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Anotações</p>
          <h1 className="font-display text-4xl mt-1">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
      </div>

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {notes.length === 0 && <p className="text-muted-foreground italic">Nada por aqui ainda.</p>}
        {notes.map((n) => (
          <Card key={n.id} className="p-5 break-inside-avoid cursor-pointer group hover:border-accent-foreground/30 transition" onClick={() => openEdit(n)}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-xl">{n.title}</h3>
              {n.user_id === user?.id && (
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); del.mutate(n.id); }} className="opacity-0 group-hover:opacity-100 transition">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
            {n.content && <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap line-clamp-6">{n.content}</p>}
            <p className="text-xs text-muted-foreground mt-3">
              {scope === "general" ? `${nameOf(n.user_id)} · ` : ""}{new Date(n.updated_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
            </p>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Editar anotação" : "Nova anotação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ntit">Título</Label>
              <Input id="ntit" value={t} onChange={(e) => setT(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ncon">Conteúdo</Label>
              <Textarea id="ncon" value={c} onChange={(e) => setC(e.target.value)} rows={8} maxLength={5000} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!t.trim() || save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
