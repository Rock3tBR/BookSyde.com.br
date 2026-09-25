import { createFileRoute } from "@tanstack/react-router";
import { ManagementNavigation } from "@/components/ManagementNavigation";
import { AdminContractsPanel } from "@/components/ContractsManager";
export const Route = createFileRoute("/admin_/contratos")({
  head:()=>({meta:[{title:"Contratos — Administração BookSyde"}]}),
  component:()=> <ManagementNavigation area="admin"><AdminContractsPanel/></ManagementNavigation>,
});
