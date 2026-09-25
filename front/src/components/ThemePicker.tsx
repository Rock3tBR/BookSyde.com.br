import { Check, Moon, Sun } from "lucide-react";

import { THEME_OPTIONS, type SiteTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** A mesma prévia realista e a mesma ordem nos ajustes e no primeiro acesso. */
export function ThemePicker({
  value,
  onChange,
}: {
  value: SiteTheme;
  onChange: (theme: SiteTheme) => void;
}) {
  return (
    <div className="space-y-5">
      {(["claro", "escuro"] as const).map((group) => (
        <section key={group} className="space-y-2.5" aria-label={`Temas ${group === "claro" ? "claros" : "escuros"}`}>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground">
            {group === "claro" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            <span>{group === "claro" ? "01–04 · CLAROS" : "05–08 · ESCUROS"}</span>
            <span className="ml-auto text-[10px] font-normal tracking-normal">
              {group === "claro" ? "Papel → Cappuccino" : "Mocha → Noite absoluta"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {THEME_OPTIONS.filter((theme) => theme.group === group).map((theme) => {
              const selected = theme.value === value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${String(theme.number).padStart(2, "0")}. ${theme.label}: ${theme.description}`}
                  onClick={() => onChange(theme.value)}
                  className={cn(
                    "group min-w-0 overflow-hidden rounded-[1.1rem] border text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    selected
                      ? "border-primary ring-2 ring-primary/45 shadow-[var(--shadow-card)]"
                      : "border-border/75 hover:border-primary/70 hover:shadow-[var(--shadow-chip)]",
                  )}
                >
                  <div
                    className="relative flex h-24 flex-col overflow-hidden p-2.5"
                    style={{ backgroundColor: theme.background, color: theme.foreground }}
                    aria-hidden="true"
                  >
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: theme.primary }} />
                      <span className="h-[3px] w-9 rounded-full opacity-60" style={{ backgroundColor: theme.foreground }} />
                      <span className="ml-auto text-[10px] font-bold tabular-nums opacity-75">
                        {String(theme.number).padStart(2, "0")}
                      </span>
                    </div>
                    <div
                      className="flex min-h-0 flex-1 flex-col justify-between rounded-lg border p-2 shadow-sm"
                      style={{ backgroundColor: theme.card, borderColor: theme.border }}
                    >
                      <div className="space-y-1.5">
                        <span className="block h-[4px] w-3/4 rounded-full" style={{ backgroundColor: theme.foreground, opacity: 0.9 }} />
                        <span className="block h-[3px] w-1/2 rounded-full" style={{ backgroundColor: theme.foreground, opacity: 0.38 }} />
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <span className="h-3 w-7 rounded-sm" style={{ backgroundColor: theme.sidebar, border: `1px solid ${theme.border}` }} />
                        <span
                          className="rounded px-1.5 py-0.5 text-[8px] font-extrabold leading-none"
                          style={{ backgroundColor: theme.primary, color: theme.primaryForeground }}
                        >
                          Ler
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="min-h-[78px] bg-card/85 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-card-foreground sm:text-sm">
                      <span className="min-w-0 truncate">{theme.label}</span>
                      {selected ? <Check aria-hidden="true" className="ml-auto size-4 shrink-0 text-primary" /> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {theme.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
