import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api, type Profile, type Task, type TaskAssignee } from "@/lib/api";
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
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Calendário — Atelier" }] }),
  component: PainelPage,
});

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const MONTHLY_RECURRENCE_COUNT = 12;
const TASK_DESCRIPTION_PREVIEW_LIMIT = 120;

type Assignee = TaskAssignee;

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

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

function PainelPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = ymd(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const monthEnd = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", monthStart, monthEnd],
    queryFn: async () => {
      return api.tasks.list({ start: monthStart, end: monthEnd });
    },
  });

  const taskIds = tasks.map((t) => t.id);
  const { data: assignees = [] } = useQuery({
    queryKey: ["task_assignees", taskIds.join(",")],
    queryFn: async () => {
      if (taskIds.length === 0) return [] as Assignee[];
      return api.taskAssignees.list(taskIds);
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      return api.profiles.list();
    },
  });

  const visibleProfiles = useMemo(() => profiles.filter((profile) => profile.display_name.trim()), [profiles]);
  const profileMap = useMemo(() => Object.fromEntries(visibleProfiles.map((p) => [p.id, p])), [visibleProfiles]);
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) (map[t.task_date] ||= []).push(t);
    return map;
  }, [tasks]);
  const assigneesByTask = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const a of assignees) (map[a.task_id] ||= []).push(a.user_id);
    return map;
  }, [assignees]);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const arr: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const toggleDone = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      await api.tasks.update(id, { done });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await api.tasks.remove(id, user?.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task_assignees"] });
      toast.success("Tarefa removida");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao remover tarefa");
    },
  });

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Calendário</p>
          <h1 className="font-display text-4xl mt-1">
            {MONTHS[cursor.getMonth()]} <span className="text-muted-foreground">{cursor.getFullYear()}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-xs uppercase tracking-widest text-muted-foreground text-center py-2">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square sm:min-h-28" />;
            const key = ymd(d);
            const dayTasks = tasksByDate[key] || [];
            const isToday = key === ymd(today);
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const isPast = dayStart < todayStart;
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={cn(
                  "group text-left rounded-md border border-border bg-card p-2 sm:min-h-28 transition-colors hover:border-accent-foreground/30 hover:bg-accent/30 flex flex-col",
                  isToday && "ring-1 ring-foreground/30",
                  isPast && "opacity-65"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-sm font-medium",
                    isToday && "font-display text-lg",
                    isPast && "line-through decoration-2 decoration-muted-foreground/70 text-muted-foreground"
                  )}>{d.getDate()}</span>
                  {dayTasks.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{dayTasks.length}</Badge>
                  )}
                </div>
                <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                  {dayTasks.slice(0, 2).map((t) => {
                    const aIds = assigneesByTask[t.id] || [];
                    return (
                      <div key={t.id} className="text-[11px] leading-tight">
                        <div className={cn("truncate", t.done && "line-through text-muted-foreground")}>{t.title}</div>
                        {aIds.length > 0 && (
                          <div className="truncate text-muted-foreground">
                            {aIds.slice(0, 2).map((id) => profileMap[id]?.display_name?.trim().split(" ")[0] ?? "").filter(Boolean).join(", ")}
                            {aIds.length > 2 && ` +${aIds.length - 2}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dayTasks.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">+{dayTasks.length - 2} mais</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <DayDialog
        date={selectedDate}
        onClose={() => setSelectedDate(null)}
        tasks={selectedDate ? tasksByDate[selectedDate] || [] : []}
        profiles={visibleProfiles}
        assigneesByTask={assigneesByTask}
        currentUserId={user?.id ?? ""}
        onToggle={(id, done) => toggleDone.mutate({ id, done })}
        onDelete={(id) => deleteTask.mutate(id)}
        onRefresh={() => {
          qc.invalidateQueries({ queryKey: ["tasks"] });
          qc.invalidateQueries({ queryKey: ["task_assignees"] });
        }}
      />
    </div>
  );
}

function DayDialog({
  date, onClose, tasks, profiles, assigneesByTask, currentUserId, onToggle, onDelete, onRefresh,
}: {
  date: string | null;
  onClose: () => void;
  tasks: Task[];
  profiles: Profile[];
  assigneesByTask: Record<string, string[]>;
  currentUserId: string;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      const dates = recurring ? monthlyTaskDates(date) : [date];
      const createdTasks = [];
      for (const taskDate of dates) {
        const task = await api.tasks.create({
          title: title.trim(),
          description: description.trim() || null,
          task_date: taskDate,
          scope: "group",
          done: false,
          created_by: currentUserId,
        });
        createdTasks.push(task);
      }
      if (picked.length > 0) {
        const rows = createdTasks.flatMap((task) => picked.map((uid) => ({ task_id: task.id, user_id: uid })));
        await api.taskAssignees.create(rows);
      }
      toast.success(recurring ? "Tarefas recorrentes criadas" : "Tarefa criada");
      setTitle(""); setDescription(""); setPicked([]); setRecurring(false); setAdding(false);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  const formatted = date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) : "";

  return (
    <Dialog open={!!date} onOpenChange={(o) => !o && (onClose(), setAdding(false), setRecurring(false))}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl capitalize">{formatted}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[42vh] overflow-y-auto overflow-x-hidden pr-1">
          {tasks.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground italic">Nenhuma tarefa ainda.</p>
          )}
          {tasks.map((t) => {
            const aIds = assigneesByTask[t.id] || [];
            const names = aIds.map((id) => profiles.find((p) => p.id === id)?.display_name.trim()).filter(Boolean);
            const hasLongDescription = (t.description?.length ?? 0) > TASK_DESCRIPTION_PREVIEW_LIMIT;
            return (
              <div key={t.id} className="flex items-start gap-3 p-3 rounded-md border border-border bg-card">
                <Checkbox checked={t.done} onCheckedChange={(c) => onToggle(t.id, !!c)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className={cn("font-medium break-words", t.done && "line-through text-muted-foreground")}>{t.title}</div>
                  {t.description && (
                    hasLongDescription ? (
                      <div className="mt-1 space-y-1.5">
                        <p className="text-sm text-muted-foreground line-clamp-2 break-all whitespace-pre-wrap">
                          {t.description}
                        </p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs">
                              Mais informações
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display text-2xl break-words">{t.title}</AlertDialogTitle>
                              <AlertDialogDescription asChild>
                                <div className="max-h-[55vh] overflow-y-auto overflow-x-hidden rounded-md border border-border bg-card p-3">
                                  <p className="whitespace-pre-wrap break-all text-sm text-muted-foreground">
                                    {t.description}
                                  </p>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Fechar</AlertDialogCancel>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-0.5 break-all whitespace-pre-wrap">{t.description}</p>
                    )
                  )}
                  {names.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {names.map((n) => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}
                    </div>
                  )}
                </div>
                {t.created_by === currentUserId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
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
                        <AlertDialogAction onClick={() => onDelete(t.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
        </div>

        {adding ? (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} />
            </div>
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
            <div className="space-y-1.5">
              <Label>Atribuir a</Label>
              <div className="flex flex-wrap gap-2">
                {profiles.map((p) => {
                  const active = picked.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPicked(active ? picked.filter((x) => x !== p.id) : [...picked, p.id])}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs border transition-colors",
                        active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                      )}
                    >
                      {p.display_name.trim()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 gap-2 border-t border-border bg-background px-6 py-4">
          {!adding ? (
            <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Nova tarefa</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => (setAdding(false), setRecurring(false))}>Cancelar</Button>
              <Button onClick={handleAdd} disabled={saving || !title.trim()}>Salvar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
