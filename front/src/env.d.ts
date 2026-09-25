/// <reference types="vite/client" />

// Variáveis VITE_* são substituídas no build (define). Elas precisam ser lidas
// com acesso por ponto (import.meta.env.VITE_X); acesso por colchetes NÃO é
// substituído e fica undefined no build de produção.
interface ImportMetaEnv {
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  readonly VITE_PAYMENTS_CLIENT_TOKEN?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
