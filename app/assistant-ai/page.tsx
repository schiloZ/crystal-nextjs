import { AppShell } from "@/components/app-shell";
import { AssistantAiWorkspace } from "./workspace";

export default function Page() {
  return <AppShell title="Assistant AI — Base de données" subtitle="Analyse conversationnelle / Données CRYSTAL">
    <AssistantAiWorkspace />
  </AppShell>;
}
