# MangakaLib — página direita do livro 3D para visitantes

## Comportamento

- Em obras **publicadas e públicas** no catálogo ou marketplace, `/api/reader-pages` aceita `{ "volumeId": "...", "preview": true }` e disponibiliza **somente a página 10** dos volumes extraídos em imagens. O cliente não escolhe o caminho do arquivo nem solicita outras páginas pela rota de amostra.
- Para EPUB, a rota assina **somente uma imagem PNG previamente gerada** da página 10. Ela nunca entrega o arquivo EPUB para visitantes sem acesso. Uma prévia PNG é criada para novos EPUBs durante o envio (sem impedir a publicação se a geração falhar).
- EPUBs já cadastrados: ao abrir a obra com a conta de seu criador ou de um administrador, a página 10 é renderizada com autorização e o PNG é salvo automaticamente para futuras visitas públicas. Não exige reenviar o volume. Para funcionar, o criador/admin deve ter acesso à obra e ela deve estar pública no catálogo/marketplace.
- Enquanto não existir a prévia (ou se faltar página 10), a página direita renderiza a **sinopse formatada na própria superfície 3D**, sem exibir um erro cru e sem liberar o original.
- Obras privadas/por convite não recebem acesso público à página 10. Somente quem já tem permissão de leitura obtém a amostra; não há mudança na segurança do leitor.
- Ao excluir volume/obra pelo endpoint de moderação, remove também o PNG associado.

## Banco de dados

Nenhum SQL novo é necessário para esta mudança. O arquivo `supabase/migrations/20260917230000_volume_number_zero.sql` e as cópias avulsas do SQL Volume 0 foram ajustados para aceitar restrições com sufixo PostgreSQL `NOT VALID`, corrigindo o erro reportado anteriormente. Caso a migração tenha sido aplicada manualmente, não é preciso executá-la outra vez.

## Verificação local

Foi verificada a sintaxe/transpilação dos arquivos TypeScript/TSX afetados. Testes de ponta a ponta com Supabase real e build completo devem ser feitos após instalar dependências e publicar o projeto.
