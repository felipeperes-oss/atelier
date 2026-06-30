import { createFileRoute } from "@tanstack/react-router";
import { NotesPage } from "@/components/notes-page";

export const Route = createFileRoute("/_authenticated/anotacoes-individuais")({
  head: () => ({ meta: [{ title: "Anotações individuais — Atelier" }] }),
  component: () => <NotesPage scope="individual" title="Anotações individuais" subtitle="Pensamentos privados, só você vê." />,
});
