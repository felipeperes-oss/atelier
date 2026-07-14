import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api, type Task } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MONTHLY_RECURRENCE_COUNT = 12;

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addMonthsKeepingClosestDay(startDate: string, monthOffset: number) {
  const [year, month, day] = startDate.split("-").map(Number);
  const targetMonthIndex = month - 1 + monthOffset;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const safeDay = Math.min(day, daysInMonth(targetYear, normalizedMonthIndex));
  return `${targetYear}-${String(normalizedMonthIndex + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function monthlyTaskDates(startDate: string) {
  return Array.from({ length: MONTHLY_RECURRENCE_COUNT }, (_, index) => addMonthsKeepingClosestDay(startDate, index));
}

export function TasksPage({ scope, title, subtitle }: { scope: "group" | "individual"; title: string; subtitle: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [t, setT] = useState(""); const [desc, setDesc] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  function resetForm() {
    setEditing(null);
    setT("");
    setDesc("");
    setDate(new Date().toISOString().slice(0, 10));
    setRecurring(false);
    setPicked([]);
  }

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-scope", scope, user?.id],
    queryFn: async () => {
      return api.tasks.list({ scope, createdBy: scope === "individual" ? user!.id : undefined });
    },
    enabled: !!user,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      return api.profiles.list();
    },
  });
  const assignableProfiles = profiles.filter((profile) => profile.display_name.trim());

  const { data: assignees = [] } = useQuery({
    queryKey: ["assignees-scope", scope, tasks.map((x) => x.id).join(",")],
    queryFn: async () => {
      if (tasks.length === 0) return [];
      return api.taskAssignees.list(tasks.map((x) => x.id));
    },
  });
  const assigneesByTask: Record<string, string[]> = {};
  for (const a of assignees) (assigneesByTask[a.task_id] ||= []).push(a.user_id);

  function openNew() {
    resetForm();
    setOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setT(task.title);
    setDesc(task.description ?? "");
    setDate(task.task_date);
    setRecurring(false);
    setPicked(assigneesByTask[task.id] || []);
    setOpen(true);
  }

  const add = useMutation({
    mutationFn: async () => {
      if (editing) {
        await api.tasks.update(editing.id, {
          title: t.trim(),
          description: desc.trim(),
          task_date: date,
          scope,
          done: editing.done,
        });
        if (scope === "group") {
          await api.taskAssignees.replace(editing.id, picked.map((uid) => ({ task_id: editing.id, user_id: uid })));
        }
        return;
      }

      const dates = recurring ? monthlyTaskDates(date) : [date];
      const createdTasks = [];
      for (const taskDate of dates) {
        const task = await api.tasks.create({
          title: t.trim(),
          description: desc.trim() || null,
          task_date: taskDate,
          scope,
          done: false,
          created_by: user!.id,
        });
        createdTasks.push(task);
      }
      if (scope === "group" && picked.length > 0) {
        const rows = createdTasks.flatMap((task) => picked.map((uid) => ({ task_id: task.id, user_id: uid })));
        await api.taskAssignees.create(rows);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks-scope"] });
      qc.invalidateQueries({ queryKey: ["assignees-scope"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(editing ? "Tarefa atualizada" : recurring ? "Tarefas recorrentes criadas" : "Tarefa criada");
      setOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      await api.tasks.update(id, { done });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks-scope"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.tasks.remove(id, user?.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks-scope"] });
      qc.invalidateQueries({ queryKey: ["assignees-scope"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Removido");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover tarefa"),
  });

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tarefas</p>
          <h1 className="font-display text-4xl mt-1">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && <p className="text-muted-foreground italic">Nenhuma tarefa por aqui.</p>}
        {tasks.map((task) => {
          const aIds = assigneesByTask[task.id] || [];
          const names = aIds.map((id) => profiles.find((p) => p.id === id)?.display_name.trim()).filter(Boolean);
          return (
            <Card key={task.id} className="p-4 flex items-start gap-3 group">
              <Checkbox checked={task.done} onCheckedChange={(c) => toggle.mutate({ id: task.id, done: !!c })} className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={cn("font-medium", task.done && "line-through text-muted-foreground")}>{task.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(task.task_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                  </span>
                </div>
                {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                {names.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {names.map((n) => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}
                  </div>
                )}
              </div>
              {task.created_by === user?.id && (
                <div className="flex opacity-0 transition group-hover:opacity-100">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(task)}>
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
                        <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Essa acao remove a tarefa definitivamente. Deseja continuar?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(task.id)} disabled={del.isPending}>
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
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nt">Título</Label>
              <Input id="nt" value={t} onChange={(e) => setT(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nd">Descrição</Label>
              <Textarea id="nd" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={1000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ndate">Data</Label>
              <Input id="ndate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {!editing && (
              <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                <Checkbox
                  checked={recurring}
                  onCheckedChange={(checked) => setRecurring(!!checked)}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block font-medium">Tarefa recorrente mensal</span>
                  <span className="block text-xs text-muted-foreground">
                    Cria {MONTHLY_RECURRENCE_COUNT} tarefas mensais, incluindo esta data.
                  </span>
                </span>
              </label>
            )}
            {scope === "group" && (
              <div className="space-y-1.5">
                <Label>Atribuir a</Label>
                <div className="flex flex-wrap gap-2">
                  {assignableProfiles.map((p) => {
                    const active = picked.includes(p.id);
                    return (
                      <button key={p.id} type="button"
                        onClick={() => setPicked(active ? picked.filter((x) => x !== p.id) : [...picked, p.id])}
                        className={cn("px-3 py-1 rounded-full text-xs border transition", active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent")}>
                        {p.display_name.trim()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => add.mutate()} disabled={!t.trim() || add.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
