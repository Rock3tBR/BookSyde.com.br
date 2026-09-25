import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Browsing a preview never changes reading progress until confirmed. */
export function ReaderPageNavigator({
  current,
  count,
  container,
  renderPreview,
  onNavigate,
  onClose,
}: {
  current: number;
  count: number;
  container: HTMLElement | null;
  renderPreview: (page: number) => ReactNode;
  onNavigate: (page: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(current);
  const [pageInput, setPageInput] = useState(String(current + 1));
  const valid = /^\d+$/.test(pageInput) && Number(pageInput) >= 1 && Number(pageInput) <= count;
  const select = (page: number) => {
    const next = Math.max(0, Math.min(count - 1, page));
    setSelected(next);
    setPageInput(String(next + 1));
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-1/2 z-[101] max-h-[90dvh] w-full max-w-lg -translate-x-1/2 overflow-y-auto rounded-t-3xl border border-white/15 bg-[#202020] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-2xl">
          <Dialog.Title className="pr-8 text-lg font-semibold">Navegar pelas páginas</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-white/60">
            Você está na página {current + 1}. Explore a prévia e escolha onde continuar.
          </Dialog.Description>
          <Dialog.Close
            aria-label="Fechar navegação de páginas"
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-xl hover:bg-white/10"
          >
            <X className="size-5" />
          </Dialog.Close>
          <div className="my-4 flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Página anterior da prévia"
              disabled={selected === 0}
              onClick={() => select(selected - 1)}
            >
              <ChevronLeft />
            </Button>
            <div
              className="flex min-h-36 min-w-28 items-center justify-center overflow-hidden rounded-md bg-black/20 shadow-lg"
              aria-label={`Prévia da página ${selected + 1}`}
            >
              {renderPreview(selected)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Próxima página da prévia"
              disabled={selected === count - 1}
              onClick={() => select(selected + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <label className="block text-xs text-white/70" htmlFor="reader-page-range">
            Página {selected + 1} de {count}
          </label>
          <input
            id="reader-page-range"
            aria-label="Selecionar página"
            type="range"
            min={1}
            max={count}
            value={selected + 1}
            onChange={(event) => select(Number(event.target.value) - 1)}
            className="my-3 h-6 w-full accent-emerald-400"
          />
          <form
            className="flex items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid) {
                onNavigate(Number(pageInput) - 1);
                onClose();
              }
            }}
          >
            <label className="flex-1 text-xs text-white/70">
              Ir para página
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={count}
                step={1}
                value={pageInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setPageInput(value);
                  const page = Number(value);
                  if (Number.isInteger(page) && page >= 1 && page <= count) setSelected(page - 1);
                }}
                className="mt-2 h-10 w-full rounded-xl border border-white/20 bg-black/20 px-3 text-base text-white"
              />
            </label>
            <Button type="submit" disabled={!valid} className="h-10 rounded-xl">
              Ler esta página
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
