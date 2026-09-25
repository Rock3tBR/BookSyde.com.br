import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

import { useSystemAccess } from "@/hooks/useSystemAccess";
import { supabase } from "@/integrations/supabase/client";
import { applySiteTheme, normalizeSiteTheme } from "@/lib/theme";
import { getCatalogDisplayPreferences, saveCatalogDisplayPreferences } from "@/lib/catalogDisplay";
import { getVisibleWorkTypes, saveVisibleWorkTypes } from "@/lib/contentPreferences";
import { resolveAccessRole } from "@/lib/access";

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export type ContinueReadingPreview = "cover" | "page";

const AuthContext = createContext<AuthValue>({ session: null, user: null, loading: true });

export function getStoredContinueReadingPreview(): ContinueReadingPreview {
  if (typeof window === "undefined") return "cover";
  return localStorage.getItem("mangaka-continue-preview") === "page" ? "page" : "cover";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useSystemAccess(session?.user.id);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: got }) => {
      setSession(got.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return localStorage.getItem("mangaka-is-admin") === "true";
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      const value = !!data;
      localStorage.setItem("mangaka-is-admin", String(value));
      return value;
    },
  });
}

export function useIsCreator() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-creator", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "creator")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

/**
 * Papel "Editora": contas de parceiros autorizados a publicar diretamente
 * no Catálogo, sem passar pelo Marketplace. Veja o formulário de criação em
 * /studio (admin.tsx) para as regras aplicadas a este papel.
 */
export function useIsEditora() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-editora", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "editora")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

/**
 * Um vendedor é um criador que já iniciou a ativação de vendas e possui
 * registro próprio em marketplace_sellers. Isso mantém "Criador" e
 * "Vendedor" como níveis diferentes sem exigir um novo valor no enum app_role.
 */
export function useIsSeller() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-seller", user?.id],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_sellers")
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useAccessRole() {
  const { user, loading } = useAuth();
  const admin = useIsAdmin();
  const editora = useIsEditora();
  const seller = useIsSeller();
  const creator = useIsCreator();

  const isLoading =
    loading ||
    (!!user && (admin.isLoading || editora.isLoading || seller.isLoading || creator.isLoading));

  return {
    role: user
      ? resolveAccessRole({
          isAdmin: admin.data,
          isEditora: editora.data,
          isSeller: seller.data,
          isCreator: creator.data,
        })
      : null,
    isLoading,
    isAdmin: !!admin.data,
    isEditora: !!editora.data,
    isSeller: !!seller.data,
    isCreator: !!creator.data,
  };
}

export function usePlus() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: ["plus-entitlement", user?.id, isAdmin],
    enabled: !!user && isAdmin !== undefined,
    queryFn: async () => {
      if (isAdmin) return true;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return localStorage.getItem("mangaka-is-plus") === "true";
      }
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user!.id)
        .in("status", ["active", "trialing"]);
      if (error) {
        if (error.message.includes("subscriptions")) return false;
        throw error;
      }
      const now = Date.now();
      const value = (data ?? []).some(
        (subscription) =>
          !subscription.current_period_end ||
          new Date(subscription.current_period_end).getTime() > now,
      );
      localStorage.setItem("mangaka-is-plus", String(value));
      return value;
    },
  });
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return null;
      const fullProfile = await supabase
        .from("profiles")
        .select(
          "id, display_name, avatar_url, reading_direction, page_transition, reader_onboarding_completed, site_onboarding_completed, visible_work_types, show_progress, theme, reader_brightness, reader_background, page_turn_speed, progress_style, hide_reader_comments, data_saver, auto_next_volume, continue_reading_preview, manga_display_style, hq_display_style, gibi_display_style, book_display_style",
        )
        .eq("id", user!.id)
        .maybeSingle();
      if (!fullProfile.error) return fullProfile.data;
      const missingPreferenceColumn = [
        "avatar_url",
        "reading_direction",
        "page_transition",
        "reader_onboarding_completed",
        "site_onboarding_completed",
        "visible_work_types",
        "show_progress",
        "theme",
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
      ].some((column) => fullProfile.error.message.includes(column));
      if (!missingPreferenceColumn) throw fullProfile.error;
      const fallback = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      const catalogDisplay = getCatalogDisplayPreferences();
      return fallback.data
        ? {
            ...fallback.data,
            avatar_url: null,
            reading_direction: "manga",
            page_transition: "page_turn",
            reader_onboarding_completed: false,
            site_onboarding_completed: false,
            visible_work_types: getVisibleWorkTypes(),
            show_progress: true,
            theme: "light",
            reader_brightness: 100,
            reader_background: "black",
            page_turn_speed: "normal",
            progress_style: "full",
            hide_reader_comments: false,
            data_saver: false,
            auto_next_volume: true,
            continue_reading_preview: getStoredContinueReadingPreview(),
            manga_display_style: catalogDisplay.manga,
            hq_display_style: catalogDisplay.hq,
            gibi_display_style: catalogDisplay.gibi,
            book_display_style: catalogDisplay.book,
          }
        : null;
    },
  });
}

export function PreferencesSync() {
  const { data: profile } = useProfile();

  useEffect(() => {
    applySiteTheme(normalizeSiteTheme(localStorage.getItem("mangaka-theme")));
  }, []);

  useEffect(() => {
    if (!profile) return;
    const direction = profile.reading_direction === "book" ? "book" : "manga";
    const theme = normalizeSiteTheme(profile.theme);
    const preview =
      (profile as Record<string, unknown>)["continue_reading_preview"] === "page"
        ? "page"
        : "cover";
    localStorage.setItem("mangaka-reading-direction", direction);
    localStorage.setItem(
      "mangaka-page-transition",
      profile.page_transition === "instant" ? "instant" : "page_turn",
    );
    localStorage.setItem("mangaka-show-progress", String(profile.show_progress));
    localStorage.setItem("mangaka-reader-brightness", String(profile.reader_brightness));
    localStorage.setItem("mangaka-reader-background", profile.reader_background);
    localStorage.setItem("mangaka-page-turn-speed", profile.page_turn_speed);
    localStorage.setItem("mangaka-progress-style", profile.progress_style);
    localStorage.setItem("mangaka-hide-reader-comments", String(profile.hide_reader_comments));
    localStorage.setItem("mangaka-data-saver", String(profile.data_saver));
    localStorage.setItem("mangaka-auto-next-volume", String(profile.auto_next_volume));
    localStorage.setItem("mangaka-continue-preview", preview);
    saveCatalogDisplayPreferences(getCatalogDisplayPreferences(profile));
    saveVisibleWorkTypes(getVisibleWorkTypes(profile));
    localStorage.setItem("mangaka-theme", theme);
    applySiteTheme(theme);
  }, [profile]);

  return null;
}
