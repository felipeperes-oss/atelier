import { createFileRoute } from "@tanstack/react-router";
import { ChecklistPage } from "@/components/checklist-page";

export const Route = createFileRoute("/_authenticated/checklist-individual")({
  head: () => ({ meta: [{ title: "Checklist individual - Atelier" }] }),
  component: () => (
    <ChecklistPage
      scope="individual"
      title="Checklist individual"
      subtitle="Organize suas atividades pessoais em listas com subatividades."
    />
  ),
});
