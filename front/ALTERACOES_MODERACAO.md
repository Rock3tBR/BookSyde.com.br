# Atualização da Moderação — Mangaka

Arquivo modificado: `src/routes/admin.tsx`.

- Lista de obras reestruturada como cartões horizontais com capas completas, nome, autor, tipo e visibilidade. Remove o layout antigo em que capas ficavam comprimidas em tiras.
- Lista com rolagem própria e altura limitada; no celular, ao selecionar uma obra, a página leva o usuário ao painel de detalhes, sem aplicar escala/zoom via JavaScript.
- Painel lateral com capa menor, informações essenciais e quatro ações imediatas, nessa ordem: **Editar**, **Apagar**, **Info** e **Abrir obra**.
- **Info** expande os metadados, contagens, sinopse, descrição, gêneros e dados de compra licenciada (quando disponíveis).
- **Editar** mantém os campos e operações já existentes; **Apagar** continua exigindo o diálogo de confirmação; **Abrir obra** preserva o token de convite de obras por convite.
- O Estúdio preserva as ações extras de gerenciar conteúdo e acesso ao Marketplace.
- Entradas de busca, filtro e campos do modal de edição usam no celular fonte de 16px, evitando o zoom automático do Safari no iPhone causado por fontes menores.

Verificação realizada: análise sintática dos arquivos TypeScript/TSX. **O build completo e a validação visual em dispositivo não foram executados**, pois as dependências não puderam ser baixadas do registro npm neste ambiente. Após instalar as dependências no projeto, rode `npm run build` e confira `/admin` em celular e computador.
