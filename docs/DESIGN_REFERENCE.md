# DESIGN_REFERENCE — UI kit "Game portal" (referência estética do usuário)

> As 8 imagens do UI kit foram enviadas pelo usuário no chat e **não estão no repositório** (são arte de terceiros).
> Este arquivo registra, em texto, tudo o que delas deve ser aplicado, para que uma nova sessão não dependa das imagens.
> **Nunca copiar** personagens, capas de jogos, logotipos ou nomes de franquias das imagens. Usar só a linguagem visual.

## Cores do style guide da referência
| Papel | Hex da referência | Uso no Projeto Fênix |
|---|---|---|
| Preto de rodapé / janela | `#080808` | rodapé, faixas "negras" entre seções (`--black`) |
| Índigo profundo (fundo) | `#060326` | fundo geral — mapeado para `#080719` do brief |
| Azul-ciano de destaque | `#35BFFF` | **cor de ação principal** (`--accent`): botão primário, item ativo, 1ª letra dos títulos, paginação |
| Roxo/violeta | gradientes de banner | `#8065FF` (do brief) em gradientes diagonais |

Fonte da referência: Raleway (uma só família). Decisão: manter **Oxanium** (títulos) + **Inter** (texto), já autohospedadas (LGPD: sem Google Fonts).

## Traços visuais a reproduzir
1. **Títulos de seção**: caixa-alta, peso extra-bold, **primeira letra em ciano** (`GAME EXPLORER`, `LATEST NEWS`, `REVIEWS`). Classe `.title-hud`.
2. **Header**: barra escura; logo à esquerda; menu com item ativo em ciano; **campo de pesquisa em pílula** (preenchimento índigo translúcido, ícone de lupa); ações à direita em botões circulares.
3. **Hero cinematográfico** (largura total): arte centralizada com **barras verticais de neon ciano**, título pequeno em caixa-alta com **triângulo invertido** (outline) abaixo, setas ‹ › em pílula e pontos de paginação; em uma variação há **texto-fantasma gigante em outline** atrás da arte.
4. **Faixa de 5 miniaturas** colada sob o hero (borda a borda), cada uma com o nome no canto inferior esquerdo — funciona como seletor dos 5 destaques ("5 popular games" no grid).
5. **Game Explorer**: pôster grande à esquerda com **pílula azul-marinho no canto inferior** (preço na referência → no Projeto Fênix: plataforma); painel à direita com ano (pequeno, esmaecido), título, descrição, **chips arredondados escuros**, botão ciano "More info" (→ "Ver ficha"); dois pôsteres ao lado; abaixo, carrossel de 5 pôsteres com **setas circulares outline**.
6. **Cards de jogo (catálogo)**: pôster **3:4**, cantos levemente arredondados, sombra azulada; **selos no canto superior direito** (NEW verde, SALE rosa/vermelho, POPULAR laranja → no Projeto Fênix: NOVO / ATUALIZADO / RECÉM-ADICIONADO a partir de datas reais); **pílula escura** + título em negrito na base; **no hover o card vira um painel ciano** com "Description", texto e botão branco.
7. **Catálogo** (Etapa 4): sidebar de filtros em acordeão (linhas escuras, linha ativa preenchida de ciano, subitens recuados), botão pílula ciano "Reset filter", barra superior com busca + 3 selects, banner largo do jogo em destaque, grid de 4 colunas, **paginação em círculos** (ativa preenchida de ciano, demais com contorno), "…" e última página.

9. **Bloco "Video game"**: imagem 16:9 à esquerda com **texto vertical** ("WATCH THE VIDEO", 1ª palavra em ciano) e botão play circular com anéis; à direita título, subtítulo, texto, divisor, chips e nota. → no Projeto Fênix vira o **"Jogo aleatório / Spotlight"** (sem vídeo, sem nota inventada).
10. **Banner promocional**: faixa roxa/azul com **recorte diagonal**, pequena etiqueta ciano com data, título em caixa-alta com última parte em ciano, campo + botão circular ciano. → no Projeto Fênix: banner "Explore o catálogo" (**sem** formulário de e-mail: sem coleta de dados).
11. **Rodapé**: faixa preta, logo, navegação em ciano/branco, ícones redondos, linha de copyright centralizada e discreta.
12. **Grid**: contêiner de ~85% da largura em 1920 (≈1630px), colunas regulares; margens generosas.
13. **Atmosfera**: fundo índigo escuro, luzes de neon ciano/azul, gradientes violeta, brilho nas bordas de painéis em destaque (contorno azul com glow).

## O que NÃO levar da referência (e por quê)
- Moldura de "janela" (– ☐ ✕), carrinho, preços, avatar/conta, idioma, redes sociais, formulário de assinatura, avaliações/estrelas: **seriam elementos falsos/decorativos que parecem interativos** ou dados inventados (regras do brief).
- Personagens e capas de jogos comerciais: direitos de terceiros. O Projeto Fênix usa **capas geradas por código** (`modules/cover.js`) até haver capa licenciada.

## Mapeamento para os arquivos
- Tokens e `.title-hud`, header, botões, cards, selos, chips, paginação, modais: `assets/css/base.css` e `assets/css/components.css`.
- Hero, faixa de miniaturas, Explorer, spotlight de jogo, spotlight, banner: `assets/css/pages/home.css`.
