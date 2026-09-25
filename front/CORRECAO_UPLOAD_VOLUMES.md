# Correção do envio de volumes (RLS)

O erro `new row violates row-level security policy` é um bloqueio do Supabase. Ele pode ocorrer ao inserir o volume em `public.volumes`, gravar páginas em `public.pages` ou enviar arquivos ao Storage (`manga-covers`, `manga-pages`, `volume-sources`). Apenas a imagem do erro não identifica qual das operações falhou.

## Implantação

1. No projeto Supabase conectado ao MangakaLib, abra **SQL Editor** e execute **todo** o arquivo `CORRECAO_VOLUMES_RLS.sql` (igual à migration `supabase/migrations/20260917220000_volume_upload_rls.sql`). Se você já usa o CLI de migrations, aplique a migration apenas uma vez, não duplique a execução sem necessidade.
2. Publique este código atualizado no Lovable, atualize a página e faça novamente o upload.
3. Caso continue falhando, a notificação e o console informam agora a operação específica (`Criando volume`, `Enviando capa`, `Enviando páginas`, `Gravando páginas` etc.). Copie a mensagem inteira do console.
4. Confirme também se os três buckets acima existem no **Storage** do mesmo projeto Supabase. A migration não cria buckets e não muda a configuração pública/privada dos arquivos.

## Segurança

As políticas novas só concedem gerenciamento da obra ao `creator_id` da obra ou a quem tenha efetivamente a role `admin` na tabela `public.user_roles` (validação no banco). Uma conta que simplesmente tenha comprado, recebido convite ou adicionado a obra à biblioteca **não** ganha permissão de publicação. Não foi desativado RLS nem liberado `INSERT` para qualquer usuário autenticado. Políticas de leitura/compra já existentes são preservadas.

## Limitações de verificação

Não foi possível acessar seu banco Supabase nem executar a migration no projeto publicado neste ambiente. Portanto, a causa específica continua pendente de diagnóstico caso haja políticas restritivas existentes, gatilhos ou schemas diferentes dos usados pelo projeto. A execução do build também depende da instalação das dependências do projeto; aqui foi possível validar a sintaxe TypeScript do arquivo alterado, mas não o build completo.
