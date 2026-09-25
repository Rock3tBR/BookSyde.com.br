import type { ReactNode } from "react";
import { Bookmark, Box, GalleryHorizontalEnd, LayoutGrid } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { CatalogDisplayStyle } from "@/lib/catalogDisplay";
import type { WorkType } from "@/lib/publication";

export function CatalogDisplayPreference({
  workType,
  label,
  value,
  onChange,
}: {
  workType: WorkType;
  label: string;
  value: CatalogDisplayStyle;
  onChange: (value: CatalogDisplayStyle) => void;
}) {
  void workType;
  const options: Array<{
    value: CatalogDisplayStyle;
    label: string;
    description: string;
    icon: ReactNode;
  }> = [
    {
      value: "grid",
      label: "Padrão",
      description: "Cards tradicionais, compactos e objetivos.",
      icon: <LayoutGrid className="size-4" />,
    },
    {
      value: "book",
      label: "Livro",
      description: "Livro físico com páginas aparentes e marcador.",
      icon: <Bookmark className="size-4" />,
    },
    {
      value: "realistic",
      label: "Realista",
      description: "Modelos 3D: deitado por padrão e em pé no hover do desktop.",
      icon: <Box className="size-4" />,
    },
  ];

  return (
    <section className="rounded-2xl border border-border/70 bg-card/30 p-3 sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Uma única escolha controla a apresentação de todo o catálogo.
          </p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
          Todos os tipos
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`overflow-hidden rounded-[1.1rem] border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/15"
                  : "border-border/70 bg-background/35 hover:border-primary/35 hover:bg-muted/45"
              }`}
            >
              <CatalogStylePreview style={option.value} />
              <div className="p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {option.icon}
                  {option.label}
                  {selected ? <span className="ml-auto text-primary">✓</span> : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CatalogStylePreview({ style }: { style: CatalogDisplayStyle }) {
  if (style === "book") return <div className="flex h-36 items-center justify-center overflow-hidden border-b border-border/60 bg-gradient-to-br from-background/70 via-muted/25 to-primary/5"><div className="relative h-24 w-20 [perspective:700px]"><div className="absolute inset-x-2 bottom-1 h-4 rounded-full bg-black/25 blur-md"/><div className="absolute left-1/2 top-1/2 h-[82px] w-[58px] -translate-x-1/2 -translate-y-1/2 [transform:rotateY(-13deg)] rounded-r-md border border-black/20 bg-gradient-to-br from-primary/75 via-primary/55 to-primary/30 shadow-xl"><div className="absolute -right-2 top-1 bottom-1 w-2 rounded-r-sm bg-[repeating-linear-gradient(to_bottom,#f7efd9_0_2px,#d9c8a8_2px_3px)] shadow-inner"/><div className="absolute left-0 top-0 h-full w-2 bg-black/15"/><div className="absolute -bottom-3 right-2 h-8 w-2 bg-primary shadow"/></div></div></div>;
  if (style === "realistic") return <div className="flex h-36 items-center justify-center overflow-hidden border-b border-border/60 bg-gradient-to-br from-background/80 via-muted/20 to-primary/5"><div className="relative h-24 w-32 [perspective:900px]"><div className="absolute bottom-2 left-5 right-3 h-5 rounded-[50%] bg-black/30 blur-lg"/><div className="absolute left-1/2 top-1/2 h-[66px] w-[92px] -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d] [transform:rotateX(57deg)_rotateZ(-10deg)]"><div className="absolute inset-0 rounded-[5px] border border-black/25 bg-gradient-to-br from-primary/80 via-primary/55 to-primary/25 shadow-2xl"/><div className="absolute -bottom-[10px] left-1 right-1 h-[10px] origin-top [transform:rotateX(-90deg)] bg-[repeating-linear-gradient(to_bottom,#f4ead2_0_2px,#cbb895_2px_3px)]"/><div className="absolute -left-[8px] top-1 bottom-1 w-[8px] origin-right [transform:rotateY(90deg)] bg-gradient-to-r from-black/50 to-primary/50"/><div className="absolute inset-0 rounded-[5px] bg-gradient-to-r from-white/10 via-transparent to-black/10"/></div></div></div>;
  return <div className="grid h-36 grid-cols-3 gap-3 border-b border-border/60 bg-gradient-to-br from-background/70 to-muted/20 p-5">{[0,1,2,3,4,5].map(i=><div key={i} className="rounded-xl border border-border/60 bg-gradient-to-b from-primary/45 to-card shadow-md"/>)}</div>;
}

export function WorkspaceHeading({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary [&_svg]:size-4">
          {icon}
          {eyebrow}
        </div>
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export function SettingsBlock({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-background/30 p-3 sm:p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {number}
        </span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ChoiceGrid({
  title,
  icon,
  value,
  options,
  onChange,
}: {
  title: string;
  icon: ReactNode;
  value: string;
  options: Array<{ value: string; label: string; description: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="font-medium">{title}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/15"
                  : "border-border/70 bg-card/30 hover:border-primary/35 hover:bg-muted/45"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm">{option.label}</strong>
                {selected ? <span className="text-primary">✓</span> : null}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function ReaderChoice({
  title,
  icon,
  value,
  options,
  onChange,
  columns = 3,
}: {
  title: string;
  icon: ReactNode;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  columns?: 2 | 3;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="font-medium">{title}</p>
      </div>
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-xl border px-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${value === option.value ? "border-primary bg-primary/10" : "border-border/70 bg-background/35 hover:border-primary/35 hover:bg-muted/45"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PreferenceSwitch({
  icon,
  title,
  text,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card/30 p-4">
      <div>
        <div className="flex items-center gap-2 [&_svg]:size-4">
          {icon}
          <p className="font-medium">{title}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{text}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
