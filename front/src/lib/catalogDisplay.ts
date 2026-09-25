import type { WorkType } from "@/lib/publication";

export type CatalogDisplayStyle = "grid" | "book" | "showcase" | "realistic";

export type CatalogDisplayPreferences = Record<WorkType, CatalogDisplayStyle>;

export const CATALOG_DISPLAY_OPTIONS: { value: CatalogDisplayStyle; label: string }[] = [
  { value: "grid", label: "Padrão" },
  { value: "book", label: "Livro" },
  { value: "realistic", label: "Realista" },
];

const STORAGE_KEY = "mangaka:catalog-display";
export const CATALOG_DISPLAY_EVENT = "mangaka:catalog-display-change";

const DEFAULT_PREFERENCES: CatalogDisplayPreferences = {
  manga: "grid",
  hq: "grid",
  gibi: "grid",
  book: "grid",
};

function normalizeStyle(value: unknown): CatalogDisplayStyle | null {
  if (value === "showcase") return "grid";
  return value === "grid" || value === "book" || value === "realistic" ? value : null;
}

type ProfileLike =
  | {
      manga_display_style?: string | null;
      hq_display_style?: string | null;
      gibi_display_style?: string | null;
      book_display_style?: string | null;
    }
  | null
  | undefined;

function readStored(): Partial<CatalogDisplayPreferences> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Partial<CatalogDisplayPreferences> = {};

    for (const key of ["manga", "hq", "gibi", "book"] as WorkType[]) {
      const style = normalizeStyle(parsed[key]);
      if (style) result[key] = style;
    }

    return result;
  } catch {
    return {};
  }
}

export function getCatalogDisplayPreferences(
  profile?: ProfileLike,
  preferStored = false,
): CatalogDisplayPreferences {
  const stored = readStored();

  return {
    manga:
      (preferStored ? stored.manga : null) ??
      normalizeStyle(profile?.manga_display_style) ??
      stored.manga ??
      DEFAULT_PREFERENCES.manga,
    hq:
      (preferStored ? stored.hq : null) ??
      normalizeStyle(profile?.hq_display_style) ??
      stored.hq ??
      DEFAULT_PREFERENCES.hq,
    gibi:
      (preferStored ? stored.gibi : null) ??
      normalizeStyle(profile?.gibi_display_style) ??
      stored.gibi ??
      DEFAULT_PREFERENCES.gibi,
    book:
      (preferStored ? stored.book : null) ??
      normalizeStyle(profile?.book_display_style) ??
      stored.book ??
      DEFAULT_PREFERENCES.book,
  };
}

export function saveCatalogDisplayPreferences(preferences: CatalogDisplayPreferences) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent(CATALOG_DISPLAY_EVENT, { detail: preferences }));
  } catch {
    // Falhas de localStorage não devem impedir o restante da interface.
  }
}

function mobileCatalogFallback(style: CatalogDisplayStyle): CatalogDisplayStyle {
  if (style !== "realistic" || typeof window === "undefined") return style;
  return window.matchMedia("(max-width: 767px)").matches ? "book" : style;
}

export function isRealisticExperienceEnabled(preferences: CatalogDisplayPreferences) {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) return false;
  return Object.values(preferences).some((style) => style === "realistic");
}

export function getCatalogDisplayStyle(
  preferences: CatalogDisplayPreferences,
  workType?: WorkType | string | null,
): CatalogDisplayStyle {
  if (workType === "manga" || workType === "hq" || workType === "gibi" || workType === "book") {
    return mobileCatalogFallback(preferences[workType]);
  }

  return mobileCatalogFallback(preferences.manga);
}
