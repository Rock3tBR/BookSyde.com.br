import { useCallback, useEffect, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";

const FLUSH_AFTER_MS = 10_000;
const MAX_SINGLE_TICK_MS = 2_500;
const MIN_FLUSH_SECONDS = 1;

type UseReadingTimeTrackerParams = {
  volumeId: string;
  userId?: string | null;
  enabled?: boolean;
};

/**
 * Timer automático do leitor.
 *
 * - começa sozinho assim que o leitor é aberto;
 * - continua contando enquanto a rota do leitor estiver aberta e o app estiver ativo;
 * - pausa ao trocar de aba, minimizar ou sair do aplicativo;
 * - pausa e envia o tempo pendente ao sair da rota do leitor.
 *
 * Não existe botão de iniciar/pausar: entrar e sair do leitor controla o timer.
 */
export function useReadingTimeTracker({
  volumeId,
  userId,
  enabled = true,
}: UseReadingTimeTrackerParams) {
  const pendingMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (!enabled || !userId || !volumeId || flushingRef.current) return;

    flushingRef.current = true;

    try {
      // O loop também recolhe segundos acumulados enquanto uma requisição
      // anterior ainda estava em andamento (por exemplo, ao sair do leitor).
      while (Math.floor(pendingMsRef.current / 1000) >= MIN_FLUSH_SECONDS) {
        const seconds = Math.floor(pendingMsRef.current / 1000);
        pendingMsRef.current -= seconds * 1000;

        const { error } = await supabase.rpc("add_reading_time", {
          p_seconds: seconds,
          p_volume_id: volumeId,
        });

        if (error) {
          pendingMsRef.current += seconds * 1000;
          console.error("Não foi possível registrar o tempo de leitura", error);
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [enabled, userId, volumeId]);

  useEffect(() => {
    if (!enabled || !userId || !volumeId || typeof document === "undefined") return;

    const appIsActive = () => document.visibilityState === "visible" && document.hasFocus();

    // Entrou no leitor: começa automaticamente se o aplicativo estiver ativo.
    let active = appIsActive();
    lastTickRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const previous = lastTickRef.current ?? now;

      // Limita saltos grandes para não contar suspensão do dispositivo como leitura.
      const elapsed = Math.max(0, Math.min(now - previous, MAX_SINGLE_TICK_MS));
      if (active) pendingMsRef.current += elapsed;
      lastTickRef.current = now;
    };

    const pause = () => {
      tick();
      active = false;
      void flush();
    };

    const resume = () => {
      lastTickRef.current = performance.now();
      active = appIsActive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") resume();
      else pause();
    };

    const interval = window.setInterval(() => {
      tick();
      if (pendingMsRef.current >= FLUSH_AFTER_MS) void flush();
    }, 1000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", resume);
    window.addEventListener("blur", pause);
    window.addEventListener("pagehide", pause);

    return () => {
      // Saiu do leitor: pausa imediatamente e persiste o último bloco.
      tick();
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", resume);
      window.removeEventListener("blur", pause);
      window.removeEventListener("pagehide", pause);
      void flush();
      lastTickRef.current = null;
    };
  }, [enabled, flush, userId, volumeId]);
}
