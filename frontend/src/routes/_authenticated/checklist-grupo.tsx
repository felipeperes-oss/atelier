import { createFileRoute } from "@tanstack/react-router";
import { ChecklistPage } from "@/components/checklist-page";

export const Route = createFileRoute("/_authenticated/checklist-grupo")({
  head: () => ({ meta: [{ title: "Checklist em grupo - Atelier" }] }),
  component: () => (
    <ChecklistPage
      scope="group"
      title="Checklist em grupo"
      subtitle="Acompanhe atividades compartilhadas e veja quem concluiu cada subatividade."
    />
  ),
});
