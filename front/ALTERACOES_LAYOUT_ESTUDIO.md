# Ajuste de layout do Estúdio — 16/09/2026

- Título geral “Criação e personalização / Estúdio Mangaka” ocultado visualmente, com título acessível para leitores de tela.
- Introdução “Seu espaço criativo” retirada do menu lateral, mantendo as opções.
- Removidas as manchetes duplicadas de Minhas obras, Criar obra e Conteúdo; identificação preservada para tecnologia assistiva, etapas e menus.
- `TabsContent` do Estúdio sem `margin-top` extra: painel e menu começam na mesma altura no desktop.
- Rodapé institucional ocultado exclusivamente no Estúdio; área reservada apenas para o dock fixo de amigos, sem excesso de padding.
- Catálogo sem rolagem própria de altura fixa; apenas rolagem natural da página quando a quantidade de obras exceder o viewport.
- Wizard mais compacto em desktop e celular; mudança de etapa não força scroll quando formulário já está visível.
- Responsividade mantida: menu drawer abaixo de 1024px, opções de formato em duas colunas no celular e quatro em telas maiores, campos em coluna no celular; rolagem preservada se conteúdo ultrapassar a altura disponível (inclusive em zoom e teclado virtual).

## Verificação recomendada em navegador
Abrir /studio nas três seções, em 375×667, 390×844, 768×1024, 1366×768 e 1920×1080; conferir teclado virtual, zoom 200%, navegação de etapas, ações em obras e dock. Não bloquear overflow do body ou reduzir artificialmente altura dos formulários.
