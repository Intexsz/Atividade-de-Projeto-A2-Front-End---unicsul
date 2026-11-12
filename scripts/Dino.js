const dinossauro = document.getElementById("dinossauro");
const cacto = document.getElementById("cacto");
const elementoPontuacao = document.getElementById("pontuacao");
const mensagemJogo = document.getElementById("mensagem-jogo");

const ESTADO = {
    INICIO: "INICIO",
    JOGANDO: "JOGANDO",
    PAUSADO: "PAUSADO",
    GAME_OVER: "GAME_OVER"
};

let estadoAtual = ESTADO.INICIO;
let pontos = 0;
let recorde = 0; 
let temporizadorPontuacao = null;
let idAnimacaoColisao = null;

function atualizarPlacar() {
    elementoPontuacao.textContent = `Recorde: ${recorde} | Pontos: ${pontos}`;
}

function ajustarVelocidadeCacto(velocidade) {
    const animacao = cacto.getAnimations().find(a => a.animationName === "movimento-cacto");
    if (animacao) {
        animacao.playbackRate = velocidade;
    }
}

function iniciarTemporizadorPontuacao() {
    clearInterval(temporizadorPontuacao);
    temporizadorPontuacao = setInterval(() => {
        if (estadoAtual !== ESTADO.JOGANDO) return;

        pontos += 1;
        
        if (pontos > recorde) {
            recorde = pontos;
        }

        atualizarPlacar();

        const multiplicadorVelocidade = Math.min(1 + Math.floor(pontos / 5) * 0.15, 2.5);
        ajustarVelocidadeCacto(multiplicadorVelocidade);
    }, 1000);
}

function resetarCacto() {
    cacto.style.animation = "none";
    cacto.offsetHeight; // Força o reflow do navegador
    cacto.style.animation = "movimento-cacto 2.5s infinite linear";
    cacto.style.animationPlayState = "running";
    ajustarVelocidadeCacto(1);
}

function pular() {
    if (estadoAtual === ESTADO.JOGANDO && !dinossauro.classList.contains("pulo")) {
        dinossauro.classList.add("pulo");
    }
}

function iniciarJogo() {
    pontos = 0;
    estadoAtual = ESTADO.JOGANDO;
    atualizarPlacar();

    mensagemJogo.hidden = true;
    dinossauro.classList.remove("pulo");

    resetarCacto();
    iniciarTemporizadorPontuacao();
    verificarColisao();
}

function alternarPausa() {
    if (estadoAtual !== ESTADO.JOGANDO && estadoAtual !== ESTADO.PAUSADO) return;

    if (estadoAtual === ESTADO.JOGANDO) {
        estadoAtual = ESTADO.PAUSADO;
        clearInterval(temporizadorPontuacao);
        cacto.style.animationPlayState = "paused";
        dinossauro.getAnimations().forEach(anim => anim.pause());

        mensagemJogo.textContent = "Jogo pausado\nPressione P para continuar";
        mensagemJogo.hidden = false;
    } else {
        estadoAtual = ESTADO.JOGANDO;
        mensagemJogo.hidden = true;
        cacto.style.animationPlayState = "running";
        dinossauro.getAnimations().forEach(anim => anim.play());

        iniciarTemporizadorPontuacao();
        verificarColisao();
    }
}

function encerrarJogo() {
    estadoAtual = ESTADO.GAME_OVER;
    clearInterval(temporizadorPontuacao);
    cancelAnimationFrame(idAnimacaoColisao);

    cacto.style.animationPlayState = "paused";
    dinossauro.getAnimations().forEach(anim => anim.pause());

    mensagemJogo.textContent = `Fim de jogo! Pontos: ${pontos}\nRecorde: ${recorde}\nPressione Enter ou Espaço para reiniciar`;
    mensagemJogo.hidden = false;
}

dinossauro.addEventListener("animationend", (evento) => {
    if (evento.animationName === "pulo") {
        dinossauro.classList.remove("pulo");
    }
});

function verificarColisao() {
    if (estadoAtual !== ESTADO.JOGANDO) return;

    const areaDinossauro = dinossauro.getBoundingClientRect();
    const areaCacto = cacto.getBoundingClientRect();
    const margem = 6; // Margem de tolerância para evitar falsas colisões

    const houveColisao =
        areaDinossauro.right - margem > areaCacto.left + margem &&
        areaDinossauro.left + margem < areaCacto.right - margem &&
        areaDinossauro.bottom - margem > areaCacto.top + margem &&
        areaDinossauro.top + margem < areaCacto.bottom - margem;

    if (houveColisao) {
        encerrarJogo();
        return;
    }

    idAnimacaoColisao = requestAnimationFrame(verificarColisao);
}

document.addEventListener("keydown", (evento) => {
    if (evento.repeat) {
        return;
    }

    if (evento.code === "Enter") {
        evento.preventDefault();
        if (estadoAtual === ESTADO.INICIO || estadoAtual === ESTADO.GAME_OVER) {
            iniciarJogo();
        }
        return;
    }

    if (evento.code === "Space") {
        evento.preventDefault();
        if (estadoAtual === ESTADO.INICIO || estadoAtual === ESTADO.GAME_OVER) {
            iniciarJogo();
        } else if (estadoAtual === ESTADO.JOGANDO) {
            pular();
        }
        return;
    }

    if (evento.code === "KeyP") {
        alternarPausa();
        return;
    }

    if (evento.code === "ArrowUp") {
        evento.preventDefault();
        pular();
    }
});