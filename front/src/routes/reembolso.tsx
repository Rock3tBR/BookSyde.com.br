import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reembolso")({
  head: () => ({ meta: [{ title: "Política de Reembolso — BookSyde" }] }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <LegalPageLayout
      title="Política de Reembolso"
      summary="Como solicitar análise de uma compra digital e acompanhar a decisão dentro do BookSyde."
    >
      <LegalSection title="Como solicitar">
        <p>Abra <strong>Minhas compras</strong>, localize o pedido pago e use “Solicitar reembolso”. Informe o motivo e detalhes suficientes para análise.</p>
        <Button asChild size="sm"><Link to="/compras">Abrir minhas compras</Link></Button>
      </LegalSection>
      <LegalSection title="Análise">
        <p>Pedidos são avaliados considerando o motivo apresentado, o estado da entrega, eventual uso do conteúdo e a legislação aplicável. Direitos obrigatórios do consumidor continuam valendo quando aplicáveis.</p>
        <p>Enviar uma solicitação não significa aprovação automática. Você poderá acompanhar o status no próprio pedido.</p>
      </LegalSection>
      <LegalSection title="Conteúdo após reembolso">
        <p>Quando um reembolso for efetivamente concluído, o acesso relacionado àquela compra poderá ser revogado quando tecnicamente e juridicamente aplicável. Registros necessários para auditoria financeira e prevenção de fraude podem ser preservados.</p>
      </LegalSection>
      <LegalSection title="Compras fora do BookSyde">
        <p>Se o Catálogo encaminhar você para uma loja ou editora licenciada externa, a compra é realizada fora do BookSyde e segue a política de reembolso daquele estabelecimento.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
