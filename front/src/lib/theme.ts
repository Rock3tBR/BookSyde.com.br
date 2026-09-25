/** Paletas premium de BookSyde: quatro claras e quatro escuras; IDs persistidos preservados. */
export const THEME_OPTIONS = [
  {
    value: "light",
    label: "Claro",
    description: "Branco editorial, verde-petróleo e muito espaço para respirar.",
    number: 1,
    group: "claro",
    background: "#F8FAF8",
    card: "#FFFFFF",
    foreground: "#1D2925",
    primary: "#155C50",
    primaryForeground: "#FFFFFF",
    sidebar: "#F0F5F0",
    border: "#D7E1D9",
  },
  {
    value: "vanilla",
    label: "Marfim",
    description: "Papel marfim, verde suave e detalhes de terracota.",
    number: 2,
    group: "claro",
    background: "#F7F5EE",
    card: "#FFFEF9",
    foreground: "#292D27",
    primary: "#195C50",
    primaryForeground: "#FFFFFF",
    sidebar: "#F0F0E7",
    border: "#DEDCD1",
  },
  {
    value: "latte",
    label: "Latte",
    description: "Bege discreto e superfícies cremosas, sem excesso de marrom.",
    number: 3,
    group: "claro",
    background: "#ECE7DD",
    card: "#F8F5EE",
    foreground: "#322F2A",
    primary: "#64513C",
    primaryForeground: "#FFFFFF",
    sidebar: "#E6DFD3",
    border: "#D2C8B8",
  },
  {
    value: "cappuccino",
    label: "Cappuccino",
    description: "Taupe elegante, ainda claro e com contraste de leitura.",
    number: 4,
    group: "claro",
    background: "#D7D0C5",
    card: "#EAE5DC",
    foreground: "#302F2C",
    primary: "#504639",
    primaryForeground: "#FFFFFF",
    sidebar: "#CEC7BB",
    border: "#BCB5A8",
  },
  {
    value: "mocha",
    label: "Mocha",
    description: "Primeiro escuro: grafite quente e cobre suave.",
    number: 5,
    group: "escuro",
    background: "#373632",
    card: "#44413C",
    foreground: "#F5F2EC",
    primary: "#E9BA91",
    primaryForeground: "#30231A",
    sidebar: "#302F2B",
    border: "#65635B",
  },
  {
    value: "coffee",
    label: "Espresso",
    description: "Carvão neutro, café apenas nos detalhes e botões âmbar.",
    number: 6,
    group: "escuro",
    background: "#262625",
    card: "#32312F",
    foreground: "#F4F2EE",
    primary: "#EBC399",
    primaryForeground: "#302317",
    sidebar: "#202120",
    border: "#52524C",
  },
  {
    value: "dark",
    label: "Petróleo",
    description: "Verde profundo, cartões nítidos e cobre contido.",
    number: 7,
    group: "escuro",
    background: "#172522",
    card: "#20322D",
    foreground: "#F1F5F0",
    primary: "#E4B18C",
    primaryForeground: "#2B2119",
    sidebar: "#12201C",
    border: "#41594E",
  },
  {
    value: "midnight",
    label: "Noite absoluta",
    description: "Quase preto, tinta clara e acentos verde-jade.",
    number: 8,
    group: "escuro",
    background: "#0D1212",
    card: "#171F1E",
    foreground: "#EFF5F2",
    primary: "#8AD9BD",
    primaryForeground: "#10231D",
    sidebar: "#090F0E",
    border: "#344943",
  }
] as const;

export type SiteTheme = (typeof THEME_OPTIONS)[number]["value"];

/** Compatibilidade com perfis e localStorage das oito opções anteriores. */
const LEGACY_THEMES: Record<string, SiteTheme> = {
  ocean: "dark",
  sakura: "vanilla",
  forest: "dark",
  violet: "coffee",
  sunset: "latte",
};

export function normalizeSiteTheme(value: string | null | undefined): SiteTheme {
  const migrated = LEGACY_THEMES[value ?? ""] ?? value;
  return THEME_OPTIONS.find((theme) => theme.value === migrated)?.value ?? "light";
}

export function applySiteTheme(theme: SiteTheme) {
  if (typeof document === "undefined") return;
  const selected = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
  const root = document.documentElement;
  // Os quatro primeiros usam componentes light; os quatro seguintes, dark.
  root.classList.toggle("dark", selected.group === "escuro");
  root.dataset.theme = selected.value;
  root.style.colorScheme = selected.group === "escuro" ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", selected.background);
}
