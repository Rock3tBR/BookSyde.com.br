import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Keep the complete synopsis accessible without growing the cover layout. */
export function SynopsisPreview({
  text,
  title,
  className = "",
}: {
  text: string;
  title: string;
  className?: string;
}) {
  const synopsis = text.trim();
  if (!synopsis) return null;
  const preview = synopsis.length > 320 ? `${synopsis.slice(0, 320).trimEnd()}…` : synopsis;
  return (
    <div className={className}>
      <p className="line-clamp-4 break-words [overflow-wrap:anywhere]" data-synopsis-preview>
        {preview}
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="mt-2 text-xs font-semibold underline underline-offset-4 hover:opacity-75"
          >
            Ler sinopse completa
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sinopse</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
            {synopsis}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
