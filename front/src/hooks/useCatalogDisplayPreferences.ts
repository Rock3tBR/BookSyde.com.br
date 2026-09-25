import { useMemo, useSyncExternalStore } from "react";
import { useProfile } from "@/lib/auth";
import { CATALOG_DISPLAY_EVENT, getCatalogDisplayPreferences } from "@/lib/catalogDisplay";

function subscribe(onChange: () => void) {
  window.addEventListener(CATALOG_DISPLAY_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CATALOG_DISPLAY_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const snapshot = () => JSON.stringify(getCatalogDisplayPreferences());
const serverSnapshot = () => "";

/** PreferencesSync hydrates storage on sign-in. Local selections then
 * take effect immediately, including in newly mounted cards and other tabs. */
export function useCatalogDisplayPreferences() {
  const { data: profile } = useProfile();
  const stored = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo(() => getCatalogDisplayPreferences(profile, stored !== ""), [profile, stored]);
}
