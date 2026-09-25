# PT-BR / English + conteúdo bilíngue

## Banco de dados
Execute a migration `supabase/migrations/20260918114500_bilingual_content.sql` no Supabase antes de publicar esta versão.

A migration adiciona:
- `mangas.primary_language`
- `mangas.available_languages`
- `volumes.language`
- sincronização automática dos idiomas disponíveis da obra a partir dos volumes enviados.

Conteúdo antigo é mantido como `pt-BR`.

## Como publicar o mesmo livro em dois idiomas
No Estúdio, selecione a obra e envie a edição PT-BR com `Idioma desta edição = Português (Brasil)`. Depois envie o mesmo número/volume novamente com `Idioma desta edição = English`.

O catálogo passa a marcar a obra como bilíngue. Na página da obra e no leitor, o usuário pode alternar a edição. O idioma do sistema fica em primeiro lugar automaticamente. Ex.: sistema em English => English primeiro e PT-BR como alternativa.

## Site/app
O seletor global PT-BR / English continua no header desktop e mobile. A preferência fica salva no navegador/PWA. Textos dinâmicos, placeholders, títulos e labels passam pelo provider global de tradução.

## Preço / Stripe
- PT-BR: exibição/cobrança em BRL.
- English: exibição/cobrança em USD.
- USD usa a conversão comercial com margem configurável, não conversão seca.
- Checkout hospedado e embedded recebem o idioma selecionado.

Configuração:
`VITE_USD_BRL_REFERENCE_RATE=5.2`
`VITE_INTERNATIONAL_PRICE_MARGIN=0.35`

## Observação de build
As dependências não terminaram de instalar no ambiente de empacotamento, portanto o build Vite não pôde ser concluído aqui. Rode `npm ci` e `npm run build` no ambiente do projeto antes do deploy.
