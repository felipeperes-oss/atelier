import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api, API_BASE, type Conversation, type ConversationMessage } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

const ALERT_PRIORITY_LABEL = {
  low: "baixa",
  normal: "normal",
  high: "urgente",
} as const;

function AuthLayout() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const url = `${API_BASE}/users/${user.id}/events`;
    const es = new EventSource(url);
    es.addEventListener("open", () => {
      console.debug("User SSE connected", url);
    });
    es.addEventListener("error", (event) => {
      console.debug("User SSE error", event);
    });
    es.addEventListener("newConversation", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as Conversation;
        qc.setQueryData(["conversations", user.id], (old: Conversation[] | undefined) => {
          if (!old) return [data];
          const exists = old.some((conversation) => conversation.id === data.id);
          return exists ? old : [data, ...old];
        });
        toast.success("Nova conversa recebida");
      } catch (e) {
        // ignore parse errors
      }
    });
    es.addEventListener("deletedConversation", (ev: MessageEvent) => {
      try {
        let deletedConversationId: string;
        try {
          deletedConversationId = JSON.parse(ev.data) as string;
        } catch {
          deletedConversationId = ev.data;
        }
        qc.setQueryData(["conversations", user.id], (old: Conversation[] | undefined) =>
          old ? old.filter((conversation) => conversation.id !== deletedConversationId) : []
        );
        qc.removeQueries({ queryKey: ["conversationMessages", deletedConversationId] });
        toast.success("Conversa removida");
      } catch (e) {
        // ignore parse errors
      }
    });
    es.addEventListener("newMessage", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as { conversationId: string; message: ConversationMessage };
        qc.invalidateQueries({ queryKey: ["conversationMessages", data.conversationId] });
        toast.success("Nova mensagem no chat");
      } catch (e) {
        // ignore parse errors
      }
    });
    es.addEventListener("checklistChanged", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as {
          action?: string;
          title?: string;
          createdBy?: string;
          itemTitle?: string;
          completedBy?: string;
          completedByName?: string;
          deletedBy?: string;
          deletedByName?: string;
        };
        if (data.action === "created" && data.createdBy !== user.id) {
          toast.success(data.title ? `Novo checklist em grupo: ${data.title}` : "Novo checklist em grupo");
        } else if (data.action === "itemCompleted" && data.completedBy !== user.id) {
          const name = data.completedByName?.trim() || "Usuario";
          toast.success(
            data.itemTitle
              ? `${name} concluiu a subatividade: ${data.itemTitle}`
              : `${name} concluiu uma subatividade`
          );
        } else if (data.action === "deleted" && data.deletedBy !== user.id) {
          const name = data.deletedByName?.trim() || "Usuario";
          toast.success(
            data.title
              ? `${name} excluiu o checklist: ${data.title}`
              : `${name} excluiu um checklist em grupo`
          );
        }
      } catch (e) {
        // ignore parse errors
      } finally {
        qc.invalidateQueries({ queryKey: ["checklists"] });
        qc.invalidateQueries({ queryKey: ["checklist-items"] });
      }
    });
    es.addEventListener("alertChanged", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as {
          action?: string;
          title?: string;
          priority?: keyof typeof ALERT_PRIORITY_LABEL;
          createdBy?: string;
          createdByName?: string;
          deletedBy?: string;
          deletedByName?: string;
        };
        if (data.action === "created" && data.createdBy !== user.id) {
          const name = data.createdByName?.trim() || "Usuario";
          const priority =
            data.priority && data.priority in ALERT_PRIORITY_LABEL
              ? ALERT_PRIORITY_LABEL[data.priority]
              : "normal";
          toast.success(
            data.title
              ? `${name} abriu um alerta ${priority}: ${data.title}`
              : `${name} abriu um alerta ${priority}`
          );
        } else if (data.action === "deleted") {
          const name = data.deletedByName?.trim() || "Usuario";
          toast.success(
            data.title
              ? `${name} excluiu o aviso: ${data.title}`
              : `${name} excluiu um aviso`
          );
        }
      } catch (e) {
        // ignore parse errors
      } finally {
        qc.invalidateQueries({ queryKey: ["alerts"] });
      }
    });
    es.addEventListener("noteChanged", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as {
          action?: string;
          title?: string;
          scope?: string;
          createdBy?: string;
          createdByName?: string;
        };
        if (data.action === "created" && data.scope === "general" && data.createdBy !== user.id) {
          const name = data.createdByName?.trim() || "Usuario";
          toast.success(
            data.title
              ? `${name} postou uma anotacao geral: ${data.title}`
              : `${name} postou uma anotacao geral`
          );
        }
      } catch (e) {
        // ignore parse errors
      } finally {
        qc.invalidateQueries({ queryKey: ["notes"] });
      }
    });
    es.addEventListener("taskChanged", (ev: MessageEvent) => {
      try {
        JSON.parse(ev.data);
      } catch (e) {
        // ignore parse errors
      } finally {
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["tasks-scope"] });
        qc.invalidateQueries({ queryKey: ["task_assignees"] });
        qc.invalidateQueries({ queryKey: ["assignees-scope"] });
      }
    });
    es.addEventListener("tutorialChanged", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as {
          action?: string;
          title?: string;
          createdBy?: string;
          createdByName?: string;
          deletedBy?: string;
          deletedByName?: string;
        };
        if (data.action === "created" && data.createdBy !== user.id) {
          const name = data.createdByName?.trim() || "Usuario";
          toast.success(
            data.title
              ? `${name} adicionou um tutorial: ${data.title}`
              : `${name} adicionou um tutorial`
          );
        } else if (data.action === "deleted") {
          const name = data.deletedByName?.trim() || "Usuario";
          toast.success(
            data.title
              ? `${name} excluiu o tutorial: ${data.title}`
              : `${name} excluiu um tutorial`
          );
        }
      } catch (e) {
        // ignore parse errors
      } finally {
        qc.invalidateQueries({ queryKey: ["tutorials"] });
      }
    });
    return () => {
      try {
        es.close();
      } catch (e) {}
    };
  }, [user?.id, qc]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
