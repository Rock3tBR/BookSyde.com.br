import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, FileCheck2, ShieldCheck } from "lucide-react";

import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/direitos-autorais")({
  head: () => ({ meta: [{ title: "Direitos autorais — BookSyde" }] }),
  component: CopyrightPage,
});

function CopyrightPage() {
  return (
    <LegalPageLayout
      eyebrow="Proteção de conteúdo"
      title="Direitos autorais e denúncias"
      summary="O Marketplace é destinado a conteúdo próprio ou autorizado. Titulares e usuários podem solicitar análise de material possivelmente irregular."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          [ShieldCheck, "Publicação responsável", "Criadores declaram a base dos direitos antes de publicar no Marketplace."],
          [AlertTriangle, "Denúncia e análise", "Anúncios denunciados podem ser colocados em revisão enquanto a equipe verifica o caso."],
          [FileCheck2, "Histórico preservado", "Remover um anúncio não apaga registros necessários para pedidos, suporte e auditoria."],
        ].map(([Icon, title, text]) => {
          const C = Icon as typeof ShieldCheck;
          return <div key={String(title)} className="rounded-[1.35rem] border border-border/70 bg-card/55 p-5"><C className="size-5 text-primary" /><p className="mt-4 text-sm font-semibold">{String(title)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{String(text)}</p></div>;
        })}
      </section>

      <LegalSection title="Conteúdo do Catálogo público">
        <p>Obras conhecidas e protegidas por direitos autorais podem aparecer no Catálogo apenas como referência e descoberta. Quando o usuário não possui o arquivo, o BookSyde não libera a leitura e pode indicar uma fonte externa licenciada ou conteúdos semelhantes do Marketplace.</p>
      </LegalSection>
      <LegalSection title="Conteúdo do Marketplace">
        <p>Vendedores devem possuir os direitos ou a autorização necessária para comercializar cada obra. O formulário de criação registra se o vendedor declara ser autor, editora/distribuidor autorizado ou licenciado para distribuição.</p>
      </LegalSection>
      <LegalSection title="Como denunciar">
        <p>Se o anúncio estiver aberto no Marketplace, use a opção <strong>Denunciar anúncio</strong> na página do produto. Para solicitações de titular de direitos, casos sem anúncio disponível ou documentação adicional, use o formulário de contato com o assunto “Direitos autorais”.</p>
        <Button asChild size="sm"><Link to="/contato" search={{ topic: "copyright" }}>Enviar solicitação de direitos autorais</Link></Button>
      </LegalSection>
      <LegalSection title="O que informar">
        <ul>
          <li>identificação da obra ou conteúdo;</li>
          <li>link da página ou anúncio questionado;</li>
          <li>relação do solicitante com os direitos envolvidos;</li>
          <li>explicação clara do problema e, quando possível, evidências relevantes.</li>
        </ul>
        <p>Podemos pedir informações adicionais antes de tomar uma decisão definitiva.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
