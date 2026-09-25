# Animação do corvo — V2

Correção do indicador de download para não depender de troca de imagens estáticas.

## Alterado
- `front/src/components/CrowDownloadAnimation.tsx`
- `front/public/brand/download/animated/*`

## Ciclo de leitura
O mascote é dividido visualmente em regiões independentes (corpo, cabeça, asa e livro). O loop possui leitura, reação da cabeça, fechamento do livro, movimento da asa, devolução do livro à pilha, retirada do próximo livro e retorno à leitura.

A animação respeita `prefers-reduced-motion`.

## Build
No ambiente de geração deste ZIP as dependências npm não estavam instaladas, portanto o build não pôde ser executado aqui. No projeto local execute `cd front && npm install && npm run build`.
