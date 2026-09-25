import { useEffect, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from "react";

import { StorageCoverImage } from "@/components/StorageCoverImage";
import { cn } from "@/lib/utils";

export type ClosedBook3DProps = {
  coverUrl: string | null | undefined;
  title: string;
  className?: string;
  fallback?: ReactNode;
};

type BookPose = "lying" | "standing";

/**
 * A single solid book, with all six faces attached to the same 3D coordinate
 * system. Both poses use identical geometry: no duplicate images or detached
 * page blocks during hover. The cover image always takes precedence over
 * color detection (external images often don't grant canvas/CORS access).
 */
export function ClosedBook3D({
  coverUrl,
  title,
  className,
  fallback,
  pose,
}: ClosedBook3DProps & { pose: BookPose }) {
  const [coverTone, setCoverTone] = useState("#272222");

  useEffect(() => {
    setCoverTone("#272222");
  }, [coverUrl]);

  const handleCoverLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const tone = getCoverBackgroundTone(event.currentTarget);
    if (tone) setCoverTone(tone);
  };

  return (
    <div
      className={cn("closed-book-3d relative isolate aspect-[7/8] w-full select-none", className)}
      role="img"
      aria-label={`Modelo 3D ${pose === "lying" ? "deitado" : "em pé"} de ${title}`}
    >
      <div className="closed-book-3d__shadow pointer-events-none absolute" aria-hidden="true" />

      <div
        className={cn(
          "closed-book-3d__body absolute left-1/2 top-1/2",
          pose === "lying" ? "book-3d-body" : "book-3d-standing-body",
        )}
        style={{ "--book-cover-tone": coverTone } as CSSProperties}
        aria-hidden="true"
      >
        {/* All faces share z=0 (front) and z=-thickness (back). */}
        <div className="closed-book-3d__back absolute" />
        <div className="closed-book-3d__pages closed-book-3d__pages--top absolute" />
        <div className="closed-book-3d__pages closed-book-3d__pages--bottom absolute" />
        <div className="closed-book-3d__pages closed-book-3d__pages--fore-edge absolute" />
        <div className="closed-book-3d__spine absolute" />

        <div className="closed-book-3d__front absolute">
          <StorageCoverImage
            coverUrl={coverUrl}
            alt={`Capa de ${title}`}
            draggable={false}
            onLoad={handleCoverLoad}
            className="absolute inset-0 size-full object-cover"
            fallback={
              fallback ?? (
                <div className="grid size-full place-items-center bg-neutral-900 px-2 text-center text-xs font-semibold text-neutral-200">
                  {title}
                </div>
              )
            }
          />
          <div className="closed-book-3d__cover-finish pointer-events-none absolute inset-0" />
          <div className="book-cover-gloss pointer-events-none absolute -inset-y-1/4 -left-1/2 w-[46%] rotate-[16deg] bg-gradient-to-r from-transparent via-white/14 to-transparent blur-[1px]" />
        </div>
      </div>
    </div>
  );
}

/** Edge sampling is optional. A cover without CORS still displays normally. */
function getCoverBackgroundTone(image: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 36;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Map<string, { weight: number; r: number; g: number; b: number }>();

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4;
        if ((data[i + 3] ?? 0) < 180) continue;
        const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
        const weight = x < 4 || x >= canvas.width - 4 || y < 4 || y >= canvas.height - 4 ? 3 : 1;
        const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`;
        const bucket = colors.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
        bucket.weight += weight;
        bucket.r += r * weight;
        bucket.g += g * weight;
        bucket.b += b * weight;
        colors.set(key, bucket);
      }
    }

    const dominant = [...colors.values()].sort((a, b) => b.weight - a.weight)[0];
    if (!dominant) return null;
    const channel = (sum: number) => Math.round(Math.max(20, Math.min(215, (sum / dominant.weight) * 0.78)));
    return `rgb(${channel(dominant.r)} ${channel(dominant.g)} ${channel(dominant.b)})`;
  } catch {
    // Cross-origin cover: keep the visible artwork and a neutral spine.
    return null;
  }
}
