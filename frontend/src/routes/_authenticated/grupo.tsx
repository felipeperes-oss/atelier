import { createFileRoute } from "@tanstack/react-router";
import { TasksPage } from "@/components/tasks-page";

export const Route = createFileRoute("/_authenticated/grupo")({
  head: () => ({ meta: [{ title: "Trabalho em grupo — Atelier" }] }),
  component: () => <TasksPage scope="group" title="Trabalho em grupo" subtitle="Tarefas compartilhadas com toda a equipe." />,
});
