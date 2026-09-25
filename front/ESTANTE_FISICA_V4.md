# Estante Física V4

- Cada fileira agora é uma prateleira independente.
- A largura disponível é medida automaticamente com ResizeObserver.
- Quando o próximo livro/pilha não cabe na fileira atual, uma nova prateleira é criada abaixo.
- Livros deitados continuam agrupados em pilhas de no máximo 3.
- O cálculo considera a largura proporcional detectada pelo scanner.
- O comportamento se adapta ao mobile, tablet e desktop.
