import { useEffect, useRef, useState } from "react";
import { Camera, Move, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AvatarEditor({
  disabled,
  onSave,
}: {
  disabled?: boolean;
  onSave: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState("avatar.jpg");
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );

  async function crop() {
    const image = new Image();
    image.src = source;
    await image.decode();
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d")!;
    // Começa exibindo a imagem inteira. O usuário decide se quer ampliar para
    // preencher o círculo, sem perder automaticamente o topo da fotografia.
    const base = Math.min(size / image.width, size / image.height);
    const width = image.width * base * zoom;
    const height = image.height * base * zoom;
    context.drawImage(
      image,
      (size - width) / 2 + (x / 100) * size,
      (size - height) / 2 + (y / 100) * size,
      width,
      height,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Falha ao recortar"))),
        "image/webp",
        0.9,
      ),
    );
    setSaving(true);
    await onSave(new File([blob], fileName.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
    setSaving(false);
    setSource("");
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Camera /> Escolher e ajustar foto
      </Button>
      <Input
        ref={input}
        className="hidden"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setFileName(file.name);
          setZoom(1);
          setX(0);
          setY(0);
          setSource(URL.createObjectURL(file));
          event.target.value = "";
        }}
      />
      <Dialog
        open={!!source}
        onOpenChange={(open) => {
          if (!open) setSource("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar foto</DialogTitle>
            <DialogDescription>
              Use o zoom e mova o enquadramento antes de salvar.
            </DialogDescription>
          </DialogHeader>
          {source ? (
            <div className="space-y-4">
              <div className="mx-auto size-72 max-w-full overflow-hidden rounded-full border-4 border-primary/40 bg-muted">
                <img
                  src={source}
                  alt="Prévia"
                  className="size-full object-contain"
                  style={{ transform: `translate(${x}%, ${y}%) scale(${zoom})` }}
                />
              </div>
              <Label>
                <ZoomIn className="mr-2 inline size-4" />
                Zoom
              </Label>
              <input
                className="w-full"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <Label>
                <Move className="mr-2 inline size-4" />
                Horizontal
              </Label>
              <input
                className="w-full"
                type="range"
                min="-75"
                max="75"
                value={x}
                onChange={(e) => setX(Number(e.target.value))}
              />
              <Label>
                <Move className="mr-2 inline size-4" />
                Vertical
              </Label>
              <input
                className="w-full"
                type="range"
                min="-75"
                max="75"
                value={y}
                onChange={(e) => setY(Number(e.target.value))}
              />
              <Button className="w-full" disabled={saving} onClick={() => void crop()}>
                {saving ? "Salvando…" : "Usar esta foto"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
