import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, ImagePlus, LibraryBig, Plus, RotateCcw, ScanLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Position = "standing" | "lying";
type Scan = { aspectRatio: number; cropX: number; cropY: number; cropW: number; cropH: number };
type ShelfBook = {
  id: string;
  title: string | null;
  image_path: string;
  position: Position;
  created_at: string;
  aspect_ratio?: number | null;
  crop_x?: number | null;
  crop_y?: number | null;
  crop_w?: number | null;
  crop_h?: number | null;
  imageUrl?: string;
};
type ShelfUnit = { kind: "standing"; books: ShelfBook[] } | { kind: "stack"; books: ShelfBook[] };
const db = supabase as any;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

async function scanSpine(file: File): Promise<Scan> {
  const bmp = await createImageBitmap(file);
  const max = 700,
    scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)),
    h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const d = ctx.getImageData(0, 0, w, h).data,
    gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++)
    gray[p] = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10;
  const xs = new Float32Array(w),
    ys = new Float32Array(h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const e = Math.abs(gray[p + 1] - gray[p - 1]) + Math.abs(gray[p + w] - gray[p - w]);
      xs[x] += e;
      ys[y] += e;
    }
  const bounds = (arr: Float32Array, len: number) => {
    let avg = 0;
    for (const v of arr) avg += v;
    avg /= len;
    const threshold = avg * 1.12;
    let a = 0,
      b = len - 1;
    while (a < len * 0.45 && arr[a] < threshold) a++;
    while (b > len * 0.55 && arr[b] < threshold) b--;
    return [a, b] as const;
  };
  let [x1, x2] = bounds(xs, w),
    [y1, y2] = bounds(ys, h);
  // Scanner is intentionally conservative: keep a central spine-shaped region when edges are ambiguous.
  if (x2 - x1 < w * 0.07 || x2 - x1 > w * 0.82) {
    x1 = Math.round(w * 0.32);
    x2 = Math.round(w * 0.68);
  }
  if (y2 - y1 < h * 0.28 || y2 - y1 > h * 0.96) {
    y1 = Math.round(h * 0.08);
    y2 = Math.round(h * 0.92);
  }
  const padX = (x2 - x1) * 0.025,
    padY = (y2 - y1) * 0.015;
  x1 = clamp(x1 - padX, 0, w - 1);
  x2 = clamp(x2 + padX, 1, w);
  y1 = clamp(y1 - padY, 0, h - 1);
  y2 = clamp(y2 + padY, 1, h);
  const cw = x2 - x1,
    ch = y2 - y1;
  return {
    aspectRatio: clamp(cw / ch, 0.035, 1.8),
    cropX: x1 / w,
    cropY: y1 / h,
    cropW: cw / w,
    cropH: ch / h,
  };
}

export function PhysicalShelfPage() {
  const { user, loading } = useAuth();
  const [books, setBooks] = useState<ShelfBook[]>([]);
  const shelfUnits: ShelfUnit[] = [];
  for (let i = 0; i < books.length;) {
    if (books[i].position === "lying") {
      const stack: ShelfBook[] = [];
      while (i < books.length && books[i].position === "lying" && stack.length < 3) {
        stack.push(books[i]);
        i++;
      }
      shelfUnits.push({ kind: "stack", books: stack });
    } else {
      shelfUnits.push({ kind: "standing", books: [books[i]] });
      i++;
    }
  }
  const shelfMeasureRef = useRef<HTMLDivElement>(null);
  const [shelfWidth, setShelfWidth] = useState(320);
  const unitWidth = (unit: ShelfUnit) =>
    unit.kind === "standing"
      ? clamp(
          clamp(
            176 + (0.22 - clamp(Number(unit.books[0]?.aspect_ratio) || 0.2, 0.045, 1.2)) * 28,
            154,
            204,
          ) * clamp(Number(unit.books[0]?.aspect_ratio) || 0.2, 0.045, 1.2),
          18,
          92,
        )
      : Math.max(
          ...unit.books.map((book) =>
            clamp(
              176 + (0.22 - clamp(Number(book.aspect_ratio) || 0.2, 0.045, 1.2)) * 28,
              154,
              204,
            ),
          ),
          154,
        );
  const shelfRows = useMemo(() => {
    const gap = 3,
      available = Math.max(180, shelfWidth - 8),
      rows: ShelfUnit[][] = [];
    let row: ShelfUnit[] = [],
      used = 0;
    for (const unit of shelfUnits) {
      const width = unitWidth(unit);
      if (row.length && used + gap + width > available) {
        rows.push(row);
        row = [];
        used = 0;
      }
      row.push(unit);
      used += width + (row.length > 1 ? gap : 0);
    }
    if (row.length) rows.push(row);
    return rows;
  }, [books, shelfWidth]);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [position, setPosition] = useState<Position>("standing");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null),
    galleryRef = useRef<HTMLInputElement>(null);
  async function loadBooks() {
    if (!user) return;
    const { data, error } = await db
      .from("physical_shelf_books")
      .select("id,title,image_path,position,created_at,aspect_ratio,crop_x,crop_y,crop_w,crop_h")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar sua estante.");
      return;
    }
    setBooks(
      await Promise.all(
        (data ?? []).map(async (b: ShelfBook) => {
          const { data: s } = await db.storage
            .from("physical-shelf")
            .createSignedUrl(b.image_path, 3600);
          return { ...b, imageUrl: s?.signedUrl };
        }),
      ),
    );
  }
  useEffect(() => {
    void loadBooks();
  }, [user?.id]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    const el = shelfMeasureRef.current;
    if (!el) return;
    const update = () => setShelfWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [books.length]);
  async function chooseFile(next: File | null) {
    if (!next) return;
    if (!next.type.startsWith("image/")) return toast.error("Escolha uma foto da lombada.");
    if (next.size > 10 * 1024 * 1024) return toast.error("A foto deve ter no máximo 10 MB.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setScanning(true);
    setScan(null);
    try {
      const result = await scanSpine(next);
      setScan(result);
      toast.success("Lombada detectada e medida.");
    } catch {
      toast.error(
        "Não consegui detectar a lombada. Tente uma foto mais reta e com fundo contrastante.",
      );
    } finally {
      setScanning(false);
    }
  }
  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setScan(null);
    setTitle("");
    setPosition("standing");
    setOpen(false);
  }
  async function saveBook() {
    if (!user || !file || !scan) return toast.error("Escaneie a lombada primeiro.");
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await db.storage
        .from("physical-shelf")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const ins = await db
        .from("physical_shelf_books")
        .insert({
          user_id: user.id,
          title: title.trim() || null,
          image_path: path,
          position,
          aspect_ratio: scan.aspectRatio,
          crop_x: scan.cropX,
          crop_y: scan.cropY,
          crop_w: scan.cropW,
          crop_h: scan.cropH,
        })
        .select("id")
        .single();
      if (ins.error) {
        await db.storage.from("physical-shelf").remove([path]);
        throw ins.error;
      }
      toast.success("Livro adicionado na proporção escaneada!");
      reset();
      await loadBooks();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível adicionar o livro.");
    } finally {
      setBusy(false);
    }
  }
  async function removeBook(book: ShelfBook) {
    if (!confirm(`Remover ${book.title || "este livro"} da estante?`)) return;
    const r = await db.from("physical_shelf_books").delete().eq("id", book.id);
    if (r.error) return toast.error("Não foi possível remover.");
    await db.storage.from("physical-shelf").remove([book.image_path]);
    setBooks((v) => v.filter((i) => i.id !== book.id));
  }
  if (!loading && !user)
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <LibraryBig className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 font-display text-2xl">Sua estante física mora aqui</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre para escanear seus livros físicos.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </main>
    );
  return (
    <main className="mx-auto w-full max-w-7xl px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 lg:px-8">
      <section className="relative overflow-hidden rounded-[1.75rem] border bg-card p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-primary">
              <LibraryBig className="size-3.5" />
              Coleção física
            </div>
            <h1 className="font-display text-[2rem] leading-tight sm:text-4xl">Minha estante</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              Escaneie a lombada. O BookSyde recorta e preserva a <strong>proporção visual</strong>{" "}
              de cada livro na estante.
            </p>
          </div>
          <Button className="h-12 rounded-2xl px-5 shadow-sm" onClick={() => setOpen(true)}>
            <ScanLine className="mr-2 size-4" />
            Escanear livro
          </Button>
        </div>
      </section>
      <div className="mt-4 flex items-center justify-between px-1">
        <div>
          <h2 className="font-display text-xl">Seus livros</h2>
          <p className="text-xs text-muted-foreground">
            {books.length} {books.length === 1 ? "livro" : "livros"} na estante
          </p>
        </div>
        <button
          className="grid size-11 place-items-center rounded-full border bg-card sm:hidden"
          onClick={() => setOpen(true)}
          aria-label="Adicionar livro"
        >
          <Plus className="size-5" />
        </button>
      </div>
      <section className="mt-3 overflow-hidden rounded-[1.65rem] border bg-card/45">
        {books.length === 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-72 w-full flex-col items-center justify-center p-8 text-center"
          >
            <div className="grid size-16 place-items-center rounded-2xl border bg-background shadow-sm">
              <ScanLine className="size-7 text-primary" />
            </div>
            <strong className="mt-4 text-base">Escaneie seu primeiro livro</strong>
            <span className="mt-1 max-w-xs text-sm leading-5 text-muted-foreground">
              Fotografe a lombada de frente e deixe um pouco de espaço ao redor.
            </span>
          </button>
        ) : (
          <div className="p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between rounded-2xl border bg-background/65 px-4 py-3">
              <div>
                <strong className="text-sm">Estante principal</strong>
                <p className="text-[11px] text-muted-foreground">
                  Livros deitados são empilhados automaticamente, até 3 por pilha.
                </p>
              </div>
              <LibraryBig className="size-5 text-primary" />
            </div>
            <div
              ref={shelfMeasureRef}
              className="rounded-[1.4rem] border bg-gradient-to-b from-muted/20 to-muted/55 px-2 pt-5 shadow-inner sm:px-3"
            >
              <div className="space-y-7">
                {shelfRows.map((row, rowIndex) => (
                  <div key={`shelf-row-${rowIndex}`} className="relative pt-3">
                    <div className="flex min-h-[218px] items-end gap-[3px] overflow-hidden px-1 sm:px-2">
                      {row.map((unit, unitIndex) =>
                        unit.kind === "standing" ? (
                          unit.books.map((book) => {
                            const ar = clamp(Number(book.aspect_ratio) || 0.2, 0.045, 1.2);
                            const h = clamp(176 + (0.22 - ar) * 28, 154, 204),
                              w = clamp(h * ar, 18, 92);
                            const cw = Number(book.crop_w) || 1,
                              ch = Number(book.crop_h) || 1,
                              cx = Number(book.crop_x) || 0,
                              cy = Number(book.crop_y) || 0;
                            return (
                              <div
                                key={book.id}
                                className="group relative shrink-0"
                                style={{ width: w, height: h }}
                                title={book.title || "Livro físico"}
                              >
                                <div
                                  className="absolute inset-0 overflow-hidden rounded-[3px] border border-black/15 shadow-[1px_2px_5px_rgba(0,0,0,.24)]"
                                  style={{
                                    backgroundImage: book.imageUrl
                                      ? `url(${book.imageUrl})`
                                      : undefined,
                                    backgroundSize: `${100 / cw}% ${100 / ch}%`,
                                    backgroundPosition: `${(cx / (1 - cw || 1)) * 100}% ${(cy / (1 - ch || 1)) * 100}%`,
                                    backgroundRepeat: "no-repeat",
                                  }}
                                  role="img"
                                  aria-label={book.title || "Lombada"}
                                />
                                <button
                                  type="button"
                                  onClick={() => void removeBook(book)}
                                  aria-label="Remover livro"
                                  className="absolute -right-2 -top-8 z-20 grid size-7 place-items-center rounded-full border bg-background shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div
                            key={`stack-${unitIndex}`}
                            className="flex shrink-0 flex-col-reverse items-center justify-start gap-[2px]"
                          >
                            {unit.books.map((book) => {
                              const ar = clamp(Number(book.aspect_ratio) || 0.2, 0.045, 1.2);
                              const bookH = clamp(176 + (0.22 - ar) * 28, 154, 204),
                                thickness = clamp(bookH * ar, 18, 70);
                              const width = bookH;
                              const cw = Number(book.crop_w) || 1,
                                ch = Number(book.crop_h) || 1,
                                cx = Number(book.crop_x) || 0,
                                cy = Number(book.crop_y) || 0;
                              return (
                                <div
                                  key={book.id}
                                  className="group relative"
                                  style={{ width, height: thickness }}
                                  title={book.title || "Livro físico"}
                                >
                                  <div
                                    className="absolute left-1/2 top-1/2 overflow-hidden rounded-[3px] border border-black/15 shadow-[1px_2px_5px_rgba(0,0,0,.22)]"
                                    style={{
                                      width: thickness,
                                      height: width,
                                      transform: "translate(-50%,-50%) rotate(90deg)",
                                      backgroundImage: book.imageUrl
                                        ? `url(${book.imageUrl})`
                                        : undefined,
                                      backgroundSize: `${100 / cw}% ${100 / ch}%`,
                                      backgroundPosition: `${(cx / (1 - cw || 1)) * 100}% ${(cy / (1 - ch || 1)) * 100}%`,
                                      backgroundRepeat: "no-repeat",
                                    }}
                                    role="img"
                                    aria-label={book.title || "Lombada"}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void removeBook(book)}
                                    aria-label="Remover livro"
                                    className="absolute -right-2 -top-2 z-20 grid size-7 place-items-center rounded-full border bg-background shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ),
                      )}
                    </div>
                    <div className="relative h-4 rounded-t-md border-x border-t bg-muted shadow-[0_-6px_14px_rgba(0,0,0,.16)]">
                      <div className="absolute inset-x-0 top-1 h-px bg-white/25" />
                    </div>
                    <div className="h-6 rounded-b-md border-x border-b bg-card shadow-[0_7px_12px_rgba(0,0,0,.08)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/60 backdrop-blur-[2px] sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-[2rem] sm:p-6">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-primary">
                  <ScanLine className="size-4" />
                  Scanner de lombada
                </div>
                <h2 className="mt-1 font-display text-2xl">Adicionar livro</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fotografe reto, com a lombada inteira visível.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={reset}>
                <X />
              </Button>
            </div>
            <input
              ref={cameraRef}
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void chooseFile(e.target.files?.[0] ?? null)}
            />
            <input
              ref={galleryRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(e) => void chooseFile(e.target.files?.[0] ?? null)}
            />
            <div className="mt-5 overflow-hidden rounded-[1.4rem] border bg-black/90">
              {preview ? (
                <div className="relative flex min-h-72 items-center justify-center overflow-hidden p-4">
                  <img
                    src={preview}
                    alt="Foto da lombada"
                    className="max-h-80 max-w-full object-contain opacity-90"
                  />
                  {scan ? (
                    <div
                      className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,.22)]"
                      style={{
                        left: `${scan.cropX * 100}%`,
                        top: `${scan.cropY * 100}%`,
                        width: `${scan.cropW * 100}%`,
                        height: `${scan.cropH * 100}%`,
                      }}
                    >
                      <i className="absolute -left-1 -top-1 size-3 border-l-2 border-t-2 border-primary" />
                      <i className="absolute -right-1 -top-1 size-3 border-r-2 border-t-2 border-primary" />
                      <i className="absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 border-primary" />
                      <i className="absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 border-primary" />
                    </div>
                  ) : null}
                  {scanning ? (
                    <div className="absolute inset-x-5 top-1/2 h-px animate-pulse bg-primary shadow-[0_0_12px_currentColor]" />
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-3 right-3 rounded-full"
                    onClick={() => cameraRef.current?.click()}
                  >
                    <RotateCcw className="mr-2 size-4" />
                    Refazer
                  </Button>
                </div>
              ) : (
                <div className="p-4">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white"
                  >
                    <div className="grid size-14 place-items-center rounded-full bg-white/10">
                      <Camera className="size-6" />
                    </div>
                    <strong className="mt-3">Abrir câmera</strong>
                    <span className="mt-1 text-xs text-white/60">Centralize somente a lombada</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="mt-2 min-h-11 w-full text-sm text-white/70"
                  >
                    <ImagePlus className="mr-2 inline size-4" />
                    Escolher foto da galeria
                  </button>
                </div>
              )}
            </div>
            {scan ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border bg-primary/5 px-3 py-2 text-xs">
                <ScanLine className="size-4 text-primary" />
                <div>
                  <strong>Lombada detectada</strong>
                  <span className="ml-1 text-muted-foreground">
                    proporção {scan.aspectRatio.toFixed(2)}:1
                  </span>
                </div>
              </div>
            ) : null}
            <label className="mt-4 block text-sm font-medium">
              Nome do livro <span className="font-normal text-muted-foreground">(opcional)</span>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                placeholder="Ex.: It — A Coisa"
                className="mt-2 h-12 rounded-xl"
              />
            </label>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Posição na estante</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["standing", "lying"] as Position[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPosition(v)}
                    className={cn(
                      "flex min-h-20 items-center justify-center gap-3 rounded-xl border p-3 text-sm font-semibold",
                      position === v && "border-primary bg-primary/10 ring-1 ring-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "block rounded-sm border bg-muted shadow-sm",
                        v === "standing" ? "h-10 w-2.5" : "h-2.5 w-10",
                      )}
                    />
                    {v === "standing" ? "Em pé" : "Deitado"}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button
              disabled={!file || !scan || busy || scanning}
              className="mt-5 h-12 w-full rounded-xl"
              onClick={() => void saveBook()}
            >
              {scanning ? "Escaneando..." : busy ? "Adicionando..." : "Adicionar à estante"}
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
