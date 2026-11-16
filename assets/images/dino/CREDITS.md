# Sprites do Dino

Os sprites deste diretório vieram do arquivo `Sprites.zip` enviado para o projeto (conjuntos "Dinosaur", "Enemies, Obstacles, and Objects" e "Foregrounds and Backgrounds" do Dino do Chrome, em HD/2x). Cada quadro foi recortado da folha original, o fundo azul-turquesa foi removido e o contorno branco foi apagado, deixando só o corpo do desenho (cinza `#535353`) e, no Dino, o olho (branco). O jogo aplica as cores da paleta do Projeto Fênix em tempo de execução: laranja no Dino e no pterodáctilo, vermelho-escuro nos cactos, vermelho no chão e tons discretos no cenário.

| Arquivo | Conteúdo |
| --- | --- |
| `trex-sprites.png` | Dino em 4 quadros de 80x86: parado/pulando, corrida A, corrida B e colisão |
| `trex-duck-left.png`, `trex-duck-right.png` | Dino abaixado, 110x52 cada |
| `cactus-small-sprites.png` | 6 variações de cacto pequeno (células de 30x66) |
| `cactus-large-sprites.png` | 5 variações de cacto grande (células de 46x94) |
| `pterodactyl-sprite.png` | 2 quadros de 92x80 (asa abaixada e asa levantada), sempre voltado para a esquerda |
| `horizon-sprite.png` | Faixa de chão de 2400x24 |
| `scenery-sprites.png` | Atlas do cenário: estrelas, fases da lua, monte Fuji, cerca, assentos, boia, escada, argolas, barras, trave e balões |
| `trex-icon.png` | Dino laranja já colorido (52x54) usado no botão "Dinossauro" da navegação |
| `cloud-sprite.png` | Sem uso: as nuvens são desenhadas no código do jogo |

As medidas em px acima são do PNG HD; no jogo, 2 px de sprite equivalem a 1 unidade lógica (o tamanho do Dino original, 44x47).

O código-fonte do Dino está no repositório Chromium e é distribuído sob licença BSD: https://chromium.googlesource.com/chromium/src/+/main/LICENSE.
