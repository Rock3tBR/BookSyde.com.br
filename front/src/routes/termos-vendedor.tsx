import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/termos-vendedor")({
  head: () => ({ meta: [{ title: "Termos do Vendedor — BookSyde" }] }),
  component: SellerTermsPage,
});

function SellerTermsPage() {
  return (
    <LegalPageLayout
      eyebrow="Marketplace"
      title="Termos do Vendedor"
      summary="Regras para publicar, vender e receber por conteúdo digital no Marketplace do BookSyde."
    >
      <LegalSection title="Direitos sobre o conteúdo">
        <p>Ao publicar uma obra, você declara ser <strong>autor</strong>, <strong>editora/distribuidor autorizado</strong> ou possuir <strong>licença de distribuição</strong> suficiente para hospedá-la e comercializá-la.</p>
        <p>Não publique cópias não autorizadas de mangás, HQs, livros, gibis ou qualquer outro material protegido por direitos de terceiros.</p>
      </LegalSection>
      <LegalSection title="Stripe Connect e recebimentos">
        <p>Para receber pagamentos, o vendedor deve concluir o onboarding da Stripe e manter sua conta conectada apta a receber cobranças. Informações de identidade, empresa e dados bancários podem ser solicitadas diretamente pela Stripe.</p>
      </LegalSection>
      <LegalSection title="Pedidos e entrega">
        <p>O vendedor não pode marcar pedidos manualmente como pagos. O status financeiro é atualizado a partir da confirmação do provedor de pagamentos. Após a confirmação, o BookSyde gera os direitos de acesso e códigos de importação do comprador.</p>
      </LegalSection>
      <LegalSection title="Moderação">
        <p>Anúncios podem ser colocados em análise, removidos ou desativados. Contas podem ser suspensas quando houver risco, fraude, reincidência, denúncia fundamentada ou violação das regras da plataforma.</p>
      </LegalSection>
      <LegalSection title="Reembolsos e suporte">
        <p>Solicitações de reembolso podem exigir colaboração do vendedor. O histórico do pedido é preservado para auditoria e suporte mesmo quando o anúncio original for removido.</p>
        <Button asChild size="sm"><Link to="/marketplace/vendedor">Ir para a Central do vendedor</Link></Button>
      </LegalSection>
    </LegalPageLayout>
  );
}
