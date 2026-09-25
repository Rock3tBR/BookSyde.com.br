import type { TutorialChapter } from "@/lib/tutorialEvents";

export type TutorialPath =
  "/" | "/biblioteca" | "/marketplace" | "/mapa-literario" | "/studio" | "/marketplace/vendedor";

export type TutorialPreview = "offline" | "studio" | "seller";

export type TutorialStep = {
  chapter: Exclude<TutorialChapter, "all">;
  path?: TutorialPath;
  selector?: string;
  preview?: TutorialPreview;
  previewSelector?: string;
  eyebrow: string;
  title: string;
  description: string;
  hint?: string;
};

const HOME_STEPS: TutorialStep[] = [
  {
    chapter: "home",
    path: "/",
    selector: '[data-tour="main-navigation"]',
    eyebrow: "Navegação",
    title: "Comece pelo menu principal",
    description:
      "Aqui você acessa a Home, sua Biblioteca, favoritos, Marketplace, Mapa Literário e Planos. A busca também leva direto ao catálogo.",
  },
  {
    chapter: "home",
    path: "/",
    selector: '[data-tour="home-latest"]',
    eyebrow: "Home",
    title: "Novidades e atualizações recentes",
    description:
      "Este destaque reúne obras recém-publicadas e obras que receberam novos volumes ou capítulos recentemente.",
  },
  {
    chapter: "home",
    path: "/",
    selector: '[data-tour="home-continue"]',
    eyebrow: "Home",
    title: "Continue exatamente de onde parou",
    description:
      "Quando existe uma leitura em andamento, ela aparece aqui. O BookSyde salva automaticamente o progresso para você continuar depois.",
    hint: "Se você ainda não começou nenhuma leitura, este bloco fica oculto.",
  },
  {
    chapter: "home",
    path: "/",
    selector: '[data-tour="home-catalog"]',
    eyebrow: "Catálogo",
    title: "Encontre mangás, HQs, gibis e livros",
    description:
      "Filtre por tipo de obra, gênero, popularidade ou favoritos. Ao abrir uma capa, você vê os detalhes, volumes/capítulos e opções de leitura.",
  },
];

const LIBRARY_STEPS: TutorialStep[] = [
  {
    chapter: "library",
    path: "/biblioteca",
    selector: '[data-tour="library-header"]',
    eyebrow: "Biblioteca",
    title: "Sua coleção pessoal",
    description:
      "A Biblioteca reúne obras que você acompanha, leituras em andamento, concluídas, favoritos e suas próprias criações.",
  },
  {
    chapter: "library",
    path: "/biblioteca",
    selector: '[data-tour="library-tabs"]',
    eyebrow: "Biblioteca",
    title: "Separe suas obras por situação",
    description:
      "Use as abas para alternar rapidamente entre tudo que você possui, está lendo, concluiu, favoritou ou criou.",
  },
  {
    chapter: "library",
    path: "/biblioteca",
    selector: '[data-tour="library-offline"]',
    preview: "offline",
    previewSelector: '[data-tour-preview="library-offline"]',
    eyebrow: "Biblioteca",
    title: "Leitura offline",
    description:
      "Volumes baixados para o dispositivo aparecem nesta área e podem ser lidos mesmo quando você estiver sem internet.",
    hint: "Se sua conta ainda não tiver downloads, o tutorial mostra uma prévia de exemplo para você conhecer a função.",
  },
];

const MARKETPLACE_STEPS: TutorialStep[] = [
  {
    chapter: "marketplace",
    path: "/marketplace",
    selector: '[data-tour="marketplace-intro"]',
    eyebrow: "Marketplace",
    title: "Compre diretamente dos criadores",
    description:
      "O Marketplace reúne obras digitais publicadas por criadores e vendedores da plataforma. Você pode conhecer o vendedor antes de comprar.",
  },
  {
    chapter: "marketplace",
    path: "/marketplace",
    selector: '[data-tour="marketplace-sellers"]',
    eyebrow: "Marketplace",
    title: "Conheça os vendedores em destaque",
    description:
      "Os perfis mostram quem publica na plataforma. Ao abrir um vendedor, você vê a loja pública e todos os itens oferecidos por ele.",
  },
  {
    chapter: "marketplace",
    path: "/marketplace",
    selector: '[data-tour="marketplace-catalog"]',
    eyebrow: "Marketplace",
    title: "Filtre, selecione e compre",
    description:
      "Busque por nome, autor, categoria e faixa de preço. Você pode selecionar vários itens do mesmo vendedor e finalizar a compra em conjunto.",
  },
];

const MAP_STEPS: TutorialStep[] = [
  {
    chapter: "map",
    path: "/mapa-literario",
    selector: '[data-tour="map-header"]',
    eyebrow: "Mapa Literário",
    title: "Descubra locais indicados pela comunidade",
    description:
      "O Mapa Literário mostra sebos, livrarias e lojas que vendem mangás, livros, HQs e gibis. Qualquer usuário autenticado pode sugerir um novo local.",
  },
  {
    chapter: "map",
    path: "/mapa-literario",
    selector: '[data-tour="map-list"]',
    eyebrow: "Mapa Literário",
    title: "Busque e filtre os locais",
    description:
      "Na lista você pesquisa pelo nome ou endereço e filtra pelo tipo de estabelecimento. Selecionar um local destaca o respectivo pin no mapa.",
  },
  {
    chapter: "map",
    path: "/mapa-literario",
    selector: '[data-tour="map-canvas"]',
    eyebrow: "Mapa Literário",
    title: "Pins, estilos e rotas",
    description:
      "Os pins representam os locais cadastrados. Você pode alternar o estilo do mapa e usar “Como chegar” para traçar o caminho até o estabelecimento.",
    hint: "As rotas podem comparar carro, moto, caminhada e ônibus quando a opção estiver disponível.",
  },
  {
    chapter: "map",
    path: "/mapa-literario",
    selector: '[data-tour="map-add"]',
    eyebrow: "Mapa Literário",
    title: "Ajude a comunidade adicionando um local",
    description:
      "Informe nome, endereço, foto e o que o estabelecimento vende. Depois de cadastrado, o local passa a fazer parte do mapa da comunidade.",
  },
];

const STUDIO_STEPS: TutorialStep[] = [
  {
    chapter: "studio",
    path: "/studio",
    selector: '[data-tour="studio-header"]',
    preview: "studio",
    previewSelector: '[data-tour-preview="studio-header"]',
    eyebrow: "Área do criador",
    title: "O Estúdio é onde sua obra nasce",
    description:
      "Criadores usam o Estúdio para cadastrar obras, definir capa, descrição, autoria, categorias, direitos de publicação e organizar seus conteúdos.",
    hint: "Mesmo em uma conta Free, o tutorial exibe esta demonstração. O acesso real continua reservado às contas habilitadas como Criador.",
  },
  {
    chapter: "studio",
    path: "/studio",
    selector: '[data-tour="studio-tabs"]',
    preview: "studio",
    previewSelector: '[data-tour-preview="studio-tabs"]',
    eyebrow: "Área do criador",
    title: "Três etapas para publicar",
    description:
      "Em “Minhas obras” você gerencia o que já criou. “Criar obra” cadastra uma nova publicação. “Adicionar conteúdo” envia volumes, capítulos ou livros.",
  },
  {
    chapter: "studio",
    path: "/studio",
    selector: '[data-tour="studio-content"]',
    preview: "studio",
    previewSelector: '[data-tour-preview="studio-content"]',
    eyebrow: "Área do criador",
    title: "Envie o arquivo da publicação",
    description:
      "Nesta etapa você seleciona a obra e adiciona o conteúdo. O sistema aceita os formatos configurados para cada tipo, incluindo PDF, CBR, CBZ, EPUB e outros suportados.",
    hint: "O conteúdo é processado para o leitor adequado sem misturar a publicação com os dados gerais da obra.",
  },
];

const SELLER_STEPS: TutorialStep[] = [
  {
    chapter: "seller",
    path: "/marketplace/vendedor",
    selector: '[data-tour="seller-header"]',
    preview: "seller",
    previewSelector: '[data-tour-preview="seller-header"]',
    eyebrow: "Central do vendedor",
    title: "Acompanhe sua operação de venda",
    description:
      "Esta é a área comercial do criador. Aqui ficam o perfil público da loja, anúncios, pedidos e informações necessárias para receber pelas vendas.",
    hint: "A demonstração aparece para usuários Free durante o tutorial, mas não altera as permissões reais da conta.",
  },
  {
    chapter: "seller",
    path: "/marketplace/vendedor",
    selector: '[data-tour="seller-metrics"]',
    preview: "seller",
    previewSelector: '[data-tour-preview="seller-metrics"]',
    eyebrow: "Central do vendedor",
    title: "Veja os principais números",
    description:
      "Os indicadores resumem faturamento, anúncios ativos, pedidos em aberto e entregas confirmadas para facilitar o acompanhamento da loja.",
  },
  {
    chapter: "seller",
    path: "/marketplace/vendedor",
    selector: '[data-tour="seller-payments"]',
    preview: "seller",
    previewSelector: '[data-tour-preview="seller-payments"]',
    eyebrow: "Central do vendedor",
    title: "Ative seus recebimentos",
    description:
      "O criador cadastra os dados pessoais e a conta de recebimento. A validação financeira é feita com segurança pelo provedor de pagamentos.",
  },
  {
    chapter: "seller",
    path: "/marketplace/vendedor",
    selector: '[data-tour="seller-tabs"]',
    preview: "seller",
    previewSelector: '[data-tour-preview="seller-tabs"]',
    eyebrow: "Central do vendedor",
    title: "Vendas, catálogo e loja",
    description:
      "Em Vendas você acompanha pedidos; em Meu catálogo controla os anúncios; e em Loja personaliza a apresentação pública do vendedor.",
  },
];

const READER_STEPS: TutorialStep[] = [
  {
    chapter: "reader",
    selector: '[data-tour="reader-controls"]',
    eyebrow: "Leitor",
    title: "Controles da leitura",
    description:
      "Os controles mostram a página atual e permitem trocar entre páginas e rolagem. Em livros EPUB você também pode ajustar tamanho da fonte e aparência do papel.",
  },
  {
    chapter: "reader",
    selector: '[data-tour="reader-page"]',
    eyebrow: "Leitor",
    title: "Mangás, HQs e gibis priorizam a página",
    description:
      "Arquivos em páginas, como PDF, CBR e CBZ, são exibidos de forma visual e imersiva. Você pode virar a página ou usar leitura vertical.",
    hint: "O progresso é salvo automaticamente conforme você avança.",
  },
  {
    chapter: "reader",
    selector: '[data-tour="reader-navigation"]',
    eyebrow: "Leitor",
    title: "Navegue e continue depois",
    description:
      "Use Anterior e Próxima para avançar. Ao fechar a leitura, sua última posição fica registrada para continuar do mesmo ponto em outro momento.",
  },
];

export const CHAPTERS: Record<Exclude<TutorialChapter, "all">, TutorialStep[]> = {
  home: HOME_STEPS,
  library: LIBRARY_STEPS,
  marketplace: MARKETPLACE_STEPS,
  map: MAP_STEPS,
  studio: STUDIO_STEPS,
  seller: SELLER_STEPS,
  reader: READER_STEPS,
};

export const ALL_STEPS = [
  ...HOME_STEPS,
  ...LIBRARY_STEPS,
  ...MARKETPLACE_STEPS,
  ...MAP_STEPS,
  ...STUDIO_STEPS,
  ...SELLER_STEPS,
  {
    chapter: "reader" as const,
    eyebrow: "Leitura",
    title: "O leitor se adapta ao tipo de publicação",
    description:
      "Mangás, HQs e gibis usam um leitor visual por páginas. Livros EPUB usam um leitor de texto adaptável. Ao abrir uma leitura, toque no botão de ajuda para ver o tutorial específico do leitor.",
    hint: "Nos dois casos, o progresso é salvo automaticamente.",
  },
] satisfies TutorialStep[];

