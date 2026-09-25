import { BookOpen, Globe2, ImageIcon, Layers3, Store } from "lucide-react";

import type { WorkType } from "@/lib/publication";

type LiveWorkPreviewProps = {
  title: string;
  author: string;
  category: string;
  description: string;
  synopsis: string;
  workType: WorkType | "";
  coverUrl: string;
  destination: "catalog" | "marketplace";
  priceCents: number;
  freeCatalog: boolean;
  isCollection: boolean;
  fileFormat: "epub" | "pdf" | null;
};

const workTypeNames: Record<WorkType, string> = {
  manga: "Mangá",
  hq: "HQ",
  gibi: "Gibi",
  book: "Livro",
};

/** Prévia local: utiliza o mesmo estado do formulário, sem gravar ou publicar dados. */
export function LiveWorkPreview({
  title,
  author,
  category,
  description,
  synopsis,
  workType,
  coverUrl,
  destination,
  priceCents,
  freeCatalog,
  isCollection,
  fileFormat,
}: LiveWorkPreviewProps) {
  const displayTitle = title.trim() || "Título da sua obra";
  const displayAuthor = author.trim() || "Nome do autor";
  const displayCategory = category.trim() || "Categoria";
  const displayDescription = description.trim() || "A descrição da sua obra aparecerá aqui enquanto você escreve.";
  const displaySynopsis = synopsis.trim();
  const validPrice = Number.isFinite(priceCents) && priceCents >= 0;
  const priceText = freeCatalog || (validPrice && priceCents === 0)
    ? "Gratuito"
    : validPrice
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(priceCents / 100)
      : "Defina um preço";
  const channelName = destination === "marketplace" ? "Marketplace" : "Catálogo";

  return (
    <section aria-label="Prévia ao vivo da obra" className="min-w-0 rounded-2xl border border-border/70 bg-background/45 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <h3 className="truncate text-sm font-semibold">Prévia da obra</h3>
        </div>
        <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
          Ao vivo
        </span>
      </div>

      <div className="mx-auto aspect-[3/4] w-full max-w-[150px] overflow-hidden 2xl:max-w-[174px] rounded-lg border border-border/70 bg-muted shadow-[8px_12px_22px_-10px_rgba(0,0,0,.7)]">
        {coverUrl ? (
          <img src={coverUrl} alt={`Prévia da capa de ${displayTitle}`} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted via-card to-background px-3 text-center">
            <ImageIcon className="size-9 text-primary/50" aria-hidden="true" />
            <span className="line-clamp-3 break-words font-display text-sm font-semibold leading-tight text-foreground/80">
              {displayTitle}
            </span>
            <span className="text-[10px] text-muted-foreground">Sua capa aqui</span>
          </div>
        )}
      </div>

      <div className="mt-4 min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-border/65 bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">
            {workType ? workTypeNames[workType] : "Formato da obra"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
            {destination === "marketplace" ? <Store className="size-3" aria-hidden="true" /> : <Globe2 className="size-3" aria-hidden="true" />}
            {channelName}
          </span>
          {isCollection && workType !== "manga" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/65 bg-card px-2 py-1 text-[10px] text-muted-foreground">
              <Layers3 className="size-3" aria-hidden="true" /> Coleção
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="break-words font-display text-xl font-semibold leading-tight">{displayTitle}</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">{displayAuthor} · {displayCategory}</p>
        </div>

        <div className="space-y-1 border-t border-border/60 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Descrição</p>
          <p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{displayDescription}</p>
        </div>

        {displaySynopsis ? (
          <div className="space-y-1 border-t border-border/60 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Sinopse</p>
            <p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{displaySynopsis}</p>
          </div>
        ) : null}

        <div className="flex min-w-0 items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="min-w-0 text-xs text-muted-foreground">{fileFormat ? `Arquivo ${fileFormat.toUpperCase()}` : "Publicação digital"}</span>
          <strong className="shrink-0 text-sm text-primary">{priceText}</strong>
        </div>
        <p className="text-center text-[10px] leading-4 text-muted-foreground">Simulação visual. Nada será publicado nesta prévia.</p>
      </div>
    </section>
  );
}
