# Paper World 🌍

Jogo de navegador inspirado em Paper.io 2: saia do seu território, desenhe um laço e volte para conquistar a área.
Cada fase é um país, e o progresso (porcentagem conquistada) fica salvo no navegador. **Sem anúncios.**

## Como jogar
- **Celular:** arraste o dedo na direção em que quer ir.
- **Computador:** mova o mouse (o personagem segue o cursor) ou use as setas / WASD. `Esc` pausa.
- Ao sair do seu território você deixa um rastro. Volte para casa para fechar o laço e ganhar a área.
- Se alguém tocar no seu rastro, você perde. Se você cortar o rastro de um oponente, ele é eliminado e **o território dele passa a ser seu**.
- Cruzar o próprio rastro não elimina.
- Encostou na borda do mapa? O personagem desliza pela costa **mais rápido** até você mudar de direção. Os cantos do mapa são arredondados.
- O progresso de cada país é **acumulativo**: 10% numa partida + 10% na outra = 20% do país. Ao chegar em 100% o país está concluído.
- Faça **50%** em um país para liberar o próximo (20 países, com mais bots e bots mais espertos a cada fase).
- Moedas ganhas nas partidas compram skins. Os personagens são modelos 3D em blocos (voxel) desenhados no próprio canvas, que giram conforme a direção. Toque numa skin para abrir a vitrine com o modelo girando.

## Publicar no GitHub Pages (grátis)
1. Crie um repositório público no GitHub (ex.: `paper-world`).
2. Envie todos os arquivos desta pasta para a raiz do repositório (`index.html`, `game.js`, `countries.js`, `style.css`, `.nojekyll`).
   Pelo site: **Add file → Upload files**, arraste os arquivos e clique em **Commit changes**.
3. Vá em **Settings → Pages**, em *Source* escolha **Deploy from a branch**, branch **main** e pasta **/ (root)**. Salve.
4. Em 1–2 minutos o jogo estará em `https://SEU-USUARIO.github.io/paper-world/`.

## Ajustes rápidos (game.js)
- `UNLOCK_AT` — % necessária para liberar o próximo país (padrão 50).
- `SPEED`, `PLAYER_TURN`, `BOT_TURN` — velocidade e giro. `WALL_BOOST` — aceleração ao deslizar na borda.
- Zoom da câmera: em `resize()`, a linha `Z = clamp(...)` (número maior no divisor = câmera mais afastada).
- Em `startGame`: quantidade de bots (`nb`) e a personalidade deles (`aggr` agressividade, `greed` tamanho dos laços, `caution` cautela).
- `SKINS` — lista de skins, cores, padrões e preços. `MODELS` — modelos 3D (cada um é uma lista de caixas `B(frente, lado, altura, largF, largL, alt, cor)`); skins sem modelo usam o cubo padrão.
- Para adicionar países, inclua novos itens em `countries.js` (contorno normalizado 0–1000).

## Créditos
Contornos dos países: [Natural Earth](https://www.naturalearthdata.com/) (domínio público).
Fonte: Fredoka (Google Fonts, licença OFL).
