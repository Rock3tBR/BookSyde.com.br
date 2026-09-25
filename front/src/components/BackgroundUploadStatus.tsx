import { LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getVolumeUploadStatus,
  subscribeToVolumeUpload,
} from "@/lib/volumeUploadStatus";

export function BackgroundUploadStatus() {
  const queryClient = useQueryClient();
  const upload = useSyncExternalStore(
    subscribeToVolumeUpload,
    getVolumeUploadStatus,
    getVolumeUploadStatus,
  );
  const [hidden, setHidden] = useState(false);
  const lastFinalMessage = useRef("");
  const previousState = useRef(upload.state);

  useEffect(() => {
    // Um novo envio volta a exibir o progresso, mesmo que o cartão anterior
    // tenha sido fechado manualmente.
    if (upload.state === "running" && previousState.current !== "running") {
      setHidden(false);
    }
    previousState.current = upload.state;

    if (upload.state === "completed") {
      void queryClient.invalidateQueries();
    }

    if (upload.state !== "completed" && upload.state !== "error") return;

    const key = `${upload.state}:${upload.message}`;
    if (lastFinalMessage.current === key) return;
    lastFinalMessage.current = key;

    // O próprio indicador do site é a única notificação do upload.
    // Evita duplicar o feedback com um toast flutuante do Sonner.
    setHidden(false);
    // Módulo pesado já está carregado se houve upload; import assíncrono
    // evita incluí-lo no carregamento inicial das demais páginas.
    void import("@/lib/volumeUpload").then(({ dismissVolumeUpload }) => dismissVolumeUpload());
  }, [queryClient, upload.message, upload.state]);

  if (upload.state !== "running" || hidden) return null;

  return (
    <aside className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-[100] max-w-sm rounded-lg border bg-background/95 p-3 shadow-2xl backdrop-blur-md sm:bottom-4 sm:left-auto sm:right-4 sm:p-4">
      <div className="flex items-start gap-3">
        <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Enviando conteúdo em segundo plano</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{upload.message}</p>
          <Progress className="mt-3" value={upload.progress} />
          <p className="mt-1 text-right text-xs text-muted-foreground">{upload.progress}%</p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 size-8 shrink-0"
          aria-label="Fechar progresso do envio"
          onClick={() => setHidden(true)}
        >
          <X className="size-4" />
        </Button>
      </div>
    </aside>
  );
}
