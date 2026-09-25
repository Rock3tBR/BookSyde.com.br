# Mapa Literário — sem foto + locais próximos

- `photo_url` agora pode ser `NULL` no frontend sem quebrar imagens.
- Cards sem foto usam fallback visual com iniciais do estabelecimento.
- Pins sem foto usam marcador com iniciais, sem ícone de imagem quebrada.
- Popup do mapa também possui fallback visual.
- Botão `Perto de mim` usa a geolocalização do navegador.
- Quando a localização está disponível, a lista é ordenada por distância.
- A localização aprovada é lembrada por até 6 horas para evitar prompts repetidos.
- Se a permissão não estiver disponível, o mapa continua abrindo na visão geral do Brasil.
- A lista agora usa somente `literary_places` do Supabase; a curadoria hardcoded foi removida.
