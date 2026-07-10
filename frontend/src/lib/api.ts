const API_BASE =
  import.meta.env.VITE_API_URL ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8082/api/app`
    : "http://localhost:8082/api/app");

export type AppUser = {
  id: string;
  email: string;
  display_name: string;
};

export type Profile = {
  id: string;
  display_name: string;
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
  user_id: string;
  created_at: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Erro ao acessar o backend");
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
  },
  tasks: {
    list: (params: { start?: string; end?: string; scope?: string; createdBy?: string } = {}) =>
      request<Task[]>(`/tasks${query(params)}`),
    create: (task: Omit<Task, "id" | "created_at">) =>
      request<Task>("/tasks", { method: "POST", body: JSON.stringify(task) }),
    update: (id: string, task: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(task) }),
    remove: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
  },
  taskAssignees: {
    list: (taskIds: string[]) =>
      request<TaskAssignee[]>(`/task-assignees${query({ taskIds: taskIds.join(",") })}`),
    create: (rows: TaskAssignee[]) =>
      request<TaskAssignee[]>("/task-assignees", { method: "POST", body: JSON.stringify(rows) }),
  },
  notes: {
    list: (params: { scope?: string; userId?: string } = {}) =>
      request<Note[]>(`/notes${query(params)}`),
    create: (note: Omit<Note, "id" | "created_at" | "updated_at">) =>
      request<Note>("/notes", { method: "POST", body: JSON.stringify(note) }),
    update: (id: string, note: Pick<Note, "title" | "content">) =>
      request<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(note) }),
    remove: (id: string) => request<void>(`/notes/${id}`, { method: "DELETE" }),
  },
  alerts: {
    list: () => request<AlertItem[]>("/alerts"),
    create: (alert: Omit<AlertItem, "id" | "created_at">) =>
      request<AlertItem>("/alerts", { method: "POST", body: JSON.stringify(alert) }),
    remove: (id: string) => request<void>(`/alerts/${id}`, { method: "DELETE" }),
  },
  tutorials: {
    list: () => request<Tutorial[]>("/tutorials"),
    create: (tutorial: Omit<Tutorial, "id" | "created_at">) =>
      request<Tutorial>("/tutorials", { method: "POST", body: JSON.stringify(tutorial) }),
    remove: (id: string) => request<void>(`/tutorials/${id}`, { method: "DELETE" }),
  },
};
