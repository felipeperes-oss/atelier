import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api, API_BASE, type Conversation, type ConversationMessage, type ConversationTypingEvent, type Profile } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { MessageCircleMore, Plus, SendHorizonal, Users, Paperclip } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — Atelier" }] }),
  component: ChatPage,
});

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [typingByUser, setTypingByUser] = useState<Record<string, number>>({});
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef(0);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => api.profiles.list(),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => (user ? api.conversations.list({ userId: user.id }) : []),
    enabled: !!user,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["conversationMessages", selectedConversationId],
    queryFn: () => (selectedConversationId ? api.conversations.messages.list(selectedConversationId) : []),
    enabled: !!selectedConversationId,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const profileMap = useMemo(() => Object.fromEntries(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const activeTypingProfiles = useMemo(() => {
    const now = Date.now();
    return Object.entries(typingByUser)
      .filter(([userId, expiresAt]) => userId !== user?.id && expiresAt > now)
      .map(([userId]) => profileMap[userId])
      .filter((profile): profile is Profile => Boolean(profile));
  }, [profileMap, typingByUser, user?.id]);
  const typingLabel = useMemo(() => {
    if (activeTypingProfiles.length === 0) return "";
    if (activeTypingProfiles.length === 1) {
      return `${activeTypingProfiles[0].display_name} esta escrevendo`;
    }
    if (activeTypingProfiles.length === 2) {
      return `${activeTypingProfiles.map((profile) => profile.display_name).join(" e ")} estao escrevendo`;
    }
    return `${activeTypingProfiles.length} pessoas estao escrevendo`;
  }, [activeTypingProfiles]);

  const profilePhotoUrl = useCallback((profile: Profile | undefined) => {
    return profile?.photo_url ? `${API_BASE}${profile.photo_url}` : null;
  }, []);

  const stopTyping = useCallback((conversationId = selectedConversationId) => {
    if (!conversationId || !user) return;
    lastTypingSentAtRef.current = 0;
    api.conversations.typing(conversationId, { user_id: user.id, typing: false }).catch(() => {});
  }, [selectedConversationId, user]);

  const notifyTyping = useCallback(() => {
    if (!selectedConversationId || !user) return;
    const now = Date.now();
    if (now - lastTypingSentAtRef.current > 1200) {
      lastTypingSentAtRef.current = now;
      api.conversations.typing(selectedConversationId, { user_id: user.id, typing: true }).catch(() => {});
    }
    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }
    typingStopTimeoutRef.current = setTimeout(() => stopTyping(selectedConversationId), 1800);
  }, [selectedConversationId, stopTyping, user]);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    // request notification permission on mount
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const id = selectedConversationId;
    if (!id) return;
    // close previous source
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (e) {}
      eventSourceRef.current = null;
    }
    const url = `${API_BASE}/conversations/${id}/events`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    es.addEventListener("open", () => {
      console.debug("SSE connected", url);
    });
    es.addEventListener("error", (event) => {
      console.debug("SSE error", event);
    });
    es.addEventListener("message", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as ConversationMessage;
        qc.setQueryData(["conversationMessages", id], (old: any) => {
          if (!old) return [data];
          return [...old, data];
        });
        // browser notification if message from others
        if (data.sender_id !== user?.id) {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(`Nova mensagem de ${profileMap[data.sender_id]?.display_name ?? 'Usuário'}`, { body: data.content });
          }
          toast("Nova mensagem");
        }
      } catch (e) {
        // ignore parse errors
      }
    });
    es.addEventListener("typing", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as ConversationTypingEvent;
        if (data.userId === user?.id) return;
        setTypingByUser((current) => {
          const next = { ...current };
          if (data.typing) {
            next[data.userId] = Date.now() + 3000;
          } else {
            delete next[data.userId];
          }
          return next;
        });
      } catch (e) {
        // ignore parse errors
      }
    });
    // cleanup on unmount or id change
    return () => {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
      stopTyping(id);
      setTypingByUser({});
      try {
        es.close();
      } catch (e) {}
      if (eventSourceRef.current === es) eventSourceRef.current = null;
    };
  }, [selectedConversationId, qc, profileMap, stopTyping, user]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingByUser((current) => {
        const active = Object.fromEntries(Object.entries(current).filter(([, expiresAt]) => expiresAt > now));
        return Object.keys(active).length === Object.keys(current).length ? current : active;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollMessagesToBottom("smooth"));
    return () => cancelAnimationFrame(frame);
  }, [messages.length, activeTypingProfiles.length, selectedConversationId, scrollMessagesToBottom]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const createConversation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const participantIds = Array.from(new Set([user.id, ...selectedParticipants]));
      if (participantIds.length < 2) {
        throw new Error("Selecione pelo menos um participante para iniciar uma conversa.");
      }
      return api.conversations.create({
        created_by: user.id,
        participant_ids: participantIds.filter((id) => id !== user.id),
        type: participantIds.length > 2 ? "group" : "direct",
        title: groupTitle.trim() || null,
      });
    },
    onSuccess: (conversation) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedConversationId(conversation.id);
      setShowComposer(false);
      setSelectedParticipants([]);
      setGroupTitle("");
      toast.success("Conversa criada");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conversa");
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      return api.conversations.delete(conversationId);
    },
    onSuccess: (_data, conversationId) => {
      qc.setQueryData(["conversations", user?.id], (old: Conversation[] | undefined) =>
        old ? old.filter((conversation) => conversation.id !== conversationId) : []
      );
      if (selectedConversationId === conversationId) {
        const remaining = qc.getQueryData<Conversation[]>(["conversations", user?.id]) || [];
        setSelectedConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast.success("Conversa excluída");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a conversa");
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedConversationId || !user) {
        throw new Error("Conversa não disponível");
      }

      const normalizedDraft = draft.trim();
      if (!selectedFile && !normalizedDraft) {
        throw new Error("Mensagem vazia");
      }

      if (selectedFile) {
        const formData = new FormData();
        formData.append("sender_id", user.id);
        if (normalizedDraft) {
          formData.append("content", normalizedDraft);
        }
        formData.append("file", selectedFile);
        return api.conversations.messages.upload(selectedConversationId, formData);
      }

      return api.conversations.messages.create(selectedConversationId, {
        sender_id: user.id,
        content: normalizedDraft,
      });
    },
    onSuccess: () => {
      stopTyping(selectedConversationId);
      qc.invalidateQueries({ queryKey: ["conversationMessages", selectedConversationId] });
      setDraft("");
      setSelectedFile(null);
      toast.success("Mensagem enviada");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem");
    },
  });

  function toggleParticipant(userId: string) {
    setSelectedParticipants((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col p-6 lg:p-10">
      <div className="mb-6 flex shrink-0 items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Chat</p>
          <h1 className="font-display text-4xl mt-1">Conversas</h1>
        </div>
        <Button onClick={() => setShowComposer((value) => !value)}>
          <Plus className="mr-2 h-4 w-4" /> Nova conversa
        </Button>
      </div>

      {showComposer && (
        <Card className="mb-6 shrink-0 space-y-4 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="font-medium">Escolha os participantes</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {profiles
              .filter((profile) => profile.id !== user?.id)
              .map((profile) => (
                <label key={profile.id} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(profile.id)}
                    onChange={() => toggleParticipant(profile.id)}
                  />
                  <span>{profile.display_name}</span>
                </label>
              ))}
          </div>
          <Input
            placeholder="Título da conversa em grupo"
            value={groupTitle}
            onChange={(event) => setGroupTitle(event.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={() => createConversation.mutate()} disabled={createConversation.isPending}>
              {createConversation.isPending ? "Criando..." : "Criar conversa"}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="flex h-[calc(100vh-12rem)] min-h-[480px] flex-col overflow-hidden p-3">
          <div className="mb-3 shrink-0 px-2 text-sm font-medium text-muted-foreground">Conversas</div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {conversations.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhuma conversa ainda.
              </div>
            )}
            {conversations.map((conversation) => {
              const isActive = conversation.id === selectedConversationId;
              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full min-w-0 rounded-lg border p-3 text-left transition-colors ${
                    isActive ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent/40"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MessageCircleMore className="h-4 w-4 shrink-0" />
                    <span className="truncate font-medium">{conversation.title || (conversation.type === "group" ? "Grupo" : "Conversa")}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {conversation.participant_ids.length} participante{conversation.participant_ids.length === 1 ? "" : "s"}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="flex h-[calc(100vh-12rem)] min-h-[480px] flex-col p-0 overflow-hidden">
          {selectedConversation ? (
            <>
              <div className="border-b border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{selectedConversation.title || (selectedConversation.type === "group" ? "Grupo" : "Conversa")}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedConversation.participant_ids
                        .map((id) => profileMap[id]?.display_name)
                        .filter(Boolean)
                        .join(", ") || "Você"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{selectedConversation.type === "group" ? "Grupo" : "Direta"}</Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8" disabled={deleteConversation.isPending}>
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação remove a conversa e o histórico de mensagens. Deseja continuar?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => selectedConversation && deleteConversation.mutate(selectedConversation.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>

              <div ref={messagesViewportRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Nenhuma mensagem ainda. Comece a conversa.
                  </div>
                )}
                {messages.map((message) => {
                  const isMine = message.sender_id === user?.id;
                  const isImage = typeof message.mime_type === "string" && message.mime_type.startsWith("image/");
                  const senderProfile = profileMap[message.sender_id];
                  const senderName = senderProfile?.display_name ?? (isMine ? user?.display_name : "Usuário") ?? "Usuário";
                  const senderPhotoUrl = profilePhotoUrl(senderProfile) ?? (isMine && user?.photo_url ? `${API_BASE}${user.photo_url}` : null);
                  const avatar = (
                    <Avatar className="h-8 w-8">
                      {senderPhotoUrl && <AvatarImage src={senderPhotoUrl} alt={senderName} className="object-cover" />}
                      <AvatarFallback className="text-xs">{initials(senderName)}</AvatarFallback>
                    </Avatar>
                  );
                  return (
                    <div key={message.id} className={`flex min-w-0 items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                      {!isMine && avatar}
                      <div className={`min-w-0 max-w-[80%] overflow-hidden rounded-2xl px-3 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {message.file_url && (
                          <div className="mb-2">
                            {isImage ? (
                              <a href={`${API_BASE}${message.file_url}`} target="_blank" rel="noreferrer">
                                <img
                                  src={`${API_BASE}${message.file_url}`}
                                  alt={message.file_name ?? "Arquivo enviado"}
                                  className="max-h-80 rounded-md object-cover"
                                  onLoad={() => scrollMessagesToBottom("smooth")}
                                />
                              </a>
                            ) : (
                              <a
                                href={`${API_BASE}${message.file_url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-md bg-background/10 px-2 py-1 text-sm underline"
                              >
                                <Paperclip className="h-4 w-4" />
                                {message.file_name ?? "Arquivo"}
                              </a>
                            )}
                          </div>
                        )}
                        {message.content && <div className="break-words text-sm whitespace-pre-line [overflow-wrap:anywhere]">{message.content}</div>}
                        <div className={`mt-1 text-[11px] ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {senderName}
                        </div>
                      </div>
                      {isMine && avatar}
                    </div>
                  );
                })}
                {activeTypingProfiles.length > 0 && (
                  <div className="flex min-w-0 items-end gap-2">
                    <div className="flex -space-x-2">
                      {activeTypingProfiles.slice(0, 3).map((profile) => {
                        const photoUrl = profilePhotoUrl(profile);
                        return (
                          <Avatar key={profile.id} className="h-8 w-8 border-2 border-background">
                            {photoUrl && <AvatarImage src={photoUrl} alt={profile.display_name} className="object-cover" />}
                            <AvatarFallback className="text-xs">{initials(profile.display_name)}</AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                    <div className="rounded-2xl bg-muted px-3 py-2">
                      <div className="mb-1 text-[11px] text-muted-foreground">{typingLabel}</div>
                      <div className="flex h-4 items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border p-4">
                <div className="space-y-2">
                  {selectedFile && (
                    <div className="flex items-center justify-between rounded-md border border-border bg-accent/40 px-3 py-2 text-sm">
                      <span className="truncate">{selectedFile.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedFile(null)}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Textarea
                      value={draft}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        if (event.target.value.trim()) {
                          notifyTyping();
                        } else {
                          stopTyping(selectedConversationId);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          if (!sendMessage.isPending && (draft.trim() || selectedFile)) {
                            sendMessage.mutate();
                          }
                        }
                      }}
                      placeholder="Escreva sua mensagem"
                      className="min-h-[90px]"
                      maxLength={10000}
                    />
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background hover:bg-accent">
                        <Paperclip className="h-4 w-4" />
                        <input
                          type="file"
                          className="hidden"
                          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                        />
                      </label>
                      <Button
                        onClick={() => sendMessage.mutate()}
                        disabled={sendMessage.isPending || (!draft.trim() && !selectedFile)}
                      >
                        <SendHorizonal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Selecione ou crie uma conversa para começar.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
