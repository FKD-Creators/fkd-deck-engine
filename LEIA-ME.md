# FKD Deck (engine das apresentações)

Pasta no Drive: https://drive.google.com/drive/folders/1f3WLHXSHwgpBC5_kdgfaUR46CRlXF3U_

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

O engine está publicado em `https://github.com/FKD-Creators/fkd-deck-engine` e servido pelo jsDelivr:
`https://cdn.jsdelivr.net/gh/FKD-Creators/fkd-deck-engine@main/engine/`. O esqueleto da skill já traz essa URL em `FKD_ENGINE_CDN`, então o deck abre mesmo sem a
pasta local (e o preview no Canvas do Gemini funciona). A pasta local continua sendo o caminho
principal: funciona sem internet e é a que vai para o servidor junto com a apresentação.

Para atualizar o engine: commit no repositório; o jsDelivr pode manter a versão anterior em cache
por até 12 horas (`https://purge.jsdelivr.net/gh/FKD-Creators/fkd-deck-engine@main/engine/<arquivo>`
força a atualização). Depois, redistribua a pasta "FKD Deck" e reenvie a skill se o esqueleto mudou.

Para subir uma apresentação a um site, envie a pasta inteira (`index.html`, `engine/`, `img/`).
