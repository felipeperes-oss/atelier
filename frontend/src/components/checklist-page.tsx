import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { api, type Checklist, type ChecklistItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditChecklistItemDraft = {
  id?: string;
  title: string;
};

export function ChecklistPage({
  scope,
  title,
  subtitle,
}: {
  scope: "group" | "individual";
  title: string;
  subtitle: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [subactivities, setSubactivities] = useState([""]);
  const [newItemByChecklist, setNewItemByChecklist] = useState<Record<string, string>>({});
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [editTheme, setEditTheme] = useState("");
  const [editSubactivities, setEditSubactivities] = useState<EditChecklistItemDraft[]>([]);
  const [deletedEditItemIds, setDeletedEditItemIds] = useState<string[]>([]);

  const { data: checklists = [] } = useQuery({
    queryKey: ["checklists", scope, user?.id],
    queryFn: async () => {
      return api.checklists.list({ scope, createdBy: scope === "individual" ? user!.id : undefined });
    },
    enabled: !!user,
  });

  const checklistIds = checklists.map((checklist) => checklist.id);
  const { data: items = [] } = useQuery({
    queryKey: ["checklist-items", checklistIds.join(",")],
    queryFn: async () => {
      if (checklistIds.length === 0) return [] as ChecklistItem[];
      return api.checklistItems.list(checklistIds);
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => api.profiles.list(),
  });

  const itemsByChecklist = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {};
    for (const item of items) (map[item.checklist_id] ||= []).push(item);
    return map;
  }, [items]);

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((profile) => [profile.id, profile])), [profiles]);

  function resetDialog() {
    setTheme("");
    setSubactivities([""]);
  }

  function resetEditDialog() {
    setEditingChecklist(null);
    setEditTheme("");
    setEditSubactivities([]);
    setDeletedEditItemIds([]);
  }

  function openEditChecklist(checklist: Checklist, checklistItems: ChecklistItem[]) {
    setEditingChecklist(checklist);
    setEditTheme(checklist.title);
    setEditSubactivities(checklistItems.map((item) => ({ id: item.id, title: item.title })));
    setDeletedEditItemIds([]);
  }

  function addSubactivityInput() {
    setSubactivities((current) => [...current, ""]);
  }

  function addEditSubactivityInput() {
    setEditSubactivities((current) => [...current, { title: "" }]);
  }

  function setSubactivity(index: number, value: string) {
    setSubactivities((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function setEditSubactivity(index: number, value: string) {
    setEditSubactivities((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, title: value } : item))
    );
  }

  function removeEditSubactivity(index: number) {
    setEditSubactivities((current) => {
      const item = current[index];
      if (item?.id) {
        setDeletedEditItemIds((ids) => (ids.includes(item.id!) ? ids : [...ids, item.id!]));
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function completionName(item: ChecklistItem) {
    if (!item.completed_by) return "";
    return profileMap[item.completed_by]?.display_name?.trim() || "Usuario";
  }

  const createChecklist = useMutation({
    mutationFn: async () => {
      const cleanItems = subactivities.map((item) => item.trim()).filter(Boolean);
      const checklist = await api.checklists.create({
        title: theme.trim(),
        scope,
        created_by: user!.id,
      });
      if (cleanItems.length > 0) {
        await api.checklistItems.create(
          cleanItems.map((item, index) => ({
            checklist_id: checklist.id,
            title: item,
            position: index,
          }))
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists"] });
      qc.invalidateQueries({ queryKey: ["checklist-items"] });
      toast.success("Checklist salvo");
      setOpen(false);
      resetDialog();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro"),
  });

  const updateChecklist = useMutation({
    mutationFn: async () => {
      if (!editingChecklist) return;
      const title = editTheme.trim();
      if (!title) throw new Error("Informe o tema do checklist.");

      const blankExistingIds = editSubactivities
        .filter((item) => item.id && !item.title.trim())
        .map((item) => item.id!);
      const deleteIds = Array.from(new Set([...deletedEditItemIds, ...blankExistingIds]));
      const cleanItems = editSubactivities
        .map((item, position) => ({ ...item, title: item.title.trim(), position }))
        .filter((item) => item.title);
      const originalItems = itemsByChecklist[editingChecklist.id] || [];

      await api.checklists.update(editingChecklist.id, { title });
      if (deleteIds.length > 0) {
        await Promise.all(deleteIds.map((id) => api.checklistItems.remove(id)));
      }

      const existingUpdates = cleanItems
        .filter((item) => item.id)
        .map((item) => {
          const original = originalItems.find((originalItem) => originalItem.id === item.id);
          return original && original.title !== item.title
            ? api.checklistItems.update(item.id!, { title: item.title })
            : null;
        })
        .filter((promise): promise is Promise<ChecklistItem> => Boolean(promise));

      if (existingUpdates.length > 0) {
        await Promise.all(existingUpdates);
      }

      const newItems = cleanItems.filter((item) => !item.id);
      if (newItems.length > 0) {
        await api.checklistItems.create(
          newItems.map((item) => ({
            checklist_id: editingChecklist.id,
            title: item.title,
            position: item.position,
          }))
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists"] });
      qc.invalidateQueries({ queryKey: ["checklist-items"] });
      toast.success("Checklist atualizado");
      resetEditDialog();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro"),
  });

  const addItem = useMutation({
    mutationFn: async ({ checklistId, title, position }: { checklistId: string; title: string; position: number }) => {
      await api.checklistItems.create([{ checklist_id: checklistId, title, position }]);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["checklists"] });
      qc.invalidateQueries({ queryKey: ["checklist-items"] });
      setNewItemByChecklist((current) => ({ ...current, [variables.checklistId]: "" }));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro"),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ item, done }: { item: ChecklistItem; done: boolean }) => {
      await api.checklistItems.update(item.id, { done, completed_by: user!.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists"] });
      qc.invalidateQueries({ queryKey: ["checklist-items"] });
    },
    onError: (error) => {
      qc.invalidateQueries({ queryKey: ["checklists"] });
      qc.invalidateQueries({ queryKey: ["checklist-items"] });
      toast.error(error instanceof Error ? error.message : "Erro");
    },
  });

  const removeChecklist = useMutation({
    mutationFn: async (id: string) => api.checklists.remove(id, user?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists"] });
      qc.invalidateQueries({ queryKey: ["checklist-items"] });
      toast.success("Checklist removido");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro"),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => api.checklistItems.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists"] });
      qc.invalidateQueries({ queryKey: ["checklist-items"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro"),
  });

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col p-6 lg:p-10">
      <div className="mb-8 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Checklists</p>
          <h1 className="font-display text-4xl mt-1 break-words">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo checklist
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
        {checklists.length === 0 && (
          <p className="text-muted-foreground italic">Nenhum checklist por aqui ainda.</p>
        )}

        {checklists.map((checklist) => {
          const checklistItems = itemsByChecklist[checklist.id] || [];
          const doneCount = checklistItems.filter((item) => item.done).length;
          const nextItemTitle = newItemByChecklist[checklist.id] ?? "";

          return (
            <Card key={checklist.id} className="min-w-0 overflow-hidden p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-display text-2xl leading-tight">{checklist.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {doneCount}/{checklistItems.length} concluidas
                    </Badge>
                    {scope === "group" && checklist.created_by && (
                      <span className="text-xs text-muted-foreground">
                        Criado por {profileMap[checklist.created_by]?.display_name?.trim() || "Usuario"}
                      </span>
                    )}
                  </div>
                </div>
                {checklist.created_by === user?.id && (
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditChecklist(checklist, checklistItems)}
                      disabled={updateChecklist.isPending}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={removeChecklist.isPending}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir checklist?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa acao remove o checklist e todas as subatividades definitivamente. Deseja continuar?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeChecklist.mutate(checklist.id)} disabled={removeChecklist.isPending}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>

              <div className="mt-5 max-h-[min(42vh,28rem)] space-y-2 overflow-y-auto pr-1">
                {checklistItems.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Adicione a primeira subatividade.</p>
                )}
                {checklistItems.map((item) => {
                  const name = completionName(item);
                  const doneBySomeoneElse = item.done && item.completed_by && item.completed_by !== user?.id;
                  return (
                    <div key={item.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                      <Checkbox
                        checked={item.done}
                        disabled={!!doneBySomeoneElse || toggleItem.isPending}
                        onCheckedChange={(checked) => toggleItem.mutate({ item, done: !!checked })}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className={cn("break-words text-sm font-medium", item.done && "line-through text-muted-foreground")}>
                          {item.title}
                        </div>
                        {item.done && name && (
                          <div className="mt-1 text-xs text-muted-foreground">Concluido por {name}</div>
                        )}
                      </div>
                      {checklist.created_by === user?.id && (
                        <Button variant="ghost" size="icon" onClick={() => removeItem.mutate(item.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex gap-2">
                <Input
                  value={nextItemTitle}
                  onChange={(event) =>
                    setNewItemByChecklist((current) => ({ ...current, [checklist.id]: event.target.value }))
                  }
                  placeholder="Nova subatividade"
                  maxLength={200}
                />
                <Button
                  variant="secondary"
                  disabled={!nextItemTitle.trim() || addItem.isPending}
                  onClick={() =>
                    addItem.mutate({
                      checklistId: checklist.id,
                      title: nextItemTitle.trim(),
                      position: checklistItems.length,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => (setOpen(nextOpen), !nextOpen && resetDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Novo checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="checklist-title">Tema da atividade</Label>
              <Input id="checklist-title" value={theme} onChange={(event) => setTheme(event.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Subatividades</Label>
              {subactivities.map((item, index) => (
                <Input
                  key={index}
                  value={item}
                  onChange={(event) => setSubactivity(index, event.target.value)}
                  placeholder={`Subatividade ${index + 1}`}
                  maxLength={200}
                />
              ))}
              <Button type="button" variant="secondary" onClick={addSubactivityInput}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar subatividade
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => createChecklist.mutate()} disabled={!theme.trim() || createChecklist.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingChecklist} onOpenChange={(nextOpen) => !nextOpen && resetEditDialog()}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Editar checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-checklist-title">Tema da atividade</Label>
              <Input
                id="edit-checklist-title"
                value={editTheme}
                onChange={(event) => setEditTheme(event.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Subatividades</Label>
              {editSubactivities.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Nenhuma subatividade.</p>
              )}
              {editSubactivities.map((item, index) => (
                <div key={item.id ?? index} className="flex gap-2">
                  <Input
                    value={item.title}
                    onChange={(event) => setEditSubactivity(index, event.target.value)}
                    placeholder={`Subatividade ${index + 1}`}
                    maxLength={200}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeEditSubactivity(index)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addEditSubactivityInput}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar subatividade
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetEditDialog}>Cancelar</Button>
            <Button onClick={() => updateChecklist.mutate()} disabled={!editTheme.trim() || updateChecklist.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
