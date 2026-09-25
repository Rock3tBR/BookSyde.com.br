import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const MIN_RECORD_INTERVAL = 60_000;

/**
 * Registra sessões autenticadas sem bloquear a navegação.
 * O servidor abre uma nova sessão quando há pelo menos 30 minutos sem atividade registrada.
 */
export function useSystemAccess(userId: string | undefined) {
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    let pending = false;
    let lastAttempt = 0;

    const record = async () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || pending) return;
      if (Date.now() - lastAttempt < MIN_RECORD_INTERVAL) return;

      pending = true;
      lastAttempt = Date.now();

      try {
        await supabase.rpc("record_system_access");
      } catch {
        // Métrica administrativa: nunca deve interromper login, leitura ou navegação.
      } finally {
        pending = false;
      }
    };

    const handleActivity = () => void record();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void record();
    };

    void record();

    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("focus", handleActivity);
    window.addEventListener("online", handleActivity);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("focus", handleActivity);
      window.removeEventListener("online", handleActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId]);
}
