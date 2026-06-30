import { createFileRoute } from "@tanstack/react-router";
import { TasksPage } from "@/components/tasks-page";

export const Route = createFileRoute("/_authenticated/individual")({
  head: () => ({ meta: [{ title: "Trabalho individual — Atelier" }] }),
  component: () => <TasksPage scope="individual" title="Trabalho individual" subtitle="Suas tarefas pessoais, visíveis apenas para você." />,
});
