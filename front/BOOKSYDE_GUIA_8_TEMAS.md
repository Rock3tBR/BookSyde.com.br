# BookSyde — 8 temas graduais

## Objetivo

Os oito temas do aplicativo passam a usar a mesma linguagem editorial da tela de login: papel creme (`#FFFDF5`), verde-petróleo (`#125E60`), laranja queimado (`#C5521C`) e versões de café, cobre e tinta. A tela de login (`src/pages/auth.css`) permanece visualmente independente e não foi modificada.

## Ordem da seleção

| Nº | Nome | Identificador no banco | Fundo | Card | Texto | Botão principal | Texto do botão | Modo da interface |
|---:|---|---|---|---|---|---|---|---|
| 01 | Claro | `light` | `#FFFDF5` | `#FFFEF8` | `#171B1A` | `#A84318` | `#FFFFFF` | Claro |
| 02 | Baunilha | `vanilla` | `#F4EADB` | `#FFF7EB` | `#29231D` | `#99401C` | `#FFFFFF` | Claro |
| 03 | Latte | `latte` | `#E5D7C4` | `#F2E7D7` | `#30271F` | `#8D3B1A` | `#FFFFFF` | Claro |
| 04 | Cappuccino | `cappuccino` | `#B5A08A` | `#D1BBA5` | `#2B211B` | `#743619` | `#FFFFFF` | Claro |
| 05 | Mocha | `mocha` | `#54473E` | `#645248` | `#F7EFE2` | `#F0B181` | `#2C1B10` | Escuro |
| 06 | Espresso | `coffee` | `#352A25` | `#45362F` | `#F7F0E8` | `#F1B787` | `#29190F` | Escuro |
| 07 | Petróleo | `dark` | `#202A28` | `#2A3733` | `#F4F3EC` | `#F0AA79` | `#231B15` | Escuro |
| 08 | Noite absoluta | `midnight` | `#0B100F` | `#141D1A` | `#F5F7EF` | `#FFBA87` | `#24160E` | Escuro |

**Por que o tema 04 não é escuro?** O Cappuccino ainda tem texto escuro sobre superfícies claras. A partir do Mocha (05), o fundo escurece e o texto passa a ser claro. O Noite absoluta (08) faz o contraponto ao Claro (01).

## O que foi alterado

- `src/styles.css`: 8 paletas completas para fundo, textos, cards, menus, sidebar, botões, popovers, campos, alertas, gráficos, gradientes, bordas e sombras. Mantidas as variáveis Tailwind semânticas.
- `src/lib/theme.ts`: ordem, nomes, descrições e cores de prévia em uma única fonte; alternância correta da classe `.dark` **só nos temas 05–08**; atualização da cor da barra do navegador.
- `src/components/ThemePicker.tsx`: novo seletor com prévia em miniatura usando os valores reais de fundo, card, texto e botão; separado em claros e escuros.
- `src/pages/conta.tsx` e `src/components/FirstVisitPreferences.tsx`: usam exatamente o mesmo seletor, evitando prévias divergentes.
- `src/routes/__root.tsx`: cor inicial da barra do navegador ajustada ao tema escuro padrão.
- `sql/repair/01_cadastro_preferencias.sql`: restrição de temas compatível caso o script de reparo volte a ser utilizado.
- `supabase/migrations/20260921110000_booksyde_oito_temas.sql`: migração do banco; também disponibilizada no arquivo `SQL_EDITOR_8_TEMAS.sql` na raiz.

## Implantação

1. Faça backup do banco de produção, quando aplicável.
2. Execute **todo** o conteúdo de `SQL_EDITOR_8_TEMAS.sql` no SQL Editor do projeto Supabase/Lovable. Em ambientes com migrações automáticas, aplique **uma única vez** a migração correspondente em `supabase/migrations/` (os arquivos contêm o mesmo SQL).
3. Publique o código atualizado. No painel **Personalização → Exibição do catálogo → Cor do sistema** e no onboarding, teste a escolha e a gravação de todos os temas.

A migração mantém os identificadores `light`, `dark` e `midnight`. Os identificadores antigos são convertidos: `ocean` → `dark`, `sakura` → `vanilla`, `forest` → `dark`, `violet` → `coffee`, `sunset` → `latte`. Valores desconhecidos são normalizados para `dark`. Os outros dados dos perfis, permissões e leitores não são alterados. O valor padrão do banco continua `dark` (agora chamado Petróleo), para não trocar silenciosamente o padrão de novos cadastros.

## Escopo da alteração

A paleta do **site** é independente do fundo escolhido no **leitor de livros** (sépia, cinza ou preto). Imagens/capas e a arte do login não foram recoloridas. Elementos com cores inseridas diretamente no código de recursos específicos também conservam essas cores próprias.
