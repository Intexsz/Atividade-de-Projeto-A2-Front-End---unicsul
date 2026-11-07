// Busca na página os elementos que o jogo vai controlar.
const dinossauro = document.getElementById("dinossauro");
const cacto = document.getElementById("cacto");
const elementoPontuacao = document.getElementById("pontuacao");
const mensagemJogo = document.getElementById("mensagem-jogo");
const animacaoCacto = cacto.getAnimations().find((animacao) => animacao.animationName === "movimento-cacto");

// Guarda a pontuação e em que estado o jogo está.
let pontos = 0;
let jogoIniciado = false;
let jogoPausado = false;
let fimDeJogo = false;
let temporizadorPontuacao;

// A cada segundo, soma um ponto e aumenta a velocidade do cacto aos poucos.
function iniciarTemporizadorPontuacao() {
    temporizadorPontuacao = setInterval(() => {
        if (fimDeJogo) {
            return;
        }

        pontos += 1;
        elementoPontuacao.textContent = `Pontos: ${pontos}`;

        const multiplicadorVelocidade = Math.min(1 + Math.floor(pontos / 5) * 0.15, 2.5);
        if (animacaoCacto) {
            animacaoCacto.playbackRate = multiplicadorVelocidade;
        }
    }, 1000);
}

// Só permite pular durante o jogo e quando o dinossauro ainda não está no ar.
function pular() {
    if (jogoIniciado && !jogoPausado && !fimDeJogo && !dinossauro.classList.contains("pulo")) {
        dinossauro.classList.add("pulo");
    }
}

// Esconde as instruções e começa a movimentar o cacto e contar os pontos.
function iniciarJogo() {
    jogoIniciado = true;
    jogoPausado = false;
    mensagemJogo.hidden = true;
    cacto.style.animationPlayState = "running";
    iniciarTemporizadorPontuacao();
}

// Alterna entre pausar e continuar, parando também a animação do dinossauro.
function alternarPausa() {
    if (!jogoIniciado || fimDeJogo) {
        return;
    }

    jogoPausado = !jogoPausado;
    cacto.style.animationPlayState = jogoPausado ? "paused" : "running";
    if (jogoPausado) {
        clearInterval(temporizadorPontuacao);
    } else {
        iniciarTemporizadorPontuacao();
    }
    dinossauro.getAnimations().forEach((animacao) => {
        if (jogoPausado) {
            animacao.pause();
        } else {
            animacao.play();
        }
    });

    mensagemJogo.textContent = jogoPausado
        ? "Jogo pausado\nPressione P para continuar"
        : "";
    mensagemJogo.hidden = !jogoPausado;
}

// Quando a animação do pulo termina, libera o próximo pulo.
dinossauro.addEventListener("animationend", (evento) => {
    if (evento.animationName === "pulo") {
        dinossauro.classList.remove("pulo");
    }
});

// Verifica repetidamente se as áreas do dinossauro e do cacto se cruzaram.
const verificacaoColisao = setInterval(() => {
    if (!jogoIniciado || jogoPausado || fimDeJogo) {
        return;
    }

    const areaDinossauro = dinossauro.getBoundingClientRect();
    const areaCacto = cacto.getBoundingClientRect();

    const houveColisao =
        areaDinossauro.right > areaCacto.left &&
        areaDinossauro.left < areaCacto.right &&
        areaDinossauro.bottom > areaCacto.top &&
        areaDinossauro.top < areaCacto.bottom;

    if (houveColisao) {
        // Para o jogo e mostra a pontuação final antes de reiniciar a página.
        fimDeJogo = true;
        clearInterval(verificacaoColisao);
        clearInterval(temporizadorPontuacao);
        cacto.style.animationPlayState = "paused";
        alert(`Você perdeu! Pontuação: ${pontos}`);
        window.location.reload();
    }
}, 10);

// Controla o jogo pelo teclado: Enter inicia, P pausa e Espaço ou seta para cima pula.
document.addEventListener("keydown", (evento) => {
    if (evento.repeat) {
        return;
    }

    if (evento.code === "Enter") {
        if (!jogoIniciado) {
            iniciarJogo();
        }
        return;
    }

    if (evento.code === "KeyP") {
        alternarPausa();
        return;
    }

    if (evento.code === "Space" || evento.code === "ArrowUp") {
        evento.preventDefault();
        pular();
    }
});
