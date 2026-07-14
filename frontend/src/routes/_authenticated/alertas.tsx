import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api, type AlertItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { AlertTriangle, Bell, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({ meta: [{ title: "Alertas — Atelier" }] }),
  component: AlertasPage,
});

const PRIORITY_LABEL = { low: "Baixa", normal: "Normal", high: "Urgente" } as const;
const PRIORITY_STYLE = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  normal: "border-sky-200 bg-sky-50 text-sky-700",
  high: "border-red-200 bg-red-50 text-red-700",
} as const;
const PRIORITY_CARD_STYLE = {
  low: "border-l-emerald-300",
  normal: "border-l-sky-300",
  high: "border-l-red-500 bg-red-50/40",
} as const;
const PRIORITY_ICON_STYLE = {
  low: "bg-emerald-50 text-emerald-700",
  normal: "bg-sky-50 text-sky-700",
  high: "bg-red-50 text-red-700",
} as const;
const PRIORITY_ICON = {
  low: Info,
  normal: Bell,
  high: AlertTriangle,
} as const;

function AlertasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AlertItem | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");

  function resetForm() {
    setEditing(null);
    setTitle("");
    setMessage("");
    setPriority("normal");
  }

  function openNew() {
    resetForm();
    setOpen(true);
  }

  function openEdit(item: AlertItem) {
    setEditing(item);
    setTitle(item.title);
    setMessage(item.message);
    setPriority(item.priority in PRIORITY_LABEL ? item.priority : "normal");
    setOpen(true);
  }

  const { data: items = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      return api.alerts.list();
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      return api.profiles.list();
    },
  });
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? "Equipe";

  const add = useMutation({
    mutationFn: async () => {
      if (editing) {
        return api.alerts.update(editing.id, {
          title: title.trim(),
          message: message.trim(),
          priority,
        });
      }

      await api.alerts.create({
        title: title.trim(),
        message: message.trim(),
        priority,
        user_id: user!.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success(editing ? "Recado atualizado" : "Recado enviado");
      setOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.alerts.remove(id, user?.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); toast.success("Removido"); },
  });

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mural</p>
          <h1 className="font-display text-4xl mt-1">Alertas</h1>
          <p className="text-muted-foreground mt-2">Recados e avisos enviados para toda a equipe.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo recado</Button>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <p className="text-muted-foreground italic">Nenhum recado ainda.</p>}
        {items.map((a) => {
          const itemPriority = a.priority in PRIORITY_LABEL ? a.priority : "normal";
          const PriorityIcon = PRIORITY_ICON[itemPriority];
          return (
          <Card key={a.id} className={cn("p-5 flex gap-4 group border-l-4", PRIORITY_CARD_STYLE[itemPriority])}>
            <div className="mt-0.5">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", PRIORITY_ICON_STYLE[itemPriority])}>
                <PriorityIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-xl">{a.title}</h3>
                <Badge variant="outline" className={cn("text-[10px] gap-1", PRIORITY_STYLE[itemPriority])}>
                  <PriorityIcon className="h-3 w-3" />
                  {PRIORITY_LABEL[itemPriority]}
                </Badge>
              </div>
              <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">{a.message}</p>
              <p className="text-xs text-muted-foreground mt-3">
                {nameOf(a.user_id)} · {new Date(a.created_at).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            {a.user_id === user?.id && (
              <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Essa acao remove o aviso do mural para toda a equipe.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del.mutate(a.id)} disabled={del.isPending}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
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
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Editar recado" : "Novo recado"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-title">Título</Label>
              <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-msg">Mensagem</Label>
              <Textarea id="a-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <div className="flex gap-2">
                {(["low", "normal", "high"] as const).map((p) => (
                  (() => {
                    const PriorityIcon = PRIORITY_ICON[p];
                    return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={priority === p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition",
                      priority === p ? PRIORITY_STYLE[p] : "border-border hover:bg-accent"
                    )}
                  >
                    <PriorityIcon className="h-3.5 w-3.5" />
                    {PRIORITY_LABEL[p]}
                  </button>
                    );
                  })()
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => add.mutate()} disabled={!title.trim() || !message.trim() || add.isPending}>
              {editing ? "Salvar" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
