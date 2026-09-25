import { Route } from "@/routes/studio";
import { AdminWorkspace } from "@/pages/admin";

export function StudioPage() {
  const { obra, aba } = Route.useSearch();
  const initialTab = aba === "volumes" ? "volumes" : aba === "criar" ? "mangas" : "catalog";
  return (
    <AdminWorkspace key={`${aba}-${obra}`} mode="studio" obra={obra} initialTab={initialTab} />
  );
}
