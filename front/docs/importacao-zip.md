# Importação de obras por ZIP

No Estúdio, escolha **Múltiplos**, selecione o tipo padrão e envie um ZIP com uma pasta por obra. Revise os números e a ordem antes de criar. É possível misturar obras usando `tipo.txt` dentro de cada pasta.

```text
obras.zip
└── Minha HQ/
    ├── nome.txt
    ├── descricao.txt
    ├── categorias.txt
    ├── sinopse.txt
    ├── escritor.txt
    ├── preco.txt
    ├── tipo.txt           # opcional: manga, hq, gibi ou livro
    ├── unidade.txt        # capitulo ou volume
    ├── capa.jpg           # opcional para PDF/imagens
    └── capitulos/
        ├── 10.pdf
        ├── 5.pdf
        ├── 3.pdf
        └── 4.pdf
```

Os arquivos de texto contêm somente seus valores. Categorias são separadas por vírgulas; preço pode ser `0` ou, por exemplo, `19,90`.

Para mangás/HQs/gibis, `unidade.txt` é obrigatório. O nome define a ordenação natural e o último número do nome define o número da unidade: o exemplo aparece como **3, 4, 5, 10**. Na revisão, é possível editar números, numerar tudo em sequência ou trocar arquivos de posição com as setas. A capa acompanha o arquivo. Números repetidos precisam ser corrigidos no ZIP antes da importação.

Cada unidade pode ser PDF ou um arquivo de quadrinhos compatível com o envio individual. Uma pasta numerada contendo imagens também vira uma unidade, com suas páginas ordenadas pelo nome. Uma imagem `capa.jpg` na pasta da unidade serve como capa e não entra nas páginas. Para imagens com outro formato, use `capa.png`, `capa.webp` ou `capa.gif`.

Livros mantêm o padrão anterior: `colecao.txt` com `sim` ou `nao`, arquivos EPUB/PDF e livros de uma coleção ordenados naturalmente em `colecoes/`. Não precisam de `unidade.txt`. Um livro individual aceita apenas um arquivo, na posição 1. EPUBs sem capa interna precisam de uma imagem de capa fornecida no ZIP.

Limites do pacote: 500 MB compactado e 1 GB descompactado, além dos limites existentes de cada arquivo de leitura. A importação usa a fila de uploads; acompanhe seu progresso antes de fechar a página.
