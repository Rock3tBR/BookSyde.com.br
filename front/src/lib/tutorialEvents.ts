export type TutorialChapter = "all" | "home" | "library" | "marketplace" | "map" | "studio" | "seller" | "reader";

export function startSystemTutorial(chapter: TutorialChapter = "all") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mangaka:start-tutorial", { detail: { chapter } }));
}
