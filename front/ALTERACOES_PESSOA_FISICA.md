# Recebimentos somente para Pessoa Física

O onboarding de vendedores foi simplificado para aceitar somente pessoa física neste momento.

## Alterações

- Novas contas Stripe Connect são criadas com `business_type: "individual"`.
- O setor é preenchido automaticamente com MCC `5815` (Digital Goods Media — Books, Movies, Music).
- A página pública do vendedor no MangakaLib é enviada como site do vendedor.
- A descrição do negócio é pré-preenchida como venda de livros, mangás, HQs e conteúdos digitais autorais.
- O usuário não escolhe mais entre pessoa física e empresa no MangakaLib.
- A Central do Vendedor agora usa a linguagem "Ativar recebimentos" e informa que CNPJ não é necessário.
- Contas antigas iniciadas como empresa e ainda não ativas são substituídas automaticamente por uma nova conta individual quando o onboarding é iniciado novamente.
- Uma conta empresarial já ativa em produção não é substituída automaticamente para evitar perda de vínculo com pagamentos existentes.

## Banco de dados

Nenhuma migration SQL é necessária para esta alteração.
