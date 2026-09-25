import { Book3DModel } from "@/components/Book3DModel";
import { cn } from "@/lib/utils";

/**
 * Um único livro: deitado por padrão, erguido no hover apenas em desktops com
 * ponteiro preciso. Em mobile/tablet permanece deitado, sem event handlers JS.
 */
export function RealisticBookModel({ coverUrl, title, className }: { coverUrl: string | null | undefined; title: string; className?: string }) {
  return (
    <div className={cn("realistic-book-model relative size-full", className)}>
      <Book3DModel coverUrl={coverUrl} title={title} className="size-full" />
    </div>
  );
}
