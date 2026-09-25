import { Route } from "@/routes/contato";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Mail, MessageSquareText, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";



const topics = [
  ["general", "Dúvida geral"],
  ["payment", "Pagamento"],
  ["seller", "Marketplace / vendedor"],
  ["refund", "Reembolso"],
  ["copyright", "Direitos autorais"],
  ["privacy", "Privacidade"],
  ["other", "Outro assunto"],
] as const;

export function ContactPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { topic: initialTopic } = Route.useSearch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(initialTopic);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!name && profile?.display_name) setName(profile.display_name);
    if (!email && user?.email) setEmail(user.email);
  }, [profile?.display_name, user?.email, name, email]);

  const sendRequest = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("create_support_request", {
        _name: name.trim(),
        _email: email.trim(),
        _topic: topic,
        _subject: subject.trim(),
        _message: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSent(true);
      setSubject("");
      setMessage("");
      toast.success("Solicitação enviada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <LegalPageLayout
      eyebrow="Suporte"
      title="Fale com a equipe"
      summary="Use este canal para dúvidas de conta, pagamentos, Marketplace, privacidade ou direitos autorais."
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[1.35rem] border border-border/70 bg-card/55 p-5 sm:p-6 lg:p-7">
          {sent ? (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Recebemos sua solicitação.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">O pedido foi registrado no sistema para acompanhamento.</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="contact-name">Nome</Label><Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></div>
            <div className="space-y-1.5"><Label htmlFor="contact-email">E-mail</Label><Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-topic">Assunto</Label>
              <select id="contact-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {topics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="contact-subject">Título</Label><Input id="contact-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumo da solicitação" /></div>
          </div>
          <div className="mt-4 space-y-1.5"><Label htmlFor="contact-message">Mensagem</Label><Textarea id="contact-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={7} placeholder="Explique o que aconteceu e inclua informações que ajudem na análise." /></div>
          <Button className="mt-5 w-full rounded-xl sm:w-auto" disabled={sendRequest.isPending || !name.trim() || !email.trim() || !subject.trim() || message.trim().length < 10} onClick={() => sendRequest.mutate()}>
            <Send className="size-4" /> {sendRequest.isPending ? "Enviando…" : "Enviar solicitação"}
          </Button>
        </div>

        <aside className="space-y-3">
          <div className="rounded-[1.35rem] border border-border/70 bg-card/55 p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Mail className="size-5" /></span>
            <p className="mt-4 text-sm font-semibold">Inclua contexto</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Para pagamentos ou Marketplace, informe o número do pedido quando tiver. Para direitos autorais, identifique a obra e o motivo da solicitação.</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/70 bg-card/55 p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><MessageSquareText className="size-5" /></span>
            <p className="mt-4 text-sm font-semibold">Não envie dados sensíveis</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Nunca envie senha, número completo de cartão ou credenciais privadas pelo formulário.</p>
          </div>
        </aside>
      </section>

      <LegalSection title="Pedidos relacionados ao Marketplace">
        <p>Se o problema estiver ligado a uma compra existente, prefira abrir o pedido em <strong>Minhas compras</strong>. Isso mantém a solicitação associada ao pedido correto.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
