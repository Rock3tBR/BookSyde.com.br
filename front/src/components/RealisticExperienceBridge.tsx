import { useEffect } from "react";
import { useCatalogDisplayPreferences } from "@/hooks/useCatalogDisplayPreferences";
import { isRealisticExperienceEnabled } from "@/lib/catalogDisplay";

export function RealisticExperienceBridge() {
  const preferences = useCatalogDisplayPreferences();
  const enabled = isRealisticExperienceEnabled(preferences);
  useEffect(() => {
    document.documentElement.dataset["realisticExperience"] = String(enabled);
    document.body.dataset["realisticExperience"] = String(enabled);
    return () => {
      delete document.documentElement.dataset["realisticExperience"];
      delete document.body.dataset["realisticExperience"];
    };
  }, [enabled]);
  return null;
}
