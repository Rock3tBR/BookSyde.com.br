import { createFileRoute } from "@tanstack/react-router";

import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — BookSyde" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Política de Privacidade"
      summary="Explicamos quais dados são usados para operar sua conta, biblioteca, compras, recursos sociais e Marketplace."
    >
      <LegalSection title="Dados que tratamos">
        <ul>
          <li>dados de conta e perfil, como e-mail, apelido, avatar e telefone opcional;</li>
          <li>dados de uso, leitura, biblioteca, favoritos e preferências;</li>
          <li>telefone opcional, armazenado de forma privada para futuros recursos de contato, mediante informação prévia antes de qualquer novo uso;</li>
          <li>pedidos, compras, códigos de entrega, solicitações de suporte e denúncias;</li>
          <li>dados técnicos necessários para segurança, prevenção de abuso e funcionamento do serviço.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Pagamentos e vendedores">
        <p>Pagamentos do Marketplace são processados pela Stripe. Dados de cartão e informações de verificação financeira são coletados diretamente pela Stripe quando aplicável; o BookSyde não precisa armazenar o número completo do seu cartão.</p>
        <p>Vendedores podem precisar fornecer dados de identidade, empresa e conta bancária à Stripe para concluir o onboarding e receber pagamentos.</p>
      </LegalSection>
      <LegalSection title="Como usamos os dados">
        <p>Usamos as informações para autenticar usuários, sincronizar a biblioteca, proteger conteúdos, processar pedidos, liberar compras, oferecer suporte, prevenir fraude, moderar o Marketplace e melhorar a experiência.</p>
      </LegalSection>
      <LegalSection title="Compartilhamento necessário">
        <p>Podemos compartilhar os dados estritamente necessários com prestadores que operam partes do serviço, como autenticação, hospedagem, armazenamento e pagamentos. Também podemos atender obrigações legais ou solicitações válidas de autoridades e titulares de direitos.</p>
      </LegalSection>
      <LegalSection title="Seus controles">
        <p>Você pode atualizar informações da conta e preferências dentro do sistema. Para solicitações de acesso, correção, exclusão ou outras questões de privacidade, use a página de Contato e selecione o assunto “Privacidade”.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
