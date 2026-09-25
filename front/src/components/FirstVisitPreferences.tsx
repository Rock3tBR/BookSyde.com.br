import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Bookmark,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  GalleryHorizontalEnd,
  LayoutGrid,
  LibraryBig,
  Newspaper,
  Palette,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";
import {
  getCatalogDisplayPreferences,
  saveCatalogDisplayPreferences,
  type CatalogDisplayPreferences,
  type CatalogDisplayStyle,
} from "@/lib/catalogDisplay";
import {
  ALL_WORK_TYPES,
  getVisibleWorkTypes,
  saveVisibleWorkTypes,
} from "@/lib/contentPreferences";
import { WORK_TYPES, type WorkType } from "@/lib/publication";
import { applySiteTheme, normalizeSiteTheme, type SiteTheme } from "@/lib/theme";
import { ThemePicker } from "@/components/ThemePicker";
import { cn } from "@/lib/utils";

type Step = 0 | 1 | 2;

const DISPLAY_OPTIONS: Array<{
  value: CatalogDisplayStyle;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    value: "grid",
    label: "Padrão",
    description: "Cards tradicionais, compactos e objetivos.",
    icon: <LayoutGrid className="size-4" />,
  },
  {
    value: "book",
    label: "Livro",
    description: "Capas com borda, páginas aparentes e marca-página.",
    icon: <Bookmark className="size-4" />,
  },
  {
    value: "realistic",
    label: "Realista",
    description: "Modelo 3D deitado; no desktop, fica em pé ao passar o mouse.",
    icon: <Box className="size-4" />,
  },
];

const WORK_TYPE_ICONS: Record<WorkType, ReactNode> = {
  manga: <BookOpen className="size-5" />,
  hq: <Sparkles className="size-5" />,
  gibi: <Newspaper className="size-5" />,
  book: <LibraryBig className="size-5" />,
};

function onboardingStorageKey(userId: string) {
  return `mangaka:site-onboarding:${userId}`;
}

export function FirstVisitPreferences() {
  const { user } = useAuth();
  const { data: profile, isFetched } = useProfile();
  const queryClient = useQueryClient();
  const initializedForUser = useRef<string | null>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [selectedTypes, setSelectedTypes] = useState<WorkType[]>([...ALL_WORK_TYPES]);
  const [theme, setTheme] = useState<SiteTheme>("light");
  const [displayStyle, setDisplayStyle] = useState<CatalogDisplayStyle>("grid");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      initializedForUser.current = null;
      setOpen(false);
      return;
    }

    if (!isFetched) {
      setOpen(false);
      return;
    }

    if (initializedForUser.current === user.id) return;
    initializedForUser.current = user.id;

    const completedLocally =
      typeof window !== "undefined" &&
      window.localStorage.getItem(onboardingStorageKey(user.id)) === "done";
    const completedInProfile = profile?.site_onboarding_completed === true;

    if (completedLocally || completedInProfile) {
      setOpen(false);
      return;
    }

    const initialTypes = getVisibleWorkTypes(profile);
    const initialTheme = normalizeSiteTheme(profile?.theme);
    const catalog = getCatalogDisplayPreferences(profile);
    const styles = Object.values(catalog);
    const firstStyle = styles[0] ?? catalog.manga;
    const initialStyle = styles.every((value) => value === firstStyle) ? firstStyle : catalog.manga;

    setSelectedTypes(initialTypes.length ? initialTypes : [...ALL_WORK_TYPES]);
    setTheme(initialTheme);
    setDisplayStyle(initialStyle);
    setStep(0);
    setOpen(true);
  }, [isFetched, profile, user]);

  const selectedSet = useMemo(() => new Set(selectedTypes), [selectedTypes]);

  function toggleWorkType(workType: WorkType) {
    setSelectedTypes((current) =>
      current.includes(workType)
        ? current.filter((item) => item !== workType)
        : [...current, workType],
    );
  }

  function chooseTheme(nextTheme: SiteTheme) {
    setTheme(nextTheme);
    applySiteTheme(nextTheme);
  }

  async function finishOnboarding() {
    if (!user) return;
    if (!selectedTypes.length) {
      toast.error("Selecione pelo menos um tipo de conteúdo.");
      setStep(0);
      return;
    }

    setSaving(true);

    const catalogDisplay: CatalogDisplayPreferences = {
      manga: displayStyle,
      hq: displayStyle,
      gibi: displayStyle,
      book: displayStyle,
    };

    saveVisibleWorkTypes(selectedTypes);
    saveCatalogDisplayPreferences(catalogDisplay);
    window.localStorage.setItem("mangaka-theme", theme);
    applySiteTheme(theme);

    const fallbackDisplayName =
      profile?.display_name ||
      (typeof user.user_metadata?.["display_name"] === "string"
        ? user.user_metadata["display_name"]
        : null) ||
      user.email?.split("@")[0] ||
      "Leitor";

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: fallbackDisplayName,
      visible_work_types: selectedTypes,
      theme,
      manga_display_style: displayStyle,
      hq_display_style: displayStyle,
      gibi_display_style: displayStyle,
      book_display_style: displayStyle,
      site_onboarding_completed: true,
    });

    if (error) {
      setSaving(false);
      toast.error(
        error.message.includes("site_onboarding_completed") ||
          error.message.includes("visible_work_types")
          ? "A migration das preferências iniciais ainda não foi aplicada no Supabase."
          : error.message,
      );
      return;
    }

    window.localStorage.setItem(onboardingStorageKey(user.id), "done");
    window.dispatchEvent(new CustomEvent("mangaka-preferences-updated"));
    await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });

    setSaving(false);
    setOpen(false);
    toast.success("Preferências salvas. Seu BookSyde está pronto.");
  }

  if (!user || !isFetched || !open) return null;

  return (
    <Dialog open={open}>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-3xl overflow-y-auto rounded-[1.6rem] border-border/70 bg-card/95 p-0 shadow-2xl backdrop-blur-2xl [&>button]:hidden"
      >
        <div className="border-b border-border/60 px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
          <div className="mb-5 flex items-center gap-2" aria-label={`Etapa ${step + 1} de 3`}>
            {[0, 1, 2].map((item) => (
              <span
                key={item}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  item <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>

          <DialogHeader>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="size-3.5" />
              Personalize sua experiência
            </div>
            <DialogTitle className="font-display text-2xl sm:text-3xl">
              {step === 0
                ? "O que você deseja visualizar?"
                : step === 1
                  ? "Escolha a cor do sistema"
                  : "Como você quer ver suas obras?"}
            </DialogTitle>
            <DialogDescription className="max-w-2xl leading-relaxed">
              {step === 0
                ? "Selecione um ou mais tipos de conteúdo. Você poderá alterar isso depois em Minha conta."
                : step === 1
                  ? "Escolha a aparência que mais combina com você. A mudança é aplicada na hora para você visualizar."
                  : "Escolha o estilo inicial do catálogo. Ele será usado em mangás, HQs, gibis e livros e poderá ser personalizado por tipo depois."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6">
          {step === 0 ? (
            <ContentStep
              selectedSet={selectedSet}
              selectedCount={selectedTypes.length}
              onToggle={toggleWorkType}
              onSelectAll={() => setSelectedTypes([...ALL_WORK_TYPES])}
            />
          ) : null}

          {step === 1 ? <ThemeStep value={theme} onChange={chooseTheme} /> : null}

          {step === 2 ? <DisplayStep value={displayStyle} onChange={setDisplayStyle} /> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border/60 bg-background/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="text-xs text-muted-foreground">
            Etapa <strong className="text-foreground">{step + 1}</strong> de 3
          </div>

          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setStep((current) => (current - 1) as Step)}
              >
                <ChevronLeft className="size-4" />
                Voltar
              </Button>
            ) : null}

            {step < 2 ? (
              <Button
                type="button"
                disabled={step === 0 && selectedTypes.length === 0}
                onClick={() => setStep((current) => (current + 1) as Step)}
              >
                Próximo
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button type="button" disabled={saving} onClick={() => void finishOnboarding()}>
                <Check className="size-4" />
                {saving ? "Salvando…" : "Concluir personalização"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContentStep({
  selectedSet,
  selectedCount,
  onToggle,
  onSelectAll,
}: {
  selectedSet: Set<WorkType>;
  selectedCount: number;
  onToggle: (workType: WorkType) => void;
  onSelectAll: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {selectedCount === 0
            ? "Selecione pelo menos uma opção."
            : `${selectedCount} ${selectedCount === 1 ? "tipo selecionado" : "tipos selecionados"}`}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onSelectAll}>
          Selecionar todos
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {WORK_TYPES.map((item) => {
          const selected = selectedSet.has(item.value);
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(item.value)}
              className={cn(
                "group flex min-h-24 items-center gap-4 rounded-[1.2rem] border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected
                  ? "border-primary bg-primary/10 shadow-[0_18px_45px_-34px_hsl(var(--primary))]"
                  : "border-border/70 bg-background/30 hover:border-primary/35 hover:bg-muted/45",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl border transition",
                  selected
                    ? "border-primary/35 bg-primary text-primary-foreground"
                    : "border-border/70 bg-card text-muted-foreground group-hover:text-foreground",
                )}
              >
                {WORK_TYPE_ICONS[item.value]}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-base">{item.label}</strong>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {item.value === "manga"
                    ? "Mangás e séries japonesas."
                    : item.value === "hq"
                      ? "Quadrinhos e graphic novels."
                      : item.value === "gibi"
                        ? "Gibis, revistas e coleções."
                        : "Livros digitais e ePubs."}
                </span>
              </span>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent",
                )}
              >
                <Check className="size-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      {selectedCount === 0 ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          É obrigatório selecionar pelo menos um tipo de conteúdo para continuar.
        </p>
      ) : null}
    </div>
  );
}

function ThemeStep({ value, onChange }: { value: SiteTheme; onChange: (theme: SiteTheme) => void }) {
  return <ThemePicker value={value} onChange={onChange} />;
}

function DisplayStep({
  value,
  onChange,
}: {
  value: CatalogDisplayStyle;
  onChange: (style: CatalogDisplayStyle) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {DISPLAY_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "overflow-hidden rounded-[1.2rem] border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected
                ? "border-primary bg-primary/10"
                : "border-border/70 bg-background/30 hover:border-primary/35 hover:bg-muted/45",
            )}
          >
            <DisplayStylePreview style={option.value} />
            <div className="p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {option.icon}
                {option.label}
                {selected ? <Check className="ml-auto size-4 text-primary" /> : null}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DisplayStylePreview({ style }: { style: CatalogDisplayStyle }) {
  if (style === "book") {
    return (
      <div className="flex h-36 items-center justify-center border-b border-border/60 bg-background/35 px-4">
        <div className="relative h-24 w-[4.5rem]">
          <div className="absolute -bottom-2 -left-1 -right-1 top-1 rounded-[0.7rem] bg-black/35" />
          <div
            className="absolute bottom-0 left-1 right-0 h-4 rounded-b-md border border-[#d8c7a2]/70 bg-[#efe1bf]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(120,88,38,0.16) 0 1px, rgba(255,255,255,0.35) 1px 3px)",
            }}
          />
          <div className="absolute bottom-[-8px] right-3 z-20 h-9 w-3 bg-amber-500 [clip-path:polygon(0_0,100%_0,100%_82%,50%_100%,0_82%)]" />
          <div className="absolute inset-x-0 top-0 z-10 h-[5.3rem] overflow-hidden rounded-[0.65rem] border border-white/10 bg-gradient-to-br from-primary via-primary/75 to-background shadow-xl">
            <div className="absolute inset-y-0 left-0 w-2 bg-black/25" />
            <div className="absolute inset-2 rounded-md border border-white/15" />
          </div>
        </div>
      </div>
    );
  }

  if (style === "realistic") {
    return (
      <div className="flex h-36 items-center justify-center border-b border-border/60 bg-background/35 px-4">
        <div className="relative h-20 w-28 [perspective:700px]">
          <div className="absolute left-1/2 top-1/2 h-14 w-24 -translate-x-1/2 -translate-y-1/2 [transform:rotateX(58deg)_rotateZ(-8deg)] rounded-md border border-white/10 bg-gradient-to-br from-primary/70 via-primary/45 to-background shadow-xl">
            <div className="absolute -bottom-2.5 left-1 right-1 h-2.5 rounded-b-sm bg-[#d8c7a2]/85" />
            <div className="absolute inset-y-1 left-0 w-2 rounded-l-sm bg-black/25" />
          </div>
        </div>
      </div>
    );
  }

  if (style === "showcase") {
    return (
      <div className="flex h-36 items-end justify-center gap-2 border-b border-border/60 bg-background/35 px-4 pb-5">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={cn(
              "w-11 rounded-sm border border-border/50 bg-gradient-to-br from-primary/70 to-background shadow-xl",
              item === 1 ? "h-24" : "h-20",
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid h-36 grid-cols-3 gap-2 border-b border-border/60 bg-background/35 p-5">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="rounded-md border border-border/60 bg-gradient-to-b from-primary/55 to-card shadow-sm"
        />
      ))}
    </div>
  );
}
