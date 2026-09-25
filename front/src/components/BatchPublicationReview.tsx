import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WORK_TYPES, unitLabel } from "@/lib/publication";
import { moveBatchUnit, type BatchPublication } from "@/lib/publicationBatch";

function BatchCover({ file }: { file: File | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? (
    <img src={url} className="h-16 w-11 shrink-0 rounded object-cover" alt="Capa da obra" />
  ) : null;
}

export function BatchPublicationReview({
  works,
  onChange,
}: {
  works: BatchPublication[];
  onChange: (works: BatchPublication[]) => void;
}) {
  const update = (index: number, work: BatchPublication) =>
    onChange(works.map((item, i) => (i === index ? work : item)));
  return (
    <div className="mt-3 space-y-3">
      {works.map((work, index) => (
        <section
          key={`${work.title}-${index}`}
          aria-label={`Revisar ${work.title}`}
          className="min-w-0 rounded-xl border bg-card/40 p-3"
        >
          <div className="flex items-center gap-3">
            <BatchCover file={work.cover} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{work.title}</p>
              <p className="truncate text-xs text-muted-foreground">{work.author}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {WORK_TYPES.find((type) => type.value === work.workType)?.label} ·{" "}
                {work.units.length} arquivo(s) ·{" "}
                {work.unitKind === "chapter" ? "Capítulos" : "Volumes"} ·{" "}
                {(work.priceCents / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
          </div>
          <div className="mt-3 border-t pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold">Ordem de leitura</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  update(index, {
                    ...work,
                    units: work.units.map((unit, i) => ({ ...unit, number: i + 1 })),
                  })
                }
              >
                Numerar em sequência
              </Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              A leitura segue os números abaixo. Edite o número ou use as setas para trocar os
              arquivos entre as posições.
            </p>
            <ol className="max-h-80 space-y-2 overflow-y-auto">
              {work.units.map((unit, unitIndex) => (
                <li
                  key={`${unit.file.name}-${unitIndex}`}
                  className="flex min-w-0 items-center gap-2 rounded-lg border bg-background/70 p-2"
                >
                  <Input
                    type="number"
                    min={0}
                    max={2147483647}
                    step={1}
                    className="h-9 w-20 shrink-0"
                    aria-label={`${unitLabel(work.unitKind)} de ${unit.title}`}
                    value={Number.isFinite(unit.number) ? unit.number : ""}
                    disabled={work.workType === "book" && !work.isCollection}
                    onChange={(event) =>
                      update(index, {
                        ...work,
                        units: work.units.map((item, i) =>
                          i === unitIndex
                            ? {
                                ...item,
                                number:
                                  event.target.value === "" ? NaN : Number(event.target.value),
                              }
                            : item,
                        ),
                      })
                    }
                    onBlur={() =>
                      update(index, {
                        ...work,
                        units: [...work.units].sort((a, b) => a.number - b.number),
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium" title={unit.title}>
                      {unit.title}
                    </p>
                    <p
                      className="truncate text-[11px] text-muted-foreground"
                      title={unit.file.name}
                    >
                      {unit.file.name}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 shrink-0 p-0"
                    disabled={unitIndex === 0}
                    onClick={() => update(index, moveBatchUnit(work, unitIndex, -1))}
                    aria-label={`Mover ${unit.title} para cima`}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 shrink-0 p-0"
                    disabled={unitIndex === work.units.length - 1}
                    onClick={() => update(index, moveBatchUnit(work, unitIndex, 1))}
                    aria-label={`Mover ${unit.title} para baixo`}
                  >
                    ↓
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ))}
    </div>
  );
}
