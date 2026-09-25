# Mangaka — Personalização e Meu perfil separados

## O que foi alterado

- `/conta?tab=reading` — Preferências de leitura com menu lateral.
- `/conta?tab=catalog` — Tema da plataforma, conteúdo visível e aparência de cards.
- `/conta?tab=profile` e `/conta?tab=security` — URLs antigas redirecionam para `/meu-perfil`.
- `/meu-perfil` — Nova página exclusiva para avatar, apelido, e-mail de consulta, telefone opcional e troca de senha.
- Header desktop: menu do usuário possui **Meu perfil** e **Personalização** separados.
- Header mobile: inclui **Meu perfil** e Personalização sem repetir o link quando ele já consta no menu principal.
- `src/lib/access.ts` permite que editoras também abram o próprio perfil, sem liberar áreas administrativas.
- A gravação de preferências não sobrescreve o apelido de quem já possui perfil.

## Banco de dados — passo obrigatório para telefone

Execute a migração `supabase/migrations/20260916180000_private_profile_contacts.sql` no SQL Editor do mesmo projeto Supabase usado pelo aplicativo **antes** de testar o botão Salvar telefone. A migração é reaplicável e cria `public.profile_contacts` com políticas RLS de acesso somente ao dono autenticado da linha.

Não adicione telefone à tabela `profiles`, que pode ser lida por áreas sociais ou do marketplace. O telefone é de contato, **não** é verificado por SMS, não altera o número de login do Supabase Auth e não envia mensagens automaticamente.

A migração anterior `20260916150000_reader_discovery.sql`, relacionada à busca de amigos, continua incluída na pasta para instalações que ainda precisam dela. Evite reaplicá-la sem conferir o histórico de migrações do seu projeto.

## Verificações necessárias no seu ambiente

1. Aplicar a migração de contatos e conferir as políticas RLS.
2. Instalar dependências (`npm ci`), configurar as variáveis de ambiente no Lovable e executar `npm run build`.
3. Entrar com uma conta de cliente, uma de editora e uma de admin: verificar acesso a `/meu-perfil` e `/conta` pelo menu da conta.
4. Editar apelido e foto: confirmar atualização do header e persistência após recarregar.
5. Salvar e apagar telefone; com outra conta autenticada, confirmar que não é possível ler ou modificar o registro do primeiro usuário.
6. Alterar senha usando conta por e-mail com sessão recente. A configuração de segurança do Supabase pode solicitar reautenticação; um login social pode ter fluxo próprio.
7. Salvar preferências de leitura e catálogo e confirmar que elas não mudam o apelido.
8. Validar visualmente em celulares pequenos e desktops, inclusive teclado aberto nos formulários.

### Observação de entrega

A sintaxe TypeScript/TSX e os testes estáticos/unitários locais foram executados. Um build completo, navegação visual real e os fluxos de autenticação e de banco precisam ser validados com as dependências e o Supabase do usuário. As credenciais `.env` não foram incluídas no pacote distribuído; configure-as no ambiente do projeto. Não é preciso recriar as contas existentes.
