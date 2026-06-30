import { createFileRoute } from "@tanstack/react-router";
import { NotesPage } from "@/components/notes-page";

export const Route = createFileRoute("/_authenticated/anotacoes-gerais")({
  head: () => ({ meta: [{ title: "Anotações gerais — Atelier" }] }),
  component: () => <NotesPage scope="general" title="Anotações gerais" subtitle="Conteúdo compartilhado com toda a equipe." />,
});
