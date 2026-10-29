# FKD Deck (engine das apresentações)

Esta pasta é o "motor" das apresentações FKD geradas pelo Gemini com a skill `apresentacao-fkd`.
Cada apresentação é **uma cópia desta pasta** com o `index.html` trocado.

## Como usar (quem monta a apresentação)

1. Duplique esta pasta e renomeie (ex.: `Deck Sebrae out-2026`).
2. Peça o deck ao Gemini com a skill `apresentacao-fkd`. Ele entrega o HTML completo.
3. Abra `colar-e-salvar.html`, cole o código e salve como `index.html` nesta pasta (substituindo o exemplo).
4. Abra `index.html` com duplo clique (Chrome ou Edge). Setas avançam; `F` tela cheia; `N` notas;
   `C` relatório de verificação (copie e cole no Gemini); `P` modo impressão.
5. PDF: aperte `P`, depois `Ctrl/Cmd+P`, "Salvar como PDF", margens "Nenhuma", "Gráficos de fundo" ligado.
6. Fotos geradas pelo Gemini vão na pasta `img/` com o nome que ele indicar.

O `index.html` que já vem aqui é um exemplo com 13 slides (um por família de layout): abra para
conferir que a pasta funciona e para ver o padrão.

## O que tem aqui

- `engine/fkd-deck.css`, `fkd-components.css`: sistema visual (temas, tipografia, grid, componentes, mockups).
- `engine/fkd-deck.js`: navegação, animações, transições, chrome automático, ajuste de texto, verificação (`?check=1`).
- `engine/fkd-charts.js`: 23 tipos de gráfico SVG com formatação pt-BR.
- `engine/fkd-symbols.js`: logotipo, símbolo, seta, stamp, grafismos 1–6 e ~100 ícones Mage.
- `engine/fkd-icons.js`: os 1.042 ícones Mage, carregados sob demanda.
- `engine/fonts/`: Barlow Condensed e Sora (woff2) e `fonts.css`.
- `img/placeholder-retrato.svg`: imagem provisória para fotos ainda não geradas.
- `colar-e-salvar.html`: ferramenta para salvar o HTML do Gemini sem editor de código.

## Hospedagem (equipe de tecnologia)

O deck também funciona sem a pasta local se a URL hospedada estiver preenchida em
`FKD_ENGINE_CDN` no topo do `index.html` (o esqueleto da skill traz a variável vazia). Para isso,
publique a pasta `engine/` em qualquer servidor estático (GitHub Pages ou jsDelivr a partir de um
repositório, Vercel, S3, o próprio site) e preencha a URL (terminando em `/engine/`) no esqueleto
da skill antes de reenviar a skill ao Gemini. Com a URL preenchida, o preview no Canvas do Gemini
também passa a mostrar o deck.

Para subir uma apresentação a um site, envie a pasta inteira (`index.html`, `engine/`, `img/`).
