import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api, type Tutorial } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tutoriais")({
  head: () => ({ meta: [{ title: "Tutoriais — Atelier" }] }),
  component: TutoriaisPage,
});

function TutoriaisPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["tutorials"],
    queryFn: async () => {
      return api.tutorials.list();
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      await api.tutorials.create({
        title: title.trim(),
        content: content.trim() || null,
        url: url.trim() || null,
        user_id: user!.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tutorials"] });
      toast.success("Tutorial adicionado");
      setOpen(false); setTitle(""); setContent(""); setUrl("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.tutorials.remove(id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tutorials"] }); toast.success("Removido"); },
  });

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Biblioteca</p>
          <h1 className="font-display text-4xl mt-1">Tutoriais</h1>
          <p className="text-muted-foreground mt-2">Materiais e guias compartilhados pela equipe.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {items.length === 0 && <p className="text-muted-foreground italic">Nenhum tutorial ainda.</p>}
        {items.map((t) => (
          <Card key={t.id} className="p-5 group">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-xl flex-1">{t.title}</h3>
              {t.user_id === user?.id && (
                <Button variant="ghost" size="icon" onClick={() => del.mutate(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
            {t.content && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{t.content}</p>}
            {t.url && (
              <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm underline hover:text-foreground text-muted-foreground">
                Abrir link <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">Novo tutorial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Título</Label>
              <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-content">Conteúdo</Label>
              <Textarea id="t-content" value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={4000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-url">Link (opcional)</Label>
              <Input id="t-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" maxLength={500} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => add.mutate()} disabled={!title.trim() || add.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
