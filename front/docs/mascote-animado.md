# Mascote animado do BookSyde

`BooksydeMascot` reproduz 48 desenhos completos em um ciclo de leitura de quatro segundos: observar, piscar, alcançar a folha com a asa, virar a página e voltar à leitura. A arte foi gerada pela ferramenta integrada `image_gen`, usando a referência enviada como identidade principal. Não é uma reprodução pixel a pixel de um arquivo de animação original.

`CrowDownloadAnimation` usa esse componente em todos os estados do indicador de download. Texto e ícones continuam comunicando o estado real. A mudança de progresso não troca a arte nem interrompe o gesto. O ciclo implementado é o de leitura; não inclui todas as ações da prancha, como transportar livros ou caminhar.

Cada quadro contém o personagem inteiro. Não há transformação do cartão nem recortes sobrepostos de uma imagem estática. O sprite é local e compartilhado entre as instâncias, sem player ou serviço externo em produção. A reprodução pausa fora da tela e em abas ocultas. Com `prefers-reduced-motion`, o primeiro quadro permanece visível.

## Arquivos

- `public/brand/mascot/reading-frames-v3.png`: prancha gerada original, 1448 × 1086, 8 colunas × 6 linhas.
- `public/brand/mascot/reading-frames-v3.webp`: versão usada pelo aplicativo.
- `public/brand/mascot/reading-loop-v3.webm`: prévia em vídeo, com fundo marfim.
- `src/components/BooksydeMascot.tsx`: componente compartilhado.
- `tests/mascot.html`: prévia interativa no servidor de testes.

As células têm 181 × 181 pixels, adequadas aos indicadores pequenos. A prévia ampliada não acrescenta resolução. A fidelidade absoluta do modelo e o acabamento de uma produção tradicional exigem revisão artística dos quadros gerados com IA.

## Exportação e validação

Na raiz: `node front/scripts/export-mascot.mjs`. Usa Chromium local para alinhar os quadros pela linha de chão, converter a prancha para WebP, gravar a prévia WebM e produzir os passos CSS. Não gera novamente a arte. O vídeo captura a sequência a 24 fps, com 12 desenhos distintos por segundo.

Em `front`: `npx playwright test tests/mascot.spec.ts`. Verifica reprodução, mudança de status, movimento reduzido, pausa fora da tela/aba e exibição mobile.

## Prompt de criação

Ferramenta: `image_gen.imagegen` integrada. Referências: a prancha enviada pelo usuário, seguida do modelo antigo do projeto e de seu recorte de leitura. Especificação do prompt utilizado:

> Create a production animation sprite atlas, not a storyboard. Prioritize the user's 16-panel reference of the black crow with cream eyes and dark pupils, orange scarf, brown satchel, reading orange-brown books. Output a PNG sprite sheet, 3072 by 2304 if possible, exactly 8 columns and 6 rows, 48 equal square cells in row-major order. Keep framing, scale, camera and floor baseline consistent. Every cell shows the same full-body official BookSyde crow reading the same book, satchel visible, scarf intact. No panels, gutters, borders, writing, numbers or other characters. These are consecutive in-between frames of one seamless calm reading/page-turn animation. Frames 1–8: gentle breathing, gaze follows page, natural blink. Frames 9–14: anticipation, shoulder initiates, elbow folds, wing reaches page corner, torso counterbalances. Frames 15–27: catch one cream page and guide it across the book in a curling arc; eyes follow, head inclines, scarf and satchel lag. Frames 28–35: page settles, wing returns through intermediary elbow poses, shoulder settles. Frames 36–42: quiet satisfaction, blink, scarf settling. Frames 43–48: recover to frame 1 pose. Traditional hand-drawn 2D texture matching the reference, consistent anatomy and colors, no 3D or whole-character rotation/translation/zoom. Animate wings, eyelids, pupils, head, paper and scarf in the drawn frames. No missing/extra limbs, changing clothes or morphing book. Keep each character within its cell with clear margin.
