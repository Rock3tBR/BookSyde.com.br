import type { ComponentProps } from "react";
import { MangaCard } from "@/components/MangaCard";
import { CatalogDisplayCard } from "@/components/CatalogDisplayCard";
import { useCatalogDisplayPreferences } from "@/hooks/useCatalogDisplayPreferences";
import { getCatalogDisplayStyle } from "@/lib/catalogDisplay";

export function PreferredMangaCard({
  index = 0,
  ...props
}: ComponentProps<typeof MangaCard> & { index?: number }) {
  const preferences = useCatalogDisplayPreferences();
  const style = getCatalogDisplayStyle(preferences, props.manga.work_type);
  return (
    <div data-display-style={style} data-work-type={props.manga.work_type}>
      {style === "grid" ? (
        <MangaCard {...props} />
      ) : (
        <CatalogDisplayCard {...props} style={style} index={index} />
      )}
    </div>
  );
}
