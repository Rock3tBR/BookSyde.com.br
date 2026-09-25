import { useCallback, useMemo, useSyncExternalStore } from "react";

export type ReaderPreferences = {
  fontSize: number;
  palette: "white" | "black" | "sepia" | "paper";
  readingMode: "paged" | "vertical";
};
export type PersonalLayout = { pageCount: number; pageIndex: number; updatedAt: number };
type Layouts = Record<string, PersonalLayout>;
const changed = "booksyde-reader-personalization";
const key = (kind: string, userId?: string) => `booksyde:reader:${userId ?? "guest"}:${kind}`;
function read(name: string) {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(name);
  } catch {
    return null;
  }
}
function write(name: string, value: unknown) {
  try {
    const text = JSON.stringify(value);
    if (read(name) === text) return;
    localStorage.setItem(name, text);
    window.dispatchEvent(new Event(changed));
  } catch {
    /* Reading still works with storage disabled. */
  }
}
function parse(text: string | null): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
export function getReaderPreferences(userId?: string): ReaderPreferences {
  const saved = parse(read(key("preferences", userId)));
  // Legacy anonymous preferences are never inherited by a different signed-in account.
  const font = Number(saved["fontSize"] ?? (!userId ? read("mangaka-reader-font") : null));
  const palette = saved["palette"] ?? (!userId ? read("mangaka-reader-palette") : null);
  const mode = saved["readingMode"] ?? (!userId ? read("mangaka-reading-mode") : null);
  return {
    fontSize: Number.isFinite(font) && font >= 14 && font <= 32 ? font : 20,
    palette: ["white", "black", "sepia", "paper"].includes(String(palette))
      ? (palette as ReaderPreferences["palette"])
      : "paper",
    readingMode: mode === "vertical" ? "vertical" : "paged",
  };
}
export function saveReaderPreferences(userId: string | undefined, prefs: ReaderPreferences) {
  write(key("preferences", userId), prefs);
}
function layouts(text: string | null): Layouts {
  return Object.fromEntries(
    Object.entries(parse(text)).filter(([, value]) => {
      const item = value as PersonalLayout | null;
      return (
        item &&
        Number.isSafeInteger(item.pageCount) &&
        item.pageCount > 0 &&
        Number.isSafeInteger(item.pageIndex) &&
        item.pageIndex >= 0 &&
        item.pageIndex < item.pageCount &&
        Number.isFinite(item.updatedAt)
      );
    }),
  ) as Layouts;
}
export function getPersonalLayouts(userId?: string) {
  return layouts(read(key("layouts", userId)));
}
export function savePersonalLayout(
  userId: string | undefined,
  volumeId: string,
  pageCount: number,
  pageIndex: number,
) {
  if (
    !Number.isSafeInteger(pageCount) ||
    pageCount < 1 ||
    !Number.isSafeInteger(pageIndex) ||
    pageIndex < 0 ||
    pageIndex >= pageCount
  )
    return;
  const saved = getPersonalLayouts(userId);
  if (saved[volumeId]?.pageCount === pageCount && saved[volumeId]?.pageIndex === pageIndex) return;
  write(key("layouts", userId), {
    ...saved,
    [volumeId]: { pageCount, pageIndex, updatedAt: Date.now() },
  });
}
const subscribe = (notify: () => void) => {
  window.addEventListener(changed, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(changed, notify);
    window.removeEventListener("storage", notify);
  };
};
export function usePersonalLayouts(userId?: string) {
  const snapshot = useCallback(() => read(key("layouts", userId)), [userId]);
  const stored = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => layouts(stored), [stored]);
}
export function personalPageCount(
  volume: { id: string; file_format: string; page_count: number },
  saved: Layouts,
) {
  return volume.file_format === "epub"
    ? (saved[volume.id]?.pageCount ?? volume.page_count)
    : volume.page_count;
}
