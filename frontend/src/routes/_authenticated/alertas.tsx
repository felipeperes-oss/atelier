import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api, type AlertItem as Alert } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({ meta: [{ title: "Alertas — Atelier" }] }),
  component: AlertasPage,
});

const PRIORITY_LABEL = { low: "Baixa", normal: "Normal", high: "Urgente" } as const;
const PRIORITY_STYLE = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-foreground text-background",
} as const;

function AlertasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");

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
      await api.alerts.create({
        title: title.trim(),
        message: message.trim(),
        priority,
        user_id: user!.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Recado enviado");
      setOpen(false); setTitle(""); setMessage(""); setPriority("normal");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.alerts.remove(id);
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
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo recado</Button>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <p className="text-muted-foreground italic">Nenhum recado ainda.</p>}
        {items.map((a) => (
          <Card key={a.id} className="p-5 flex gap-4 group">
            <div className="mt-0.5">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <Bell className="h-4 w-4 text-accent-foreground" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-xl">{a.title}</h3>
                <Badge className={cn("text-[10px]", PRIORITY_STYLE[a.priority])}>{PRIORITY_LABEL[a.priority]}</Badge>
              </div>
              <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">{a.message}</p>
              <p className="text-xs text-muted-foreground mt-3">
                {nameOf(a.user_id)} · {new Date(a.created_at).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            {a.user_id === user?.id && (
              <Button variant="ghost" size="icon" onClick={() => del.mutate(a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">Novo recado</DialogTitle></DialogHeader>
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
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm border transition",
                      priority === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                    )}
                  >
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => add.mutate()} disabled={!title.trim() || !message.trim() || add.isPending}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
