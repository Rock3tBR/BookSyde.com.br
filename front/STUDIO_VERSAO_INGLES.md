# Estúdio — versão em inglês

Na edição de uma obra, o Estúdio agora possui uma seção **Versão em inglês** com título, descrição e sinopse em inglês.

- Os campos são opcionais; a obra continua funcionando somente em PT-BR.
- Quando preenchidos, usam `mangas.title_en`, `mangas.description_en` e `mangas.synopsis_en`.
- Com o sistema em English, os metadados localizados existentes são priorizados pela camada de i18n.
- Os arquivos/volumes em inglês continuam sendo adicionados na área de conteúdo/volumes usando o suporte bilíngue já existente.

## Banco
Execute as migrations existentes em `supabase/migrations`, em especial `20260918114500_manga_localized_metadata.sql`.
