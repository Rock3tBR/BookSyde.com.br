# BookSyde — correção da ativação do vendedor

## Erro observado

O botão **Ativar recebimentos** apresentava `Sessão inválida.`. A API autenticava com o cliente administrativo, não verificava se a URL do projeto Supabase do navegador correspondia à do servidor e não diferenciava claramente ausência de configuração, credenciais divergentes e expiração do token. A consulta GET ainda convertia indisponibilidade em um status falso de conta desconectada. Havia também uma verificação de `creator` que podia rejeitar vendedores já cadastrados cuja função tivesse sido alterada.

## Mudanças

- A API confirma configuração privada obrigatória e igualdade entre URL do Supabase do cliente e URL do servidor, com mensagens específicas, antes de validar o JWT via cliente público de servidor. O acesso privilegiado continua exclusivamente no backend.
- Suporte tanto a `SUPABASE_SERVICE_ROLE_KEY` quanto a `SUPABASE_SECRET_KEY` (chave privada atual).
- Nas requisições autenticadas do Marketplace, HTTP 401 dispara **uma** tentativa de atualizar o token antes de retornar erro. HTTP 403 e 503 não são repetidos.
- O cadastro aceita admin, criador ou vendedor já registrado, respeitando suspensão da loja.
- Novas contas Stripe solicitam `card_payments` e `transfers`; contas individuais antigas com capacidades não solicitadas tentam ativá-las antes de continuar o onboarding. A Stripe continua responsável pela verificação e aprovação.
- A tela mostra falhas de configuração/consulta em vez de exibir status falso; retorno da Stripe só recebe notificação de sucesso quando a consulta realmente é concluída. O link de atualização expirado tenta criar outro link.

## Configuração obrigatória na hospedagem

Configure **na publicação do projeto**, além do `.env` da sua máquina:

```dotenv
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

Alternativamente use `SUPABASE_SERVICE_ROLE_KEY` (chave privada legacy) no lugar de `SUPABASE_SECRET_KEY`. As URLs precisam ser **exatamente a mesma base**, sem `/rest/v1`, e as chaves devem pertencer ao **mesmo projeto**. O frontend deve usar somente a chave **publicável**. Nunca escreva a chave privada em `VITE_*`, Git ou capturas de tela.

Este projeto também espera `LOVABLE_API_KEY` e `STRIPE_LIVE_API_KEY` para Stripe em produção, ou `STRIPE_SANDBOX_API_KEY` no modo teste. Estas chaves devem existir exclusivamente nas secrets do servidor, de acordo com o provedor de hospedagem e a conexão Stripe configurada.

**Importante:** o ZIP fornecido não inclui `SUPABASE_SERVICE_ROLE_KEY` nem `SUPABASE_SECRET_KEY` no `.env` local. Não é possível ativar recebimentos somente com a chave publicável. Confirme também as secrets configuradas no deploy: a configuração efetiva de produção não pode ser verificada por este ZIP.

## Aplicação

1. Instale/publice o ZIP atualizado, mantendo o mesmo projeto Supabase do login.
2. Configure as variáveis de servidor e a conexão Stripe no ambiente de produção; gere uma nova compilação/publicação, pois as variáveis `VITE_*` são incorporadas ao build.
3. Saia da conta e entre novamente para descartar qualquer sessão de projeto antigo.
4. Abra Minha loja → Ativar recebimentos. Complete o formulário da Stripe. Ao retornar, clique em **Atualizar status** se a verificação ainda estiver pendente.

Não execute SQL que defina `charges_enabled` ou `payouts_enabled` como verdadeiro manualmente. Esses campos devem refletir o resultado real da Stripe.
