import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { RealisticBookModel } from "@/components/RealisticBookModel";
import { StorageCoverImage } from "@/components/StorageCoverImage";
import { useCatalogDisplayPreferences } from "@/hooks/useCatalogDisplayPreferences";
import { getCatalogDisplayStyle } from "@/lib/catalogDisplay";
import { resolveCoverUrl } from "@/lib/media";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  coverUrl: string | null | undefined;
  title: string;
  workType: string | null | undefined;
  fallbackPagePath?: string | null | undefined;
  fallbackCoverUrl?: string | null | undefined;
  fit?: "cover" | "contain";
  className?: string;
  fallback?: ReactNode;
  loading?: "eager" | "lazy";
};

/** A publication thumbnail, without links/actions, for collections, shelves,
 * marketplace listings and compact rows. Never used inside a 3D model itself. */
export function PublicationCover({
  coverUrl,
  title,
  workType,
  fallbackPagePath,
  fallbackCoverUrl,
  fit = "cover",
  className,
  fallback,
  loading = "lazy",
}: Props) {
  const preferences = useCatalogDisplayPreferences();
  const style = getCatalogDisplayStyle(preferences, workType);
  const { data: resolvedCover } = useQuery({
    queryKey: ["cover", coverUrl, fallbackPagePath, fallbackCoverUrl],
    networkMode: "always",
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      if (coverUrl) return resolveCoverUrl(coverUrl);
      if (fallbackPagePath) {
        const { data } = await supabase.storage
          .from("manga-pages")
          .createSignedUrl(fallbackPagePath, 3600);
        if (data?.signedUrl) return data.signedUrl;
      }
      return resolveCoverUrl(fallbackCoverUrl ?? null);
    },
  });
  return (
    <div
      className={cn(
        "publication-cover relative w-full",
        style === "realistic" ? "aspect-[7/8]" : "aspect-[7/10]",
        className,
      )}
      data-display-style={style}
      data-work-type={workType}
    >
      {style === "realistic" ? (
        <RealisticBookModel
          coverUrl={resolvedCover}
          title={title}
          className="absolute inset-0 size-full"
        />
      ) : (
        <div className="publication-cover-print absolute inset-0">
          <StorageCoverImage
            coverUrl={resolvedCover}
            alt={`Capa de ${title}`}
            loading={loading}
            className={cn(
              "size-full rounded-[inherit]",
              fit === "contain" ? "object-contain" : "object-cover",
            )}
            fallback={
              fallback ?? (
                <div className="grid size-full place-items-center bg-secondary/60 p-2 text-center text-xs text-muted-foreground">
                  {title}
                </div>
              )
            }
          />
        </div>
      )}
    </div>
  );
}
