# MangakaLib — Responsividade Mobile

Este pacote contém somente os arquivos alterados para a revisão mobile.

## Comportamento solicitado

Na Home, quando não existe nenhuma leitura em andamento (`continueReading.length === 0`):

- **Continue lendo** fica invisível em telas mobile/tablet menores que `lg`.
- **Leitura de hoje** também fica invisível nessas telas.
- No desktop os dois blocos continuam aparecendo normalmente.
- Assim que existe uma leitura em andamento, os dois blocos voltam a aparecer no mobile.

## Melhorias gerais

- Header mais compacto em telas estreitas.
- Campo de busca não fica espremido em celulares pequenos.
- Menu lateral respeita safe-area do iPhone/PWA e pode rolar verticalmente.
- Dialogs passam a caber dentro da viewport e rolam internamente quando necessário.
- Sheets usam até 92% da largura no mobile.
- Home tem hero mais baixo e melhor aproveitamento vertical.
- Cards do catálogo usam largura relativa à tela no mobile.
- Continue lendo vira uma lista horizontal com snap quando houver leituras.
- Biblioteca ganhou resumo 2x2 no mobile, títulos e espaçamentos menores.
- Conta, detalhe da obra, planos, social e Estúdio/Admin ganharam espaçamento e tipografia responsivos.
- Abas do Estúdio/Admin podem rolar horizontalmente em celulares estreitos.
- Leitor usa 2 colunas de controles em telas muito pequenas e 3 em celulares maiores.
- Ajustes globais evitam overflow horizontal e zoom automático de inputs no Safari/iOS.
- Safe-area inferior foi considerada nas principais páginas para não conflitar com o dock da comunidade.

## Como aplicar

### Opção 1 — substituir os arquivos

Copie a pasta `src` deste pacote sobre a pasta `src` do projeto.

### Opção 2 — aplicar o patch Git

O arquivo `mangakalib-mobile-responsive.patch` foi gerado separadamente. Na raiz do projeto:

```bash
git apply mangakalib-mobile-responsive.patch
```

Depois:

```bash
git status
git add .
git commit -m "Ajusta responsividade mobile"
git push origin main
```

## Validação

Os arquivos foram validados com:

```bash
npx tsc --noEmit
```

O typecheck passou. O `npm run build` não pôde ser concluído neste ambiente porque o `node_modules` do ZIP não contém o binding nativo Linux do Rolldown. Isso é um problema do ambiente/dependências extraídas, não um erro TypeScript das alterações.

## Mapa Literário (Mapbox GL JS)

A rota `/mapa-literario` usa Mapbox GL JS pelo CDN oficial. Para ativar o mapa e o cálculo de rotas, adicione um token público do Mapbox no seu `.env`:

```env
VITE_MAPBOX_ACCESS_TOKEN=pk.seu_token_publico_aqui
```

Depois, aplique a migration `supabase/migrations/20260911201500_literary_map.sql` no Supabase. Ela cria os locais, confirmações, avaliações e o bucket público `literary-place-photos`.

O Mapbox Directions oferece perfis oficiais para carro, caminhada e bicicleta. Nesta implementação, carro e caminhada usam rotas Mapbox reais. Moto e ônibus aparecem como estimativas visuais baseadas na rota viária, e a interface deixa essa limitação explícita para não apresentar o tempo aproximado como dado oficial de transporte público.
