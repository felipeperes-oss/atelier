export const API_BASE =
  import.meta.env.VITE_API_URL ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8082/api/app`
    : "http://localhost:8082/api/app");

export type AppUser = {
  id: string;
  email: string;
  display_name: string;
  photo_url?: string | null;
};

export type Profile = {
  id: string;
  display_name: string;
  photo_url?: string | null;
};

export type ProfileUpdate = {
  email?: string;
  display_name?: string;
  password?: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  task_date: string;
  scope: "group" | "individual";
  done: boolean;
  created_by: string;
  created_at?: string;
};

export type TaskAssignee = {
  task_id: string;
  user_id: string;
};

export type Checklist = {
  id: string;
  title: string;
  scope: "group" | "individual";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  id: string;
  checklist_id: string;
  title: string;
  done: boolean;
  completed_by: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
};

export type Note = {
  id: string;
  title: string;
  content: string | null;
  scope: "general" | "individual";
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type AlertItem = {
  id: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high";
  user_id: string;
  created_at: string;
};

export type Tutorial = {
  id: string;
  title: string;
  content: string | null;
  url: string | null;
  file_name?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  user_id: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  created_by: string;
  type: "direct" | "group";
  title: string | null;
  participant_ids: string[];
  created_at: string;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  file_name?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  created_at: string;
};

export type ConversationTypingEvent = {
  conversationId: string;
  userId: string;
  typing: boolean;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: isFormData
      ? options.headers
      : {
          "Content-Type": "application/json",
          ...options.headers,
        },
  });

  if (!response.ok) {
    let message = "Erro ao acessar o backend";
    const text = await response.text();
    try {
      const json = JSON.parse(text || "{}");
      if (typeof json.message === "string" && json.message.trim()) {
        message = json.message;
      } else if (typeof json.error === "string" && json.error.trim()) {
        message = json.error;
      } else if (text.trim()) {
        message = text;
      }
    } catch {
      if (text.trim()) {
        message = text;
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function query(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

export const api = {
  auth: {
    signIn: (email: string, password: string) =>
      request<{ user: AppUser }>("/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    signUp: (email: string, password: string, displayName: string) =>
      request<{ user: AppUser }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, display_name: displayName }),
      }),
  },
  profiles: {
    list: () => request<Profile[]>("/profiles"),
    update: (id: string, profile: ProfileUpdate) =>
      request<{ user: AppUser }>(`/profiles/${id}`, {
        method: "PUT",
        body: JSON.stringify(profile),
      }),
    updatePhoto: (id: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return request<{ user: AppUser }>(`/profiles/${id}/photo`, {
        method: "POST",
        body: formData,
      });
    },
  },
  tasks: {
    list: (params: { start?: string; end?: string; scope?: string; createdBy?: string } = {}) =>
      request<Task[]>(`/tasks${query(params)}`),
    create: (task: Omit<Task, "id" | "created_at">) =>
      request<Task>("/tasks", { method: "POST", body: JSON.stringify(task) }),
    update: (id: string, task: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(task) }),
    remove: (id: string, deletedBy?: string) =>
      request<void>(`/tasks/${id}${query({ deletedBy })}`, { method: "DELETE" }),
  },
  taskAssignees: {
    list: (taskIds: string[]) =>
      request<TaskAssignee[]>(`/task-assignees${query({ taskIds: taskIds.join(",") })}`),
    create: (rows: TaskAssignee[]) =>
      request<TaskAssignee[]>("/task-assignees", { method: "POST", body: JSON.stringify(rows) }),
    replace: (taskId: string, rows: TaskAssignee[]) =>
      request<TaskAssignee[]>(`/tasks/${taskId}/assignees`, { method: "PUT", body: JSON.stringify(rows) }),
  },
  checklists: {
    list: (params: { scope?: string; createdBy?: string } = {}) =>
      request<Checklist[]>(`/checklists${query(params)}`),
    create: (checklist: Omit<Checklist, "id" | "created_at" | "updated_at">) =>
      request<Checklist>("/checklists", { method: "POST", body: JSON.stringify(checklist) }),
    update: (id: string, checklist: Pick<Checklist, "title">) =>
      request<Checklist>(`/checklists/${id}`, { method: "PUT", body: JSON.stringify(checklist) }),
    remove: (id: string, deletedBy?: string) =>
      request<void>(`/checklists/${id}${query({ deletedBy })}`, { method: "DELETE" }),
  },
  checklistItems: {
    list: (checklistIds: string[]) =>
      request<ChecklistItem[]>(`/checklist-items${query({ checklistIds: checklistIds.join(",") })}`),
    create: (items: Array<Pick<ChecklistItem, "checklist_id" | "title" | "position">>) =>
      request<ChecklistItem[]>("/checklist-items", { method: "POST", body: JSON.stringify(items) }),
    update: (id: string, item: { title?: string; done?: boolean; completed_by?: string }) =>
      request<ChecklistItem>(`/checklist-items/${id}`, { method: "PUT", body: JSON.stringify(item) }),
    remove: (id: string) => request<void>(`/checklist-items/${id}`, { method: "DELETE" }),
  },
  notes: {
    list: (params: { scope?: string; userId?: string } = {}) =>
      request<Note[]>(`/notes${query(params)}`),
    create: (note: Omit<Note, "id" | "created_at" | "updated_at">) =>
      request<Note>("/notes", { method: "POST", body: JSON.stringify(note) }),
    update: (id: string, note: Pick<Note, "title" | "content">) =>
      request<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(note) }),
    remove: (id: string, deletedBy?: string) =>
      request<void>(`/notes/${id}${query({ deletedBy })}`, { method: "DELETE" }),
  },
  alerts: {
    list: () => request<AlertItem[]>("/alerts"),
    create: (alert: Omit<AlertItem, "id" | "created_at">) =>
      request<AlertItem>("/alerts", { method: "POST", body: JSON.stringify(alert) }),
    update: (id: string, alert: Pick<AlertItem, "title" | "message" | "priority">) =>
      request<AlertItem>(`/alerts/${id}`, { method: "PUT", body: JSON.stringify(alert) }),
    remove: (id: string, deletedBy?: string) =>
      request<void>(`/alerts/${id}${query({ deletedBy })}`, { method: "DELETE" }),
  },
  tutorials: {
    list: () => request<Tutorial[]>("/tutorials"),
    create: (tutorial: Omit<Tutorial, "id" | "created_at">, file?: File | null) => {
      if (file) {
        const formData = new FormData();
        formData.append("title", tutorial.title);
        if (tutorial.content) formData.append("content", tutorial.content);
        if (tutorial.url) formData.append("url", tutorial.url);
        formData.append("user_id", tutorial.user_id);
        formData.append("file", file);
        return request<Tutorial>("/tutorials", { method: "POST", body: formData });
      }

      return request<Tutorial>("/tutorials", { method: "POST", body: JSON.stringify(tutorial) });
    },
    update: (id: string, tutorial: Pick<Tutorial, "title" | "content" | "url">, file?: File | null) => {
      if (file) {
        const formData = new FormData();
        formData.append("title", tutorial.title);
        if (tutorial.content) formData.append("content", tutorial.content);
        if (tutorial.url) formData.append("url", tutorial.url);
        formData.append("file", file);
        return request<Tutorial>(`/tutorials/${id}`, { method: "PUT", body: formData });
      }

      return request<Tutorial>(`/tutorials/${id}`, { method: "PUT", body: JSON.stringify(tutorial) });
    },
    remove: (id: string, deletedBy?: string) =>
      request<void>(`/tutorials/${id}${query({ deletedBy })}`, { method: "DELETE" }),
  },
  conversations: {
    list: (params: { userId?: string } = {}) => request<Conversation[]>(`/conversations${query(params)}`),
    create: (conversation: { created_by: string; participant_ids: string[]; type: string; title?: string | null }) =>
      request<Conversation>("/conversations", { method: "POST", body: JSON.stringify(conversation) }),
    delete: (conversationId: string) => request<void>(`/conversations/${conversationId}`, { method: "DELETE" }),
    typing: (conversationId: string, payload: { user_id: string; typing: boolean }) =>
      request<void>(`/conversations/${conversationId}/typing`, { method: "POST", body: JSON.stringify(payload) }),
    messages: {
      list: (conversationId: string) => request<ConversationMessage[]>(`/conversations/${conversationId}/messages`),
      create: (conversationId: string, message: { sender_id: string; content: string }) =>
        request<ConversationMessage>(`/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify(message) }),
      upload: (conversationId: string, formData: FormData) =>
        request<ConversationMessage>(`/conversations/${conversationId}/messages/file`, {
          method: "POST",
          body: formData,
        }),
    },
  },
};
