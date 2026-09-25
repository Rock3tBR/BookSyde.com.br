import { createFileRoute } from "@tanstack/react-router";

import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de Uso — BookSyde" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPageLayout
      title="Termos de Uso"
      summary="As regras essenciais para usar o Catálogo, a Biblioteca, o Estúdio e o Marketplace do BookSyde."
    >
      <LegalSection title="1. Como o BookSyde funciona">
        <p>O BookSyde reúne recursos de leitura, organização de biblioteca e um marketplace de publicações digitais.</p>
        <p><strong>Catálogo público:</strong> pode apresentar obras para descoberta e referência. Uma obra aparecer no Catálogo não significa que seu arquivo esteja liberado para leitura ou venda pelo BookSyde.</p>
        <p><strong>Marketplace:</strong> reúne conteúdos oferecidos por criadores ou vendedores que declaram possuir os direitos, licenças ou autorizações necessários para comercializá-los.</p>
      </LegalSection>
      <LegalSection title="2. Conta e biblioteca">
        <p>Você é responsável por manter sua conta segura e por utilizar os recursos da plataforma de forma lícita. O acesso a arquivos protegidos depende de um direito válido, como criação própria, compra confirmada, convite autorizado ou importação legítima para sua biblioteca.</p>
      </LegalSection>
      <LegalSection title="3. Compras no Marketplace">
        <p>Cada compra é realizada com um único vendedor. O valor e os itens são congelados quando o pedido é criado. O pagamento é processado pela Stripe e a liberação do conteúdo ocorre somente após a confirmação do pagamento pelo servidor.</p>
        <p>Os códigos de importação são pessoais, de uso único e não devem ser compartilhados. O registro da compra permanece associado à conta mesmo depois do código ser consumido.</p>
      </LegalSection>
      <LegalSection title="4. Conteúdo enviado por usuários">
        <p>É proibido publicar material pirateado, ilícito, enganoso ou que viole direitos autorais, marcas, imagem, privacidade ou outros direitos de terceiros. Podemos revisar, ocultar ou remover anúncios e suspender contas quando necessário para proteger usuários, titulares de direitos e a plataforma.</p>
      </LegalSection>
      <LegalSection title="5. Disponibilidade e mudanças">
        <p>Podemos ajustar funcionalidades, regras técnicas e mecanismos de segurança para manter o serviço confiável. Mudanças relevantes nestes termos serão publicadas nesta página com a data de atualização.</p>
      </LegalSection>
      <LegalSection title="6. Contato e solução de problemas">
        <p>Use a página de Contato para dúvidas sobre conta, pagamentos, Marketplace ou privacidade. Questões de direitos autorais devem usar a página específica de Direitos autorais.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
