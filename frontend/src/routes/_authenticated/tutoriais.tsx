import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api, API_BASE, type Tutorial } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, ExternalLink, Paperclip, Pencil, X } from "lucide-react";
import { toast } from "sonner";

const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

export const Route = createFileRoute("/_authenticated/tutoriais")({
  head: () => ({ meta: [{ title: "Tutoriais — Atelier" }] }),
  component: TutoriaisPage,
});

function TutoriaisPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tutorial | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function resetForm() {
    setEditing(null);
    setTitle("");
    setContent("");
    setUrl("");
    setSelectedFile(null);
  }

  function openNew() {
    resetForm();
    setOpen(true);
  }

  function openEdit(item: Tutorial) {
    setEditing(item);
    setTitle(item.title);
    setContent(item.content ?? "");
    setUrl(item.url ?? "");
    setSelectedFile(null);
    setOpen(true);
  }

  const { data: items = [] } = useQuery({
    queryKey: ["tutorials"],
    queryFn: async () => {
      return api.tutorials.list();
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (selectedFile && selectedFile.size > MAX_UPLOAD_SIZE_BYTES) {
        throw new Error("O arquivo e muito grande. Envie arquivos de ate 20 MB.");
      }

      if (editing) {
        return api.tutorials.update(editing.id, {
          title: title.trim(),
          content: content.trim() || null,
          url: url.trim() || null,
        }, selectedFile);
      }

      return api.tutorials.create({
        title: title.trim(),
        content: content.trim() || null,
        url: url.trim() || null,
        user_id: user!.id,
      }, selectedFile);
    },
    onSuccess: (saved) => {
      qc.setQueryData<Tutorial[]>(["tutorials"], (current = []) => {
        if (editing) {
          return current.map((item) => item.id === saved.id ? saved : item);
        }
        if (current.some((item) => item.id === saved.id)) return current;
        return [saved, ...current];
      });
      qc.invalidateQueries({ queryKey: ["tutorials"] });
      toast.success(editing ? "Tutorial atualizado" : "Tutorial adicionado");
      setOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.tutorials.remove(id, user?.id);
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
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {items.length === 0 && <p className="text-muted-foreground italic">Nenhum tutorial ainda.</p>}
        {items.map((t) => {
          const isImage = typeof t.mime_type === "string" && t.mime_type.startsWith("image/");
          return (
            <Card key={t.id} className="p-5 group">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl flex-1">{t.title}</h3>
                {t.user_id === user?.id && (
                  <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={del.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir tutorial?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa acao remove o tutorial da biblioteca. Deseja continuar?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(t.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
              {t.content && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{t.content}</p>}
              {t.file_url && (
                <div className="mt-4">
                  {isImage ? (
                    <a href={`${API_BASE}${t.file_url}`} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={`${API_BASE}${t.file_url}`}
                        alt={t.file_name ?? t.title}
                        className="max-h-64 w-full rounded-md border border-border object-cover"
                      />
                    </a>
                  ) : (
                    <a
                      href={`${API_BASE}${t.file_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t.file_name ?? "Arquivo anexado"}</span>
                    </a>
                  )}
                </div>
              )}
              {t.url && (
                <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm underline hover:text-foreground text-muted-foreground">
                  Abrir link <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Editar tutorial" : "Novo tutorial"}</DialogTitle></DialogHeader>
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
            <div className="space-y-1.5">
              <Label htmlFor="t-file">Arquivo ou imagem (opcional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent">
                  <Paperclip className="h-4 w-4" />
                  Anexar
                  <input
                    id="t-file"
                    type="file"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {selectedFile && (
                  <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-accent/40 px-3 py-2 text-sm">
                    <span className="truncate">{selectedFile.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {!selectedFile && editing?.file_url && (
                  <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-accent/40 px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="truncate">{editing.file_name ?? "Arquivo anexado"}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{editing ? "Anexe outro arquivo para substituir o atual. " : ""}Limite de 20 MB por arquivo.</p>
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
