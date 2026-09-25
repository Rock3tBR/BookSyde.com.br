import { PublicationCover } from "@/components/PublicationCover";
import type { CSSProperties } from "react";
import { BookOpen, Pencil, Share2 } from "lucide-react";
import { type MangaSummary } from "@/components/MangaCard";

export const DEFAULT_FOLDER_COLOR = "#8060d8";

export function LibraryFolderCard({
  name,
  color,
  count,
  firstItem,
  imported = false,
  onClick,
  onEdit,
  onShare,
}: {
  name: string;
  color: string;
  count: number;
  firstItem?: MangaSummary | undefined;
  imported?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
}) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_FOLDER_COLOR;
  const brightness = [0.299, 0.587, 0.114].reduce(
    (sum, weight, index) =>
      sum + weight * parseInt(safeColor.slice(1 + index * 2, 3 + index * 2), 16),
    0,
  );
  const style = {
    "--folder-color": safeColor,
    "--folder-text": brightness > 160 ? "#18181b" : "#ffffff",
    "--folder-text-shadow": brightness > 160 ? "none" : "0 1px 4px rgb(0 0 0 / 60%)",
  } as CSSProperties;
  const content = (
    <>
      <svg
        className="library-folder-back"
        viewBox="0 0 320 280"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M2 40Q2 10 32 10H102Q114 10 122 22L137 42Q145 53 162 53H286Q318 53 318 85V249Q318 278 289 278H31Q2 278 2 249Z" />
      </svg>
      <div className="library-folder-preview" aria-hidden="true">
        {firstItem ? (
          <>
            <div className="library-folder-cover">
              <PublicationCover coverUrl={firstItem.cover_url} title={firstItem.title} workType={firstItem.work_type} fit="contain" />
            </div>
            <span className="library-folder-item-title">{firstItem.title}</span>
          </>
        ) : (
          <div className="library-folder-empty">
            <BookOpen />
            <span>Sua próxima leitura</span>
          </div>
        )}
      </div>
      <div className="library-folder-front">
        <span className="library-folder-name">{name || "Nome da pasta"}</span>
        <span className="library-folder-count">
          {count} {count === 1 ? "item" : "itens"}
        </span>
        {imported ? <span className="library-folder-imported">Importada</span> : null}
      </div>
    </>
  );
  if (!onClick) {
    return (
      <div className="library-folder" style={style}>
        {content}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="library-folder"
        style={style}
        onClick={onClick}
        aria-label={`${name}, ${count} ${count === 1 ? "item" : "itens"}${imported ? ", importada" : ""}`}
      >
        {content}
      </button>
      {onEdit || onShare ? (
        <div className="absolute right-2 top-2 z-20 flex gap-1.5">
          {onEdit ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="grid size-9 place-items-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur transition hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Editar pasta ${name}`}
              title="Editar pasta"
            >
              <Pencil className="size-4" />
            </button>
          ) : null}
          {onShare ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onShare();
              }}
              className="grid size-9 place-items-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur transition hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Compartilhar pasta ${name}`}
              title="Compartilhar pasta"
            >
              <Share2 className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FolderColorField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        Cor da pasta
      </label>
      <div className="flex items-center gap-3 rounded-xl border bg-background/45 px-3 py-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-14 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="text-sm text-muted-foreground">Escolha uma cor</span>
        <span className="ml-auto font-sans text-xs text-muted-foreground">
          {value.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
