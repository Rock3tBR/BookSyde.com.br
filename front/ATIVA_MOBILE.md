# Ativa mobile

- Card de Ativa no topo da Home mobile, acima da área de continuar lendo.
- A Ativa conta dias consecutivos em que houve leitura real registrada pelo timer do leitor.
- Várias leituras no mesmo dia contam como um único dia da sequência.
- Se hoje ainda não houve leitura, a animação fica cinza e parada; se ontem houve leitura, a sequência continua exibida como pendente.
- Se um dia inteiro for perdido, a sequência volta a zero até a próxima leitura.
- Lottie: https://lottie.host/3c825052-be2b-49de-a485-5b7fcfeb3b94/cIOuB5sSbX.lottie
- O estilo 3D/Realista é automaticamente substituído pelo estilo Livro em telas abaixo de 768 px.
- Paletas Oceano, Floresta, Violeta, Sunset/Walnut e Midnight/Charcoal foram aproximadas às referências enviadas.

Execute `SQL_EDITOR_ATIVA.sql` no Supabase para garantir a tabela/RPC de tempo de leitura.
