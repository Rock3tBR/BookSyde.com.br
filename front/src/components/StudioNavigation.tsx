import { useState } from "react";
import { BookOpen, FilePlus2, Layers3, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const sections = [
  { value: "catalog", label: "Minhas obras", description: "Editar e organizar", icon: BookOpen },
  { value: "mangas", label: "Criar obra", description: "Nova publicação", icon: FilePlus2 },
  { value: "volumes", label: "Conteúdo", description: "Volumes e arquivos", icon: Layers3 },
] as const;

export type StudioSection = (typeof sections)[number]["value"];

export function StudioNavigation({ current }: { current: StudioSection }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentSection = sections.find((section) => section.value === current) ?? sections[0];
  const CurrentIcon = currentSection.icon;

  const renderItems = (mobile: boolean) => (
    <TabsList
      data-tour={mobile ? "studio-mobile-tabs" : "studio-tabs"}
      aria-label="Áreas do Estúdio"
      className="flex h-auto w-full flex-col items-stretch gap-1 rounded-xl border-0 bg-transparent p-0 shadow-none"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <TabsTrigger
            key={section.value}
            value={section.value}
            onClick={() => mobile && setMobileOpen(false)}
            className={cn(
              "flex min-h-[60px] w-full min-w-0 items-center justify-start gap-3 whitespace-normal rounded-xl px-3 py-2.5 text-left text-muted-foreground",
              "hover:bg-muted/65 hover:text-foreground focus-visible:ring-primary/60",
              "data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{section.label}</span>
              <span className="mt-0.5 block text-xs font-normal leading-4 opacity-75">{section.description}</span>
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );

  return (
    <>
      <aside
        className="hidden self-start rounded-2xl border border-border/70 bg-card/70 p-2.5 shadow-sm lg:sticky lg:top-28 lg:block"
        aria-label="Menu lateral do Estúdio"
      >
        <nav aria-label="Navegação do Estúdio">{renderItems(false)}</nav>
      </aside>

      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/65 bg-card/70 px-3 py-2 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-lg" aria-label="Abrir menu do Estúdio">
              <Menu className="size-4" /> Menu
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(88vw,320px)] overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
            <SheetHeader className="pb-4 pt-5 text-left">
              <SheetTitle>Estúdio BookSyde</SheetTitle>
              <SheetDescription>Escolha a área que deseja gerenciar.</SheetDescription>
            </SheetHeader>
            <nav aria-label="Menu móvel do Estúdio">{renderItems(true)}</nav>
          </SheetContent>
        </Sheet>
        <CurrentIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 truncate text-sm font-semibold">{currentSection.label}</span>
      </div>
    </>
  );
}
