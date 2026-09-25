# BookSyde — ajuste das oito paletas

A versão preserva `light`, `vanilla`, `latte`, `cappuccino`, `mocha`, `coffee`, `dark` e `midnight` no banco. **Não há SQL novo** e as preferências salvas continuam válidas. O rótulo `vanilla` agora aparece como **Marfim**.

Foram revistas as cores semânticas de fundo, cartões, textos, botões, menu lateral, popovers, campos, bordas, gráficos e prévias. Temas 1–4 são claros; 5–8 são escuros. O modo Realista agora respeita o tema em vez de forçar um fundo preto, e o gradiente global deixou de tingir a tela inteira de laranja/marrom. A tela de login, leitor, imagens e geometria 3D foram preservados.

Arquivos alterados: `src/styles.css`, `src/lib/theme.ts`, `src/components/ThemePicker.tsx`.

Para publicar, use o código atualizado e faça hard refresh da página após deploy. Não execute novamente migrações dos temas apenas para trocar cores.
