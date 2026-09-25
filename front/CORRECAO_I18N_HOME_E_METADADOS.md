# Correção i18n — Home/Biblioteca e metadados

- Amplia traduções da Home/Biblioteca (Sua leitura, Continue lendo, estados vazios, contadores, atualização, botões etc.).
- Inclui tradução dos títulos clássicos já usados no catálogo como fallback visual em inglês.
- Inclui tradução da descrição exibida do Conde de Monte Cristo usada na Home.
- Adiciona `title_en`, `description_en` e `synopsis_en` em `mangas` para permitir metadados editoriais próprios em inglês sem substituir o PT-BR.
- Mantém `title`, `description` e `synopsis` como base PT-BR.
- A migration `20260918114500_manga_localized_metadata.sql` deve ser executada no Supabase.
