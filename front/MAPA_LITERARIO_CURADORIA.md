# Mapa Literário — curadoria inicial

Esta versão adiciona uma base inicial de 17 sebos, livrarias e comic shops reais em diferentes regiões do Brasil.

## Comportamento

- Os locais da curadoria aparecem mesmo quando a tabela `literary_places` ainda está vazia.
- Locais cadastrados pelos usuários no Supabase continuam aparecendo normalmente.
- Se existir um cadastro da comunidade com o mesmo nome de um local da curadoria, o cadastro da comunidade tem prioridade.
- Os locais da curadoria são identificados como **Curadoria MangakaLib** e não podem ser confirmados ou avaliados como se fossem registros do banco.
- Endereços da curadoria são refinados com a geocodificação do Mapbox na primeira abertura e armazenados no `localStorage`.
- Se a geocodificação estiver indisponível, existe uma coordenada de fallback para manter o mapa funcional.

## Zoom inicial

O zoom inicial foi alterado de `4.1` para `5.15` e o centro foi ajustado para o Brasil. O mapa não executa mais `fitBounds` de todos os locais na primeira abertura, pois isso deixava a visualização distante demais com pontos espalhados pelo país.

Ao pesquisar ou usar um filtro, o `fitBounds` continua sendo usado normalmente para aproximar os resultados encontrados.

## Arquivos alterados

- `src/routes/mapa-literario.tsx`
- `src/data/curatedLiteraryPlaces.ts` (novo)

Nenhuma alteração de banco de dados é necessária para a curadoria inicial.
