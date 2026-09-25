import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [desktopPlatform, setDesktopPlatform] = useState<DesktopPlatform | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(Boolean(standalone));
    setDesktopPlatform(getDesktopPlatform());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (desktopPlatform) {
      setDownloading(true);
      try {
        const response = await fetch(`/api/desktop-download?platform=${desktopPlatform}&check=1`, {
          signal: AbortSignal.timeout(12_000),
        });
        const payload = (await response.json()) as { downloadUrl?: string; error?: string };
        if (!response.ok || !payload.downloadUrl) {
          throw new Error(payload.error || "Instalador indisponível para este sistema");
        }
        window.location.assign(payload.downloadUrl);
      } catch (error) {
        const timedOut = error instanceof DOMException && error.name === "TimeoutError";
        toast.error(
          timedOut
            ? "O servidor demorou para localizar o instalador. Tente novamente."
            : error instanceof Error
              ? error.message
              : "Não foi possível baixar o Desktop",
        );
      } finally {
        setDownloading(false);
      }
      return;
    }
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setPrompt(null);
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(
      isIos
        ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início."
        : "Abra o menu do navegador e escolha Instalar app ou Adicionar à tela inicial.",
      { duration: 7000 },
    );
  }

  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      size="sm"
      onClick={install}
      disabled={downloading}
    >
      <Download className="size-4" />
      {downloading
        ? "Preparando…"
        : desktopPlatform
          ? compact
            ? "Desktop"
            : "Baixar Desktop"
          : "Instalar"}
    </Button>
  );
}

type DesktopPlatform = "macos" | "windows" | "linux";

function getDesktopPlatform(): DesktopPlatform | null {
  if (typeof navigator === "undefined") return null;
  const agent = navigator.userAgent.toLocaleLowerCase();
  if (/iphone|ipad|ipod|android/.test(agent)) return null;
  if (agent.includes("windows")) return "windows";
  if (agent.includes("macintosh") || agent.includes("mac os")) return "macos";
  if (agent.includes("linux")) return "linux";
  return null;
}
