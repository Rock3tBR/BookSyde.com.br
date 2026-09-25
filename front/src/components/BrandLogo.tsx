import { BookOpen } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  showName?: boolean;
  nameClassName?: string;
  tagline?: string;
  taglineClassName?: string;
  compact?: boolean;
};

/**
 * Identidade visual reutilizável do BookSyde.
 *
 * A imagem usa o asset público oficial e troca automaticamente para um fallback
 * local quando o arquivo não estiver disponível. Assim nenhum ponto da interface
 * exibe o ícone de imagem quebrada do navegador.
 */
export function BrandLogo({
  className,
  imageClassName,
  showName = false,
  nameClassName,
  tagline,
  taglineClassName,
  compact = false,
}: BrandLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {imageFailed ? (
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-[28%] border border-border/60 bg-gradient-to-br from-primary/20 via-card to-card text-primary shadow-sm",
            compact ? "size-9" : "size-11",
            imageClassName,
          )}
          aria-hidden="true"
        >
          <BookOpen className="size-[52%]" />
        </span>
      ) : (
        <img
          src="/booksyde-icon-192.png?v=2"
          width={192}
          height={192}
          decoding="async"
          alt={showName ? "" : "BookSyde"}
          aria-hidden={showName ? true : undefined}
          className={cn(
            "shrink-0 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.22)]",
            compact ? "size-9" : "size-11",
            imageClassName,
          )}
          onError={() => setImageFailed(true)}
        />
      )}

      {showName ? (
        <div className="min-w-0">
          <p className={cn("truncate font-display text-xl leading-none", nameClassName)}>BookSyde</p>
          {tagline ? (
            <p className={cn("mt-1 truncate text-xs text-muted-foreground", taglineClassName)}>{tagline}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
