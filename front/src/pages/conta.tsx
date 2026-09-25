import { Route } from "@/routes/conta";
import { useEffect, useState } from "react";
import { CatalogDisplayPreference, WorkspaceHeading, SettingsBlock, ChoiceGrid, SummaryRow, ReaderChoice, PreferenceSwitch } from "@/components/AccountSettingsControls";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  BookOpen,
  Download,
  Eye,
  Gauge,
  GalleryHorizontalEnd,
  LayoutGrid,
  Layers,
  MessageSquareOff,
  Palette,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoredContinueReadingPreview,
  useAuth,
  useProfile,
  type ContinueReadingPreview,
} from "@/lib/auth";
import {
  getCatalogDisplayPreferences,
  saveCatalogDisplayPreferences,
  type CatalogDisplayPreferences,
  type CatalogDisplayStyle,
} from "@/lib/catalogDisplay";
import { WORK_TYPES, type WorkType } from "@/lib/publication";
import { getVisibleWorkTypes, saveVisibleWorkTypes } from "@/lib/contentPreferences";
import { applySiteTheme, normalizeSiteTheme, THEME_OPTIONS, type SiteTheme } from "@/lib/theme";
import { ThemePicker } from "@/components/ThemePicker";

export function AccountPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<"manga" | "book">("manga");
  const [readingMode, setReadingMode] = useState<"paged" | "vertical">("paged");
  const [pageTransition, setPageTransition] = useState<"page_turn" | "instant">("page_turn");
  const [theme, setTheme] = useState<SiteTheme>("light");
  const [brightness, setBrightness] = useState(100);
  const [readerBackground, setReaderBackground] = useState<"black" | "gray" | "sepia">("black");
  const [turnSpeed, setTurnSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [progressStyle, setProgressStyle] = useState<"hidden" | "minimal" | "full">("full");
  const [continuePreview, setContinuePreview] = useState<ContinueReadingPreview>("cover");
  const [catalogDisplay, setCatalogDisplay] = useState<CatalogDisplayPreferences>(() =>
    getCatalogDisplayPreferences(),
  );
  const [visibleWorkTypes, setVisibleWorkTypes] = useState<WorkType[]>(() => getVisibleWorkTypes());
  const [hideComments, setHideComments] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const [autoNextVolume, setAutoNextVolume] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tab === "profile" || tab === "security") {
      void navigate({ to: "/meu-perfil", replace: true });
    }
  }, [tab, navigate]);

  useEffect(() => {
    if (!profile) return;
    setDirection(profile.reading_direction === "book" ? "book" : "manga");
    setPageTransition(profile.page_transition === "instant" ? "instant" : "page_turn");
    setTheme(normalizeSiteTheme(profile.theme));
    setBrightness(profile.reader_brightness ?? 100);
    setReaderBackground(
      profile.reader_background === "gray" || profile.reader_background === "sepia"
        ? profile.reader_background
        : "black",
    );
    setTurnSpeed(
      profile.page_turn_speed === "slow" || profile.page_turn_speed === "fast"
        ? profile.page_turn_speed
        : "normal",
    );
    setProgressStyle(
      profile.progress_style === "hidden" || profile.progress_style === "minimal"
        ? profile.progress_style
        : "full",
    );
    setHideComments(profile.hide_reader_comments ?? false);
    setDataSaver(profile.data_saver ?? false);
    setAutoNextVolume(profile.auto_next_volume ?? true);
    setContinuePreview(
      (profile as Record<string, unknown>)?.["continue_reading_preview"] === "page"
        ? "page"
        : getStoredContinueReadingPreview(),
    );
    setCatalogDisplay(getCatalogDisplayPreferences(profile));
    setVisibleWorkTypes(getVisibleWorkTypes(profile));
  }, [profile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const localValue = getStoredContinueReadingPreview();
    setContinuePreview(localValue);
    setReadingMode(
      localStorage.getItem("mangaka-reading-mode") === "vertical" ? "vertical" : "paged",
    );
  }, []);

  if (tab === "profile" || tab === "security") return null;

  if (loading || isLoading) {
    return <main className="mx-auto max-w-4xl px-4 py-16 text-muted-foreground">Carregando…</main>;
  }
  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Entre para acessar sua conta</h1>
        <Button className="mt-6" asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </main>
    );
  }

  function updateCatalogDisplayStyle(_workType: WorkType, style: CatalogDisplayStyle) {
    const next = { manga: style, hq: style, gibi: style, book: style };
    setCatalogDisplay(next);
    // Notify mounted covers outside the React state updater/render phase.
    // The Save button remains responsible for persisting to the profile.
    saveCatalogDisplayPreferences(next);
  }

  function toggleVisibleWorkType(workType: WorkType) {
    setVisibleWorkTypes((current) => {
      if (current.includes(workType)) {
        if (current.length === 1) {
          toast.error("Selecione pelo menos um tipo de conteúdo.");
          return current;
        }
        return current.filter((item) => item !== workType);
      }
      return [...current, workType];
    });
  }

  async function savePreferences() {
    setBusy(true);
    localStorage.setItem("mangaka-reading-direction", direction);
    localStorage.setItem("mangaka-reading-mode", readingMode);
    localStorage.setItem("mangaka-page-transition", pageTransition);
    localStorage.setItem("mangaka-show-progress", String(progressStyle !== "hidden"));
    localStorage.setItem("mangaka-theme", theme);
    localStorage.setItem("mangaka-reader-brightness", String(brightness));
    localStorage.setItem("mangaka-reader-background", readerBackground);
    localStorage.setItem("mangaka-page-turn-speed", turnSpeed);
    localStorage.setItem("mangaka-progress-style", progressStyle);
    localStorage.setItem("mangaka-hide-reader-comments", String(hideComments));
    localStorage.setItem("mangaka-data-saver", String(dataSaver));
    localStorage.setItem("mangaka-auto-next-volume", String(autoNextVolume));
    localStorage.setItem("mangaka-continue-preview", continuePreview);
    saveCatalogDisplayPreferences(catalogDisplay);
    saveVisibleWorkTypes(visibleWorkTypes);
    applySiteTheme(theme);

    const payload = {
      id: user!.id,
      reading_direction: direction,
      page_transition: pageTransition,
      show_progress: progressStyle !== "hidden",
      theme,
      reader_brightness: brightness,
      reader_background: readerBackground,
      page_turn_speed: turnSpeed,
      progress_style: progressStyle,
      hide_reader_comments: hideComments,
      data_saver: dataSaver,
      auto_next_volume: autoNextVolume,
      continue_reading_preview: continuePreview,
      manga_display_style: catalogDisplay.manga,
      hq_display_style: catalogDisplay.hq,
      gibi_display_style: catalogDisplay.gibi,
      book_display_style: catalogDisplay.book,
      visible_work_types: visibleWorkTypes,
    };

    // Preferências não podem sobrescrever o apelido atualizado em Meu perfil.
    const { id: _profileId, ...preferences } = payload;
    const { error } = profile
      ? await supabase.from("profiles").update(preferences).eq("id", user!.id)
      : await supabase.from("profiles").upsert({ ...payload, display_name: "Leitor" });
    if (error) {
      const isPendingMigration = [
        "reader_brightness",
        "reader_background",
        "page_turn_speed",
        "progress_style",
        "hide_reader_comments",
        "data_saver",
        "auto_next_volume",
        "continue_reading_preview",
        "manga_display_style",
        "hq_display_style",
        "gibi_display_style",
        "book_display_style",
        "visible_work_types",
      ].some((column) => error.message.includes(column));
      if (!isPendingMigration) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
      const legacyPreferences = {
        reading_direction: direction,
        page_transition: pageTransition,
        show_progress: progressStyle !== "hidden",
        theme,
      };
      const { error: legacyError } = profile
        ? await supabase.from("profiles").update(legacyPreferences).eq("id", user!.id)
        : await supabase.from("profiles").upsert({
            id: user!.id,
            display_name: "Leitor",
            ...legacyPreferences,
          });
      setBusy(false);
      if (legacyError) {
        toast.error(legacyError.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
      toast.success("Preferências salvas neste dispositivo");
      return;
    }
    setBusy(false);
    await queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
    toast.success("Preferências salvas");
  }

  const selectedTheme = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
  const selectedTypeLabels = WORK_TYPES.filter((item) => visibleWorkTypes.includes(item.value)).map(
    (item) => item.label,
  );

  return (
    <main className="mx-auto w-full px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-6 lg:px-7 xl:px-9">
      <Tabs
        value={tab === "catalog" ? "catalog" : "reading"}
        onValueChange={(value) =>
          void navigate({
            to: "/conta",
            search: { tab: value as "reading" | "catalog" },
            replace: true,
          })
        }
        className="grid min-w-0 items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:gap-5"
      >
        <aside className="rounded-[1.45rem] border border-border/70 bg-card/65 p-3 lg:sticky lg:top-[calc(6.5rem+env(safe-area-inset-top))]">
          <div className="px-2 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">Seu visual</p>
            <h1 className="mt-1 font-display text-xl">Personalização</h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Preferências de leitura e exibição.</p>
          </div>
          <TabsList className="mt-4 grid h-auto w-full grid-cols-1 gap-1 bg-transparent p-0">
            <TabsTrigger value="reading" className="min-h-11 justify-start gap-3 rounded-xl px-3 text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-foreground">
              <BookOpen className="size-4" /> Leitura
            </TabsTrigger>
            <TabsTrigger value="catalog" className="min-h-11 justify-start gap-3 rounded-xl px-3 text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-foreground">
              <LayoutGrid className="size-4" /> Catálogo e aparência
            </TabsTrigger>
          </TabsList>
        </aside>
        <div className="min-w-0">
        <TabsContent value="reading" className="mt-0">
          <section className="ink-panel rounded-[1.45rem] p-3 sm:p-5">
            <WorkspaceHeading
              icon={<BookOpen />}
              eyebrow="Leitor"
              title="Experiência de leitura"
              description="Configure navegação, aparência e comportamento do leitor em um só lugar."
            />

            <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="space-y-5">
                <SettingsBlock
                  number="1"
                  title="Navegação"
                  description="Defina como as páginas se comportam durante a leitura."
                >
                  <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <strong className="text-sm">Direção automática por tipo de obra</strong>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Mangás usam direita para esquerda. HQs, gibis e livros usam esquerda para direita.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <ChoiceGrid
                      title="Modo de leitura padrão"
                      icon={<BookOpen className="size-4" />}
                      value={readingMode}
                      options={[
                        {
                          value: "paged",
                          label: "Páginas",
                          description: "Troca horizontal com gesto lateral.",
                        },
                        {
                          value: "vertical",
                          label: "Scroll vertical",
                          description: "Leitura contínua de cima para baixo.",
                        },
                      ]}
                      onChange={(value) => setReadingMode(value as typeof readingMode)}
                    />

                    <ChoiceGrid
                      title="Troca de página"
                      icon={<Layers className="size-4" />}
                      value={pageTransition}
                      options={[
                        {
                          value: "page_turn",
                          label: "Virada de página",
                          description: "Animação suave inspirada em leitores digitais.",
                        },
                        {
                          value: "instant",
                          label: "Instantâneo",
                          description: "Troca imediatamente, sem animação.",
                        },
                      ]}
                      onChange={(value) => setPageTransition(value as typeof pageTransition)}
                    />
                  </div>
                </SettingsBlock>

                <SettingsBlock
                  number="2"
                  title="Aparência do leitor"
                  description="Ajuste o visual das páginas para deixar a leitura mais confortável."
                >
                  <div className="space-y-5">
                    <div className="space-y-3 rounded-xl border border-border/70 bg-card/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">Brilho do leitor</p>
                          <p className="text-xs text-muted-foreground">
                            Ajusta somente as páginas, sem alterar o aparelho.
                          </p>
                        </div>
                        <span className="text-sm tabular-nums">{brightness}%</span>
                      </div>
                      <input
                        aria-label="Brilho do leitor"
                        className="w-full accent-[var(--primary)]"
                        type="range"
                        min="40"
                        max="120"
                        step="5"
                        value={brightness}
                        onChange={(event) => setBrightness(Number(event.target.value))}
                      />
                    </div>

                    <ReaderChoice
                      title="Fundo do leitor"
                      icon={<Palette className="size-4" />}
                      value={readerBackground}
                      options={[
                        { value: "black", label: "Preto" },
                        { value: "gray", label: "Cinza" },
                        { value: "sepia", label: "Sépia" },
                      ]}
                      onChange={(value) => setReaderBackground(value as typeof readerBackground)}
                    />

                    <ReaderChoice
                      title="Velocidade da virada"
                      icon={<Gauge className="size-4" />}
                      value={turnSpeed}
                      options={[
                        { value: "slow", label: "Suave" },
                        { value: "normal", label: "Normal" },
                        { value: "fast", label: "Rápida" },
                      ]}
                      onChange={(value) => setTurnSpeed(value as typeof turnSpeed)}
                    />

                    <ReaderChoice
                      title="Indicador de progresso"
                      icon={<Eye className="size-4" />}
                      value={progressStyle}
                      options={[
                        { value: "hidden", label: "Oculto" },
                        { value: "minimal", label: "Mínimo" },
                        { value: "full", label: "Completo" },
                      ]}
                      onChange={(value) => setProgressStyle(value as typeof progressStyle)}
                    />
                  </div>
                </SettingsBlock>

                <SettingsBlock
                  number="3"
                  title="Comportamento"
                  description="Escolha o que o BookSyde faz automaticamente durante a leitura."
                >
                  <div className="space-y-5">
                    <ReaderChoice
                      title='Prévia em "Continuar lendo"'
                      icon={<Bookmark className="size-4" />}
                      value={continuePreview}
                      columns={2}
                      options={[
                        { value: "cover", label: "Mostrar capa" },
                        { value: "page", label: "Página atual" },
                      ]}
                      onChange={(value) => setContinuePreview(value as ContinueReadingPreview)}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <PreferenceSwitch
                        icon={<Zap />}
                        title="Próximo volume automático"
                        text="Ao avançar na última página, abre o próximo volume."
                        checked={autoNextVolume}
                        onChange={setAutoNextVolume}
                      />
                      <PreferenceSwitch
                        icon={<MessageSquareOff />}
                        title="Ocultar comentários"
                        text="Remove comentários dos controles durante a leitura."
                        checked={hideComments}
                        onChange={setHideComments}
                      />
                      <PreferenceSwitch
                        icon={<Download />}
                        title="Economia de dados"
                        text="Reduz o pré-carregamento de páginas e o uso da rede."
                        checked={dataSaver}
                        onChange={setDataSaver}
                      />
                    </div>
                  </div>
                </SettingsBlock>



                <div className="flex justify-end">
                  <Button disabled={busy} onClick={savePreferences} className="w-full sm:w-auto">
                    {busy ? "Salvando…" : "Salvar preferências"}
                  </Button>
                </div>
              </div>

              <aside className="xl:sticky xl:top-24 xl:self-start">
                <div className="rounded-[1.6rem] border border-border/70 bg-background/55 p-5 shadow-[0_20px_55px_-34px_rgba(0,0,0,0.95)]">
                  <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    <Sparkles className="size-4" /> Sua configuração
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/45">
                    <div
                      className="flex aspect-[4/3] items-center justify-center p-5"
                      style={{ filter: `brightness(${Math.min(Math.max(brightness, 40), 120)}%)` }}
                    >
                      <div
                        className={`relative aspect-[7/10] w-24 overflow-hidden rounded-lg border shadow-2xl ${
                          readerBackground === "sepia"
                            ? "border-amber-900/20 bg-[#e9dcc1]"
                            : readerBackground === "gray"
                              ? "border-zinc-600 bg-zinc-700"
                              : "border-zinc-800 bg-zinc-950"
                        }`}
                      >
                        <div className="absolute inset-x-4 top-5 space-y-2 opacity-40">
                          {[0, 1, 2, 3, 4, 5, 6].map((line) => (
                            <span key={line} className="block h-1 rounded-full bg-current" />
                          ))}
                        </div>
                        {progressStyle !== "hidden" ? (
                          <span className="absolute inset-x-3 bottom-3 h-1 overflow-hidden rounded-full bg-white/10">
                            <span className="block h-full w-[62%] rounded-full bg-primary" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="border-t border-border/60 p-4">
                      <p className="font-semibold">{selectedTheme?.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {readingMode === "paged" ? "Páginas" : "Scroll vertical"} · {pageTransition === "page_turn" ? "Virada animada" : "Troca instantânea"}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-3 text-sm">
                    <SummaryRow label="Fundo" value={readerBackground === "black" ? "Preto" : readerBackground === "gray" ? "Cinza" : "Sépia"} />
                    <SummaryRow label="Velocidade" value={turnSpeed === "slow" ? "Suave" : turnSpeed === "fast" ? "Rápida" : "Normal"} />
                    <SummaryRow label="Progresso" value={progressStyle === "hidden" ? "Oculto" : progressStyle === "minimal" ? "Mínimo" : "Completo"} />
                  </dl>
                </div>
              </aside>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="catalog" className="mt-0">
          <section className="ink-panel rounded-[1.45rem] p-3 sm:p-5">
            <WorkspaceHeading
              icon={<LayoutGrid />}
              eyebrow="Biblioteca"
              title="Exibição do catálogo"
              description="Escolha o que aparece no BookSyde e como cada tipo de obra é apresentado."
            />

            <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="space-y-5">
                <SettingsBlock
                  number="1"
                  title="Cor do sistema"
                  description="Escolha a paleta do BookSyde. A mudança é aplicada imediatamente."
                >
                  <ThemePicker
                    value={theme}
                    onChange={(nextTheme) => {
                      setTheme(nextTheme);
                      applySiteTheme(nextTheme);
                    }}
                  />
                </SettingsBlock>

                <SettingsBlock
                  number="2"
                  title="Conteúdo visível"
                  description="Defina quais tipos de obra aparecem na Home, nos filtros e no menu principal."
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {WORK_TYPES.map((item) => {
                      const selected = visibleWorkTypes.includes(item.value);
                      return (
                        <button
                          key={item.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleVisibleWorkType(item.value)}
                          className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border/70 bg-card/35 text-muted-foreground hover:border-primary/35 hover:bg-muted/45"
                          }`}
                        >
                          <span>{item.label}</span>
                          <span
                            className={`grid size-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Pelo menos um tipo de conteúdo precisa permanecer selecionado.
                  </p>
                </SettingsBlock>

                <SettingsBlock
                  number="3"
                  title="Estilo do catálogo"
                  description="Escolha uma aparência única para todo o catálogo. A opção selecionada será usada em mangás, HQs, gibis e livros."
                >
                  <CatalogDisplayPreference
                    workType="book"
                    label="Visual de todas as obras"
                    value={catalogDisplay.book}
                    onChange={(style) => updateCatalogDisplayStyle("book", style)}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Aplicado a:</span> Mangás · HQs · Gibis · Livros
                  </div>
                </SettingsBlock>

                <div className="flex justify-end">
                  <Button disabled={busy} onClick={savePreferences} className="w-full sm:w-auto">
                    {busy ? "Salvando…" : "Salvar exibição"}
                  </Button>
                </div>
              </div>

              <aside className="xl:sticky xl:top-24 xl:self-start">
                <div className="rounded-[1.6rem] border border-border/70 bg-background/55 p-5 shadow-[0_20px_55px_-34px_rgba(0,0,0,0.95)]">
                  <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    <Eye className="size-4" /> Resumo do catálogo
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card/45 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Você verá</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedTypeLabels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-border/60 bg-card/30 px-3 py-3">
                    <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Estilo de todas as obras</span><span className="text-xs font-semibold text-primary">{catalogDisplay.book === "grid" ? "Padrão" : catalogDisplay.book === "book" ? "Livro" : "Realista"}</span></div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Mangás, HQs, gibis e livros usam a mesma apresentação.</p>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </TabsContent>

        </div>
      </Tabs>
    </main>
  );
}
