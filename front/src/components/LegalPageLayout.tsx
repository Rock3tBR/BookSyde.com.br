import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpenCheck, ChevronRight, Scale } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

const legalLinks = [
  ["/termos", "Termos de Uso"],
  ["/privacidade", "Privacidade"],
  ["/reembolso", "Reembolsos"],
  ["/direitos-autorais", "Direitos autorais"],
  ["/termos-vendedor", "Termos do vendedor"],
  ["/contato", "Contato"],
] as const;

export function LegalPageLayout({
  eyebrow = "Confiança e transparência",
  title,
  summary,
  updated = "11 de setembro de 2026",
  children,
}: {
  eyebrow?: string;
  title: string;
  summary: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <main className="w-full px-3 pb-24 pt-4 sm:px-5 sm:pt-8 lg:px-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/75 p-5 shadow-[0_28px_70px_-48px_rgba(0,0,0,.95)] sm:p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Scale className="size-3.5" /> {eyebrow}
            </div>
            <h1 className="font-display text-3xl leading-[1.05] sm:text-4xl lg:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{summary}</p>
          </div>
          <div className="flex flex-col items-start gap-2 text-xs text-muted-foreground lg:items-end">
            <span>Última atualização</span>
            <strong className="text-foreground">{updated}</strong>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[1.35rem] border border-border/70 bg-card/55 p-3">
            <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Documentos</p>
            <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {legalLinks.map(([to, label]) => (
                <Link
                  key={to}
                  to={to}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                >
                  <span>{label}</span><ChevronRight className="size-4" />
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <article className="min-w-0 space-y-4">{children}</article>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-[1.35rem] border border-border/70 bg-card/55 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BookOpenCheck className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold">Ainda ficou com alguma dúvida?</p>
            <p className="text-xs text-muted-foreground">Fale com a equipe pelo formulário de contato.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1 sm:flex-none"><Link to="/"><ArrowLeft className="size-4" /> Início</Link></Button>
          <Button asChild className="flex-1 sm:flex-none"><Link to="/contato">Falar com a equipe</Link></Button>
        </div>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.35rem] border border-border/70 bg-card/55 p-5 sm:p-6 lg:p-7">
      <h2 className="font-display text-xl sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground [&_strong]:text-foreground [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal">{children}</div>
    </section>
  );
}
