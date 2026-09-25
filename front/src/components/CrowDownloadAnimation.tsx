import { BooksydeMascot } from "@/components/BooksydeMascot";

type CrowAnimationState = "initializing" | "downloading" | "processing" | "almost" | "complete" | "error";

export function CrowDownloadAnimation({ state }: { state: CrowAnimationState }) {
  // Do not remount/change the clip when progress updates: the crow finishes
  // its movement naturally while the surrounding text reports the real state.
  return (
    <div className="booksyde-crow-stage shrink-0" data-download-state={state} aria-hidden="true">
      <BooksydeMascot />
    </div>
  );
}
