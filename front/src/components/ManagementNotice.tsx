import { AlertCircle } from "lucide-react";
export function ManagementNotice({ title, description }: { title: string; description: string }) {
  return <section className="rounded-2xl border border-border/75 bg-card/65 p-5 sm:p-7" role="status">
    <div className="flex items-start gap-3"><AlertCircle className="mt-1 size-5 shrink-0 text-primary" />
      <div><h2 className="font-display text-xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>
    </div>
  </section>;
}
