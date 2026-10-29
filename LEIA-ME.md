# FKD Deck · engine das apresentações

Esta pasta é o **sistema visual** das apresentações HTML da FKD (CSS, JS, fontes, grafismos, logo,
stamp, 1.042 ícones) e o **player** para apresentar um deck. Ela vive em dois lugares, com o mesmo
conteúdo:

- repositório público `FKD-Creators/fkd-deck-engine` → engine servido pelo jsDelivr em
  `https://cdn.jsdelivr.net/gh/FKD-Creators/fkd-deck-engine@main/engine/` e player em
  **https://fkd-creators.github.io/fkd-deck-engine/apresentar.html**;
- pasta "FKD Deck" no Drive da FKD (https://drive.google.com/drive/folders/1f3WLHXSHwgpBC5_kdgfaUR46CRlXF3U_),
  para uso **sem internet** e para subir um deck a um servidor.

## Quem usa o Gemini não precisa desta pasta

O `index.html` que a skill `apresentacao-fkd` escreve tem uma linha no `<head>` que carrega o engine
da internet. O preview do Canvas já mostra o deck; o botão **"Abrir em nova aba (apresentar, PDF)"**
na base do preview manda o deck para o player, onde se apresenta em tela cheia, gera o PDF e baixa
o arquivo. Se o botão não abrir (bloqueio de pop-up), copie o código no Canvas (botão **Code**) e cole
no player.

## Para que serve a pasta, então

1. **Apresentar sem internet**: copie o `index.html` para dentro desta pasta (ao lado de `engine/`)
   e acrescente, acima da linha do CDN no `<head>`, a linha `<script src="engine/fkd-boot.js"></script>`.
   A cópia local vence; a do CDN só é usada se a pasta não existir. O `index.html` de exemplo desta
   pasta já vem assim.
2. **Player local**: `apresentar.html` funciona também aberto da pasta (duplo clique): cole o código
   ou abra o arquivo; ele inclui a linha do engine local automaticamente.
3. **Subir a um site**: envie a pasta inteira (engine/, img/, index.html) para o servidor.
4. **Fotos**: imagens geradas pelo Gemini podem ser salvas em `img/` e referenciadas como
   `img/nome.png` quando o deck vai rodar desta pasta ou de um servidor.

## Conteúdo

| Item | O que é |
|---|---|
| `engine/fkd-boot.js` | carregador: a única tag que um deck precisa; carrega os demais arquivos da mesma pasta |
| `engine/fkd-deck.css`, `fkd-components.css`, `fonts/` | sistema visual (temas, estruturas, componentes, Barlow Condensed + Sora) |
| `engine/fkd-symbols.js`, `fkd-icons.js` | logo, stamp, seta, grafismos 1–6, ~100 ícones embutidos + 1.042 Mage sob demanda |
| `engine/fkd-charts.js`, `fkd-deck.js` | 23 tipos de gráfico; navegação, animação, verificação (`C`), impressão (`P`), barra do preview |
| `img/placeholder-retrato.svg` | imagem usada enquanto a foto não existe |
| `index.html` | deck de exemplo com 13 slides (um por família de receita) |
| `apresentar.html` | player: cola o código ou abre o arquivo; apresenta, PDF, verificação, download |

## Teclas dentro de um deck

setas / espaço / clique avançam · `F` tela cheia · `N` notas do apresentador · `C` verificação de
encaixe (relatório para colar no Gemini) · `P` modo impressão (depois `Ctrl/Cmd+P` → "Salvar como
PDF", margens "Nenhuma", "Gráficos de fundo" ligado) · `B` tela preta · `#N` no endereço abre no
slide N.

## Atualizar o engine (equipe de tecnologia)

1. Altere os arquivos em `engine/` no repositório `FKD-Creators/fkd-deck-engine` e faça o commit na `main`.
2. Purgue o cache do jsDelivr para cada arquivo alterado:
   `https://purge.jsdelivr.net/gh/FKD-Creators/fkd-deck-engine@main/engine/<arquivo>` (sem purga, até 12 h).
3. O GitHub Pages (player) publica sozinho em 1–2 minutos.
4. Substitua os mesmos arquivos nesta pasta do Drive.
5. A skill do Gemini (`apresentacao-fkd`) só precisa ser reenviada se o `SKILL.md`, as referências
   ou os templates mudarem; o engine é carregado pela URL.

Fonte dos arquivos: skill `apresentacao-fkd` do Claude (pasta `assets/engine` e `assets/brand`),
adaptada em 27–29/10/2026 para rodar sem Node/Playwright. Mudanças estão descritas no
`README.md` do pacote `FKD/gemini-skills`.
