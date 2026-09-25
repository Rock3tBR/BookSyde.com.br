# Mangaka — otimização e modularização

## O que foi alterado

- **Carregamento sob demanda (code splitting):** 42 declarações de rotas agora utilizam `lazyRouteComponent`. Home, Biblioteca, Estúdio, administração, editoras, vendas, Marketplace, mapa, leitor, perfil, planos e demais telas deixam de importar suas interfaces completas durante a inicialização da árvore de rotas. As páginas ficam em `src/pages/`, enquanto `src/routes/` conserva os metadados e os parâmetros das URLs originais. Componentes de administração/editoras/vendedores são compartilhados entre suas rotas.
- **Recursos opcionais:** tutorial de navegação carregado somente na primeira solicitação de ajuda (`TutorialGate`); experiência offline carregada somente quando o dispositivo está sem conexão (`OfflineGate`); leitor EPUB carregado apenas para conteúdo EPUB. A raiz do sistema não importa mais o processador de uploads de arquivos.
- **Uploads:** status e eventos em `src/lib/volumeUploadStatus.ts`; processamento pesado permanece em `src/lib/volumeUpload.ts`; funções puras de lotes em `src/lib/uploadBatchUtils.ts`.
- **Funções compartilhadas:** `src/integrations/supabase/api-key-fetch.ts` centraliza o adaptador de requisições repetido nos três clientes do Supabase. `src/lib/numberFormat.ts`, `src/lib/priceInput.ts`, `src/lib/tutorialEvents.ts` e `src/lib/literaryMapShared.ts` extraem outras funções/constantes repetidas ou separáveis.
- **Arquivos menores:** seção da Home em `src/components/HomeSections.tsx`; componentes da personalização em `src/components/AccountSettingsControls.tsx`; conteúdo do tutorial em `src/lib/tutorialSteps.ts`; painéis do mapa em `src/components/LiteraryMapPanels.tsx`. O arquivo da página de mapa foi reduzido para menos de 1.000 linhas.
- **Imagens e cache:** URLs assinadas das capas recebem cache de consulta durante sua validade; logo tem dimensões declaradas e decodificação assíncrona; arquivos JS/CSS destinados à leitura offline deixam de ser novamente baixados quando já estão no Cache Storage e somente são preparados para quem possui livros offline. O fluxo de download prepara os módulos de leitor necessários antes de armazenar os recursos da aplicação.

## Comparativo — arquivo de definição da rota (código-fonte, não bundle gerado)

| Rota | Antes | Depois |
| --- | ---: | ---: |
| `index.tsx` | 49.837 bytes | 736 bytes |
| `admin.tsx` | 157.862 bytes | 790 bytes |
| `mapa-literario.tsx` | 76.112 bytes | 558 bytes |
| `ler.$volumeId.tsx` | 52.269 bytes | 650 bytes |
| `manga.$slug.tsx` | 58.210 bytes | 793 bytes |
| `marketplace.tsx` | 34.146 bytes | 902 bytes |
| `conta.tsx` | 42.934 bytes | 577 bytes |

**Importante:** os tamanhos acima são dos arquivos de definição da rota. O conteúdo das páginas foi movido para módulos carregados quando necessário, **não excluído**. Não representam tamanho de bundle, tempo de carregamento ou economia de rede medida. Após instalar as dependências, o Vite precisa gerar o build de produção para comparar arquivos transferidos, requests e Web Vitals.

## Sobre o objetivo de 1.000 linhas

Grande parte das telas e dos arquivos refatorados está abaixo de 1.000 linhas. Preservados acima do limite: `src/pages/admin.tsx` (interface de administração altamente interdependente), `src/pages/ler.$volumeId.tsx`, `src/pages/manga.$slug.tsx`, `src/lib/volumeUpload.ts` (orquestração de uploads), além dos arquivos **gerados automaticamente** `src/integrations/supabase/types.ts` e `src/routeTree.gen.ts`, e `src/styles.css` (31 linhas acima). Fragmentar esses arquivos exclusivamente pela contagem de linhas, sem validação funcional das telas e do build, criaria risco desnecessário. O carregamento sob demanda já evita que as três interfaces grandes sejam importadas nas demais páginas. Nunca edite manualmente os dois arquivos gerados: são reescritos pelas respectivas ferramentas.

## Validação executada

- 218 arquivos TypeScript/TSX/JavaScript analisados, sem erros de sintaxe, imports locais inexistentes ou exports ausentes na validação estática.
- 42 componentes referenciados pelas rotas dinâmicas localizados corretamente.
- Testes isolados existentes `profile-separation.cjs`, `profile-phone.cjs` e `social-search-regression.cjs` passaram.
- **Limite da validação:** dependências do npm indisponíveis neste ambiente; `npm run build` retornou `vite: not found`. Não foi possível compilar o bundle, executar o Playwright, medir tempo real, validar a produção ou garantir funcionamento completo em todos os aparelhos. O projeto mantém `package-lock.json` e `package.json` originais.

## Comandos para validar no projeto com as dependências disponíveis

```bash
npm ci
npm run build
npx tsc --noEmit
npm run test
```

Se sua implantação usa o Lovable, confirme que a sincronização respeita os novos caminhos `src/pages/` e `src/components/`. Verifique em especial login, perfil, compra, edição/publicação, mobile, mapa e leitura offline. Compare a aba **Network** e o **Lighthouse** do navegador antes/depois com o mesmo aparelho e conexão. A refatoração foi planejada para reduzir o código inicial, mas nenhum percentual de desempenho está sendo prometido sem essas medições.
