import { clamp } from '../modules/utils.js';

const canvas = document.querySelector('#dino-canvas');
const arena = document.querySelector('[data-arena]');
const shell = document.querySelector('#dino-game-shell');
const jumpButton = document.querySelector('[data-jump]');
const fullscreenButton = document.querySelector('[data-fullscreen]');
const fullscreenLabel = document.querySelector('[data-fullscreen-label]');
const scoreNode = document.querySelector('[data-score]');
const bestNode = document.querySelector('[data-best]');
const liveNode = document.querySelector('[data-live]');
const ctx = canvas?.getContext('2d', { alpha: false });

if (canvas && arena && shell && ctx) {
    const HIGH_SCORE_KEY = 'projeto-fenix:dino-high-score:v1';
    const palette = {
        sky: '#111010',
        orange: '#F27405',
        light: '#FFB451',
        pale: '#FFD99F',
        red: '#A60311',
        deepRed: '#69040C',
        muted: '#755b54',
        line: '#542b2b',
        ink: '#171111',
    };
    const spriteFiles = {
        trex: 'trex-sprites.png',
        duckLeft: 'trex-duck-left.png',
        duckRight: 'trex-duck-right.png',
        cactusSmall: 'cactus-small-sprites.png',
        cactusLarge: 'cactus-large-sprites.png',
        horizon: 'horizon-sprite.png',
        bird: 'pterodactyl-sprite.png',
        scenery: 'scenery-sprites.png',
    };

    /*
     * Medidas dos sprites. A unidade lógica do jogo é 1 px do Dino original; os PNGs são HD (2x),
     * então 1 unidade = 2 px de sprite. Tamanhos abaixo em unidades; "cell" em px de sprite.
     */
    const DINO = { frameW: 80, frameH: 86, w: 40, h: 43, duckW: 55, duckH: 26 };
    const CACTUS = {
        cactusSmall: { cellW: 30, cellH: 66, variants: 6 },
        cactusLarge: { cellW: 46, cellH: 94, variants: 5 },
    };
    const CACTUS_GAP = 1;
    const BIRD = { cellW: 92, cellH: 80, w: 46, h: 40, speedFactor: 1.1 };
    const HORIZON = { w: 2400, h: 24, tile: 1200, lineOffset: 4, height: 12 };

    /* Cenário: [x, y, largura, altura] dentro de scenery-sprites.png (traços de 1 px, desenhados sem reduzir). */
    const SCENERY = {
        rings: [0, 0, 89, 146], bars: [91, 0, 129, 108], fuji: [222, 0, 423, 93],
        moon0: [647, 0, 80, 80], moon1: [729, 0, 80, 80], moon2: [811, 0, 80, 80], moon3: [0, 148, 80, 80],
        moon4: [82, 148, 80, 80], moon5: [164, 148, 80, 80], moon6: [246, 148, 80, 80],
        balloonL: [328, 148, 32, 68], balloonS: [571, 148, 16, 34], ladder: [362, 148, 36, 41],
        fence: [400, 148, 169, 38], seats: [589, 148, 81, 33], buoy: [672, 148, 29, 29], beam: [0, 230, 202, 27],
        starL0: [204, 230, 18, 18], starL1: [224, 230, 18, 18], starL2: [244, 230, 18, 18],
        starS0: [264, 230, 9, 9], starS1: [275, 230, 9, 9], starS2: [286, 230, 9, 9],
    };
    const MOON_PHASES = 7;
    const GROUND_PROPS = ['fence', 'rings', 'bars', 'seats', 'beam', 'ladder', 'buoy'];
    const FLOATING_PROPS = ['balloonL', 'balloonS'];

    const rawSprites = {};
    const sprites = {};
    const state = {
        mode: 'ready',
        width: 0,
        height: 0,
        dpr: 1,
        scale: 1,
        uiScale: 1,
        sceneScale: 1,
        groundY: 0,
        dinoX: 48,
        dinoY: 0,
        dinoVelocity: 0,
        grounded: true,
        duckHeld: false,
        speed: 340,
        distance: 0,
        score: 0,
        best: readBest(),
        spawnIn: 1.05,
        groundOffset: 0,
        runTime: 0,
        lastFrame: 0,
        clouds: [],
        obstacles: [],
        scenery: { ready: false, stars: [], moon: { x: 0, phase: 3 }, fuji: { x: 0 }, props: [] },
        fullscreenFallback: false,
    };

    function readBest() {
        try {
            const value = Number(localStorage.getItem(HIGH_SCORE_KEY));
            return Number.isFinite(value) && value > 0 ? value : 0;
        } catch {
            return 0;
        }
    }

    function announce(message) {
        if (liveNode) liveNode.textContent = message;
    }

    function setMode(mode) {
        if (state.mode === mode) return;
        state.mode = mode;
        if (mode === 'ready') announce('Pronto para começar. Pressione Espaço ou toque em Pular.');
        if (mode === 'playing') announce('Correndo. Salte os obstáculos.');
        if (mode === 'crashed') announce('Fim de jogo. Pontuação ' + String(state.score).padStart(5, '0') + '. Pressione Enter para recomeçar.');
    }

    /* Alinha coordenadas ao pixel físico para os sprites ficarem nítidos. */
    function snap(value) {
        return Math.round(value * state.dpr) / state.dpr;
    }

    function hexToRgb(hex) {
        return hex.match(/[A-Fa-f0-9]{2}/g).map((part) => Number.parseInt(part, 16));
    }

    function tintSprite(image, color) {
        if (!image) return null;
        const tinted = document.createElement('canvas');
        tinted.width = image.naturalWidth;
        tinted.height = image.naturalHeight;
        const tintContext = tinted.getContext('2d');
        if (!tintContext) return image;
        tintContext.drawImage(image, 0, 0);
        tintContext.globalCompositeOperation = 'source-in';
        tintContext.fillStyle = color;
        tintContext.fillRect(0, 0, tinted.width, tinted.height);
        return tinted;
    }

    /*
     * Os PNGs do Dino já vêm sem contorno: corpo cinza e olho branco. O corpo recebe o laranja da
     * paleta e o olho o tom escuro do fundo, o que preserva o contraste do rosto.
     */
    function colorizeDino(image) {
        if (!image) return null;
        const colored = document.createElement('canvas');
        colored.width = image.naturalWidth;
        colored.height = image.naturalHeight;
        const colorContext = colored.getContext('2d', { willReadFrequently: true });
        if (!colorContext) return image;
        colorContext.drawImage(image, 0, 0);
        const pixels = colorContext.getImageData(0, 0, colored.width, colored.height);
        const body = hexToRgb(palette.orange);
        const eye = hexToRgb(palette.ink);

        for (let index = 0; index < pixels.data.length; index += 4) {
            if (pixels.data[index + 3] === 0) continue;
            const brightness = (pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2]) / 3;
            const color = brightness > 170 ? eye : body;
            pixels.data[index] = color[0];
            pixels.data[index + 1] = color[1];
            pixels.data[index + 2] = color[2];
        }

        colorContext.putImageData(pixels, 0, 0);
        return colored;
    }

    function loadSprites() {
        const entries = Object.entries(spriteFiles);
        return Promise.all(entries.map(([key, filename]) => new Promise((resolve) => {
            const image = new Image();
            image.onload = () => resolve([key, image]);
            image.onerror = () => resolve([key, null]);
            image.src = 'assets/images/dino/' + filename;
        }))).then((loaded) => {
            loaded.forEach(([key, image]) => { rawSprites[key] = image; });
            sprites.trex = colorizeDino(rawSprites.trex);
            sprites.duckLeft = colorizeDino(rawSprites.duckLeft);
            sprites.duckRight = colorizeDino(rawSprites.duckRight);
            sprites.cactusSmall = tintSprite(rawSprites.cactusSmall, palette.deepRed);
            sprites.cactusLarge = tintSprite(rawSprites.cactusLarge, palette.deepRed);
            sprites.horizon = tintSprite(rawSprites.horizon, palette.red);
            sprites.bird = tintSprite(rawSprites.bird, palette.orange);
            sprites.sceneryProps = tintSprite(rawSprites.scenery, palette.muted);
            sprites.sceneryMountain = tintSprite(rawSprites.scenery, palette.red);
            sprites.scenerySky = tintSprite(rawSprites.scenery, palette.pale);
            resizeCanvas();
            syncScore();
            requestAnimationFrame(frame);
        });
    }

    function resizeCanvas() {
        const rect = arena.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;

        const previousGroundY = state.groundY;
        const previousScale = state.scale;
        const previousDinoX = state.dinoX;
        const previousLift = state.grounded ? 0 : Math.max(0, previousGroundY - state.dinoY);

        state.width = rect.width;
        state.height = rect.height;
        state.dpr = Math.min(window.devicePixelRatio || 1, 2);

        /*
         * Escala em números inteiros de pixels físicos por unidade, para o pixel art não ficar "serrilhado".
         * uiScale mantém a proporção anterior para nuvens e mensagens.
         */
        const fit = clamp(Math.min(state.width / 850, state.height / 250), 0.76, 2.2);
        const devicePerUnit = Math.max(Math.round(state.dpr), Math.floor(fit * state.dpr + 0.1));
        state.scale = devicePerUnit / state.dpr;
        state.sceneScale = Math.max(1, Math.round(devicePerUnit / 2)) / state.dpr;
        state.uiScale = Math.min(fit, 1.22);
        state.groundY = Math.max(80 * state.scale, state.height - 20 * state.scale);
        state.dinoX = snap(clamp(50 * state.scale, 24, 120));

        canvas.width = Math.round(state.width * state.dpr);
        canvas.height = Math.round(state.height * state.dpr);
        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;

        if (state.grounded) {
            state.dinoY = state.groundY - DINO.h * state.scale;
        } else {
            const scaledLift = previousScale ? previousLift * (state.scale / previousScale) : previousLift;
            state.dinoY = state.groundY - clamp(scaledLift, 0, Math.max(0, state.groundY - DINO.h * state.scale));
        }

        state.clouds.forEach((cloud) => {
            cloud.x = Math.min(cloud.x, state.width + 20);
            cloud.y = Math.min(cloud.y, Math.max(18, state.height * 0.38));
        });
        if (!state.clouds.length) {
            state.clouds = [
                { x: state.width * 0.18, y: state.height * 0.18, size: 0.82 },
                { x: state.width * 0.56, y: state.height * 0.11, size: 1 },
                { x: state.width * 0.86, y: state.height * 0.26, size: 0.72 },
            ];
        }

        if (previousScale && previousScale !== state.scale) {
            const ratio = state.scale / previousScale;
            state.obstacles.forEach((obstacle) => { obstacle.x = state.dinoX + (obstacle.x - previousDinoX) * ratio; });
        }
        state.obstacles.forEach(updateObstacleSize);
        seedScenery();
    }

    /* ----- Cenário de fundo (estrelas, lua, monte Fuji e adereços) ----- */

    function sceneSize(name) {
        const [, , width, height] = SCENERY[name];
        return { width: width * state.sceneScale, height: height * state.sceneScale };
    }

    function createProp(x) {
        const floating = Math.random() < 0.18;
        const list = floating ? FLOATING_PROPS : GROUND_PROPS;
        const kind = list[Math.floor(Math.random() * list.length)];
        return { kind, x, floating, phase: Math.random() * Math.PI * 2, lift: 24 + Math.random() * Math.max(30, state.height * 0.3) };
    }

    function seedScenery() {
        if (!rawSprites.scenery || state.width < 2) return;
        const scenery = state.scenery;
        const mountain = sceneSize('fuji');
        const moon = sceneSize('moon3');
        if (!scenery.ready) {
            scenery.ready = true;
            scenery.moon = { x: state.width * 0.8, phase: 3 };
            scenery.fuji = { x: state.width * 0.52 };
            scenery.props = [];
            let x = state.width * (0.12 + Math.random() * 0.1);
            while (x < state.width) {
                const prop = createProp(x);
                scenery.props.push(prop);
                x += sceneSize(prop.kind).width + (260 + Math.random() * 420) * state.scale;
            }
        }
        const starCount = clamp(Math.round(state.width / 110), 8, 24);
        while (scenery.stars.length < starCount) {
            scenery.stars.push({ x: Math.random(), y: Math.random(), kind: Math.floor(Math.random() * 3), phase: Math.random() * 10 });
        }
        scenery.stars.length = starCount;
        scenery.moon.x = Math.min(scenery.moon.x, state.width - moon.width * 0.5);
        scenery.fuji.x = Math.min(scenery.fuji.x, state.width - mountain.width * 0.25);
    }

    function updateScenery(delta) {
        const scenery = state.scenery;
        if (!scenery.ready || state.mode !== 'playing') return;
        const travel = state.speed * state.scale * delta;
        const moon = sceneSize('moon3');
        const mountain = sceneSize('fuji');

        scenery.moon.x -= travel * 0.02;
        if (scenery.moon.x + moon.width < 0) {
            scenery.moon.x = state.width + moon.width * 0.5;
            scenery.moon.phase = (scenery.moon.phase + 1) % MOON_PHASES;
        }

        scenery.fuji.x -= travel * 0.05;
        if (scenery.fuji.x + mountain.width < 0) scenery.fuji.x = state.width + (80 + Math.random() * 420) * state.scale;

        scenery.stars.forEach((star) => {
            star.x -= (travel * 0.012) / Math.max(1, state.width);
            if (star.x < 0) star.x += 1;
        });

        scenery.props.forEach((prop) => { prop.x -= travel * 0.4; });
        scenery.props = scenery.props.filter((prop) => prop.x + sceneSize(prop.kind).width > -40);
        const last = scenery.props.at(-1);
        if (!last || last.x + sceneSize(last.kind).width < state.width - (260 + Math.random() * 360) * state.scale) {
            scenery.props.push(createProp(state.width + 30 + Math.random() * 120));
        }
    }

    function drawScenery(atlas, name, x, y, alpha) {
        if (!atlas) return;
        const [sourceX, sourceY, sourceWidth, sourceHeight] = SCENERY[name];
        ctx.globalAlpha = alpha;
        ctx.drawImage(
            atlas,
            sourceX, sourceY, sourceWidth, sourceHeight,
            snap(x), snap(y), sourceWidth * state.sceneScale, sourceHeight * state.sceneScale
        );
        ctx.globalAlpha = 1;
    }

    function drawSky() {
        const scenery = state.scenery;
        if (!scenery.ready || !sprites.scenerySky) return;
        const skyHeight = state.groundY * 0.62;

        scenery.stars.forEach((star) => {
            const phase = (state.runTime * 0.9 + star.phase) % 3;
            const big = phase > 2.35;
            const name = (big ? 'starL' : 'starS') + star.kind;
            const size = sceneSize(name);
            drawScenery(sprites.scenerySky, name, star.x * state.width - size.width / 2, 14 + star.y * skyHeight, big ? 0.5 : 0.3);
        });

        drawScenery(sprites.scenerySky, 'moon' + scenery.moon.phase, scenery.moon.x, state.height * 0.1 + 18, 0.5);
    }

    function drawMountain() {
        const scenery = state.scenery;
        if (!scenery.ready) return;
        const mountain = sceneSize('fuji');
        drawScenery(sprites.sceneryMountain, 'fuji', scenery.fuji.x, state.groundY - mountain.height, 0.62);
    }

    function drawProps() {
        const scenery = state.scenery;
        if (!scenery.ready) return;
        scenery.props.forEach((prop) => {
            const size = sceneSize(prop.kind);
            const y = prop.floating
                ? state.groundY - size.height - prop.lift + Math.sin(state.runTime * 1.1 + prop.phase) * 5 * state.sceneScale
                : state.groundY - size.height;
            drawScenery(sprites.sceneryProps, prop.kind, prop.x, y, 0.62);
        });
    }

    /* ----- Estado da partida ----- */

    function resetRun() {
        state.speed = 340;
        state.distance = 0;
        state.score = 0;
        state.spawnIn = 1.1;
        state.groundOffset = 0;
        state.obstacles = [];
        state.duckHeld = false;
        state.grounded = true;
        state.dinoVelocity = 0;
        state.dinoY = state.groundY - DINO.h * state.scale;
        setMode('ready');
        syncScore();
    }

    function beginRun(jumpImmediately = false) {
        if (state.mode === 'crashed') resetRun();
        setMode('playing');
        if (jumpImmediately) jump();
    }

    function jump() {
        if (state.mode === 'crashed') {
            resetRun();
            beginRun(true);
            return;
        }
        if (state.mode === 'ready') beginRun(false);
        if (!state.grounded || state.mode !== 'playing') return;
        state.grounded = false;
        state.dinoVelocity = -650 * state.scale;
        state.dinoY = state.groundY - DINO.h * state.scale;
        state.duckHeld = false;
    }

    function endRun() {
        setMode('crashed');
        if (state.score > state.best) {
            state.best = state.score;
            try { localStorage.setItem(HIGH_SCORE_KEY, String(state.best)); } catch { /* record only in memory */ }
        }
        syncScore();
    }

    function syncScore() {
        const scoreText = String(state.score).padStart(5, '0');
        const bestText = String(state.best).padStart(5, '0');
        if (scoreNode && scoreNode.textContent !== scoreText) scoreNode.textContent = scoreText;
        if (bestNode && bestNode.textContent !== bestText) bestNode.textContent = bestText;
    }

    function updateObstacleSize(obstacle) {
        const scale = state.scale;
        if (obstacle.kind === 'bird') {
            obstacle.width = BIRD.w * scale;
            obstacle.height = BIRD.h * scale;
            obstacle.y = state.groundY - obstacle.lift * scale;
            return;
        }
        const spec = CACTUS[obstacle.kind];
        obstacle.width = ((spec.cellW / 2) * obstacle.count + CACTUS_GAP * (obstacle.count - 1)) * scale;
        obstacle.height = (spec.cellH / 2) * scale;
        obstacle.y = state.groundY - obstacle.height;
    }

    function spawnObstacle() {
        const canSpawnBird = state.score > 260 && state.speed > 420 && Math.random() < 0.2;

        if (canSpawnBird) {
            const birdLifts = state.width < 600 ? [40, 90] : [40, 65, 90];
            const lift = birdLifts[Math.floor(Math.random() * birdLifts.length)];
            const bird = { kind: 'bird', x: state.width + 24, y: 0, width: 0, height: 0, lift };
            updateObstacleSize(bird);
            state.obstacles.push(bird);
        } else {
            const kind = Math.random() < 0.55 ? 'cactusSmall' : 'cactusLarge';
            const count = Math.floor(Math.random() * 3) + 1;
            const variants = Array.from({ length: count }, () => Math.floor(Math.random() * CACTUS[kind].variants));
            const cactus = { kind, x: state.width + 24, y: 0, width: 0, height: 0, count, variants };
            updateObstacleSize(cactus);
            state.obstacles.push(cactus);
        }

        /* A velocidade está em unidades/s, então o intervalo até o próximo obstáculo é medido em segundos. */
        state.spawnIn = 0.92 + Math.random() * 0.48 + 130 / state.speed;
    }

    function dinoBox() {
        const scale = state.scale;
        const ducking = state.duckHeld && state.grounded;
        const width = (ducking ? DINO.duckW : DINO.w) * scale;
        const height = (ducking ? DINO.duckH : DINO.h) * scale;
        const y = state.grounded ? state.groundY - height : state.dinoY;
        return { x: state.dinoX + scale, y: y + scale, width: width - 2 * scale, height: height - 2 * scale };
    }

    function overlaps(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    function update(delta) {
        state.runTime += delta;
        state.clouds.forEach((cloud) => {
            if (state.mode === 'playing') cloud.x -= state.speed * delta * 0.07;
            if (cloud.x < -60) cloud.x = state.width + 24;
        });
        updateScenery(delta);
        if (state.mode !== 'playing') return;

        state.speed = Math.min(690, state.speed + delta * 8.2);
        state.distance += state.speed * delta * 0.095;
        state.score = Math.floor(state.distance);
        state.groundOffset = (state.groundOffset + state.speed * state.scale * delta) % (HORIZON.tile * state.scale);
        state.spawnIn -= delta;
        if (state.spawnIn <= 0) spawnObstacle();

        if (!state.grounded) {
            state.dinoVelocity += 1780 * state.scale * delta;
            if (state.duckHeld) state.dinoVelocity += 1150 * state.scale * delta;
            state.dinoY += state.dinoVelocity * delta;
            const landingY = state.groundY - DINO.h * state.scale;
            if (state.dinoY >= landingY) {
                state.dinoY = landingY;
                state.dinoVelocity = 0;
                state.grounded = true;
            }
        }

        /* O pterodáctilo voa um pouco mais rápido que o chão e sempre avança em direção ao Dino (da direita para a esquerda). */
        state.obstacles.forEach((obstacle) => {
            const factor = obstacle.kind === 'bird' ? BIRD.speedFactor : 1;
            obstacle.x -= state.speed * state.scale * factor * delta;
        });
        state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -24);

        const player = dinoBox();
        for (const obstacle of state.obstacles) {
            const insetX = obstacle.kind === 'bird' ? obstacle.width * 0.16 : obstacle.width * 0.1;
            const insetY = obstacle.kind === 'bird' ? obstacle.height * 0.3 : obstacle.height * 0.06;
            const hazard = {
                x: obstacle.x + insetX,
                y: obstacle.y + insetY,
                width: obstacle.width - insetX * 2,
                height: obstacle.height - insetY * 2,
            };
            if (overlaps(player, hazard)) {
                endRun();
                break;
            }
        }
        syncScore();
    }

    function drawCloud(cloud) {
        const scale = state.uiScale * cloud.size;
        ctx.fillStyle = '#3b302e';
        ctx.fillRect(cloud.x, cloud.y + 9 * scale, 50 * scale, 8 * scale);
        ctx.fillRect(cloud.x + 9 * scale, cloud.y + 4 * scale, 13 * scale, 10 * scale);
        ctx.fillRect(cloud.x + 24 * scale, cloud.y, 15 * scale, 14 * scale);
        ctx.fillRect(cloud.x + 39 * scale, cloud.y + 6 * scale, 8 * scale, 8 * scale);
    }

    function drawGround() {
        const scale = state.scale;
        const stripTop = state.groundY - HORIZON.lineOffset * scale;
        const stripHeight = HORIZON.height * scale;
        const tileWidth = HORIZON.tile * scale;

        if (!sprites.horizon) {
            ctx.fillStyle = palette.red;
            ctx.fillRect(0, state.groundY, state.width, 2 * scale);
            ctx.fillStyle = palette.line;
            for (let x = -state.groundOffset; x < state.width; x += 38 * scale) {
                ctx.fillRect(x + 15 * scale, state.groundY + 7 * scale, 4 * scale, 2 * scale);
            }
            return;
        }

        const start = snap(-state.groundOffset);
        for (let x = start; x < state.width; x += tileWidth) {
            ctx.drawImage(sprites.horizon, 0, 0, HORIZON.w, HORIZON.h, x, snap(stripTop), tileWidth, stripHeight);
        }
    }

    function drawDinoFallback() {
        const scale = state.scale;
        const ducking = state.duckHeld && state.grounded;
        const width = ducking ? DINO.duckW : DINO.w;
        const height = ducking ? DINO.duckH : DINO.h;
        const y = state.grounded ? state.groundY - height * scale : state.dinoY;
        ctx.fillStyle = state.mode === 'crashed' ? palette.deepRed : palette.orange;
        ctx.fillRect(state.dinoX + 16 * scale, y, 24 * scale, 20 * scale);
        ctx.fillRect(state.dinoX + 8 * scale, y + 18 * scale, 29 * scale, 20 * scale);
        ctx.fillRect(state.dinoX + 2 * scale, y + 24 * scale, 12 * scale, 5 * scale);
        ctx.fillRect(state.dinoX + 16 * scale, y + 36 * scale, 8 * scale, 7 * scale);
        ctx.fillRect(state.dinoX + 29 * scale, y + 36 * scale, 8 * scale, 7 * scale);
        if (ducking) {
            ctx.fillRect(state.dinoX + 5 * scale, y + 4 * scale, width * scale - 10 * scale, 13 * scale);
        }
    }

    function drawDino() {
        const scale = state.scale;
        const ducking = state.duckHeld && state.grounded;
        const x = snap(state.dinoX);

        if (ducking) {
            const duckSprite = Math.floor(state.runTime * 8) % 2 ? sprites.duckLeft : sprites.duckRight;
            if (!duckSprite) {
                drawDinoFallback();
                return;
            }
            ctx.drawImage(duckSprite, 0, 0, DINO.duckW * 2, DINO.duckH * 2, x, snap(state.groundY - DINO.duckH * scale), DINO.duckW * scale, DINO.duckH * scale);
            return;
        }

        if (!sprites.trex) {
            drawDinoFallback();
            return;
        }

        /* Quadros: 0 parado/pulando, 1 e 2 correndo, 3 colidiu. */
        let frame = 0;
        if (state.mode === 'crashed') frame = 3;
        else if (!state.grounded) frame = 0;
        else if (state.mode === 'playing') frame = Math.floor(state.runTime * 12) % 2 ? 2 : 1;

        const y = state.grounded ? state.groundY - DINO.h * scale : state.dinoY;
        ctx.drawImage(sprites.trex, frame * DINO.frameW, 0, DINO.frameW, DINO.frameH, x, snap(y), DINO.w * scale, DINO.h * scale);
    }

    function drawCactusFallback(obstacle) {
        const x = obstacle.x;
        const top = obstacle.y;
        const width = obstacle.width;
        ctx.fillStyle = palette.deepRed;
        ctx.fillRect(x + width * 0.34, top, width * 0.32, obstacle.height);
        ctx.fillRect(x, top + obstacle.height * 0.38, width * 0.28, 5 * state.scale);
        ctx.fillRect(x, top + obstacle.height * 0.18, 5 * state.scale, obstacle.height * 0.24);
        ctx.fillRect(x + width * 0.68, top + obstacle.height * 0.52, width * 0.28, 5 * state.scale);
    }

    function drawCactus(obstacle) {
        const sprite = sprites[obstacle.kind];
        if (!sprite) {
            drawCactusFallback(obstacle);
            return;
        }

        const spec = CACTUS[obstacle.kind];
        const unitWidth = (spec.cellW / 2) * state.scale;
        const gap = CACTUS_GAP * state.scale;
        obstacle.variants.forEach((variant, index) => {
            ctx.drawImage(
                sprite,
                variant * spec.cellW, 0, spec.cellW, spec.cellH,
                snap(obstacle.x + index * (unitWidth + gap)), snap(obstacle.y), unitWidth, obstacle.height
            );
        });
    }

    function drawBird(obstacle) {
        if (!sprites.bird) {
            ctx.fillStyle = palette.orange;
            ctx.fillRect(obstacle.x + 8 * state.scale, obstacle.y + 12 * state.scale, 31 * state.scale, 10 * state.scale);
            ctx.fillRect(obstacle.x + 18 * state.scale, obstacle.y, 17 * state.scale, 14 * state.scale);
            return;
        }
        /* Duas batidas de asa, sempre de frente para o Dino (o sprite original já olha para a esquerda). */
        const frame = Math.floor(state.runTime * 6) % 2;
        ctx.drawImage(sprites.bird, frame * BIRD.cellW, 0, BIRD.cellW, BIRD.cellH, snap(obstacle.x), snap(obstacle.y), obstacle.width, obstacle.height);
    }

    /* Mensagem centralizada na área do jogo (e, portanto, no meio da tela com ou sem tela cheia). */
    function drawOverlay() {
        if (state.mode === 'playing') return;
        const ui = state.uiScale;
        const centerX = state.width / 2;
        const crashed = state.mode === 'crashed';
        const boxWidth = Math.min((crashed ? 440 : 360) * ui, state.width - 28);
        const boxHeight = (crashed ? 124 : 66) * ui;
        const x = Math.round(centerX - boxWidth / 2);
        const y = Math.round(state.height / 2 - boxHeight / 2);

        ctx.fillStyle = 'rgba(13, 13, 13, 0.86)';
        ctx.fillRect(x, y, boxWidth, boxHeight);
        ctx.strokeStyle = 'rgba(242, 116, 5, 0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, boxWidth - 1, boxHeight - 1);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = crashed ? palette.light : palette.orange;
        ctx.font = '800 ' + Math.max(15, 18 * ui) + 'px Oxanium, sans-serif';
        ctx.fillText(crashed ? 'FIM DE JOGO' : 'CORRIDA FÊNIX', centerX, y + (crashed ? 25 : 22) * ui);
        ctx.fillStyle = '#d6c4bd';
        ctx.font = '600 ' + Math.max(10, 11 * ui) + 'px Inter, sans-serif';
        ctx.fillText(
            crashed ? 'ENTER ou PULAR para tentar novamente' : 'ESPAÇO / ↑ ou PULAR para começar',
            centerX,
            y + (crashed ? 52 : 46) * ui,
            boxWidth - 20 * ui
        );
        if (crashed) {
            ctx.fillStyle = '#d6c4bd';
            ctx.font = '700 ' + Math.max(10, 11 * ui) + 'px Inter, sans-serif';
            ctx.fillText('PONTOS ' + String(state.score).padStart(5, '0'), centerX, y + 79 * ui);
            ctx.fillStyle = '#9a8585';
            ctx.font = '700 ' + Math.max(10, 11 * ui) + 'px Inter, sans-serif';
            ctx.fillText('RECORDE ' + String(state.best).padStart(5, '0'), centerX, y + 104 * ui);
        }
    }

    function draw() {
        const width = state.width;
        const height = state.height;
        ctx.fillStyle = palette.sky;
        ctx.fillRect(0, 0, width, height);
        drawSky();
        drawMountain();
        state.clouds.forEach(drawCloud);
        drawProps();
        drawGround();
        state.obstacles.forEach((obstacle) => obstacle.kind === 'bird' ? drawBird(obstacle) : drawCactus(obstacle));
        drawDino();
        drawOverlay();
    }

    function frame(timestamp) {
        if (!state.lastFrame) state.lastFrame = timestamp;
        const delta = clamp((timestamp - state.lastFrame) / 1000, 0, 0.032);
        state.lastFrame = timestamp;
        update(delta);
        draw();
        requestAnimationFrame(frame);
    }

    function focusGame() {
        canvas.focus({ preventScroll: true });
    }

    function handleKeyDown(event) {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (event.code === 'Escape' && state.fullscreenFallback) {
            event.preventDefault();
            toggleFullscreen();
            return;
        }
        if (target?.closest('button,a,input,textarea,select') && event.code !== 'ArrowDown') return;
        if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
            event.preventDefault();
            if (!event.repeat) jump();
        } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
            event.preventDefault();
            state.duckHeld = true;
        } else if (event.code === 'Enter' && state.mode !== 'playing') {
            event.preventDefault();
            if (state.mode === 'crashed') resetRun();
            beginRun(false);
        }
    }

    function handleKeyUp(event) {
        if (['ArrowDown', 'KeyS'].includes(event.code)) state.duckHeld = false;
    }

    function setFullscreenLabel() {
        const active = document.fullscreenElement === shell || state.fullscreenFallback;
        if (fullscreenLabel) fullscreenLabel.textContent = active ? 'Sair da tela cheia' : 'Fullscreen';
        fullscreenButton?.setAttribute('aria-label', active ? 'Sair da tela cheia' : 'Abrir jogo em tela cheia');
    }

    async function toggleFullscreen() {
        if (document.fullscreenElement === shell) {
            await document.exitFullscreen?.();
            focusGame();
            return;
        }
        if (state.fullscreenFallback) {
            state.fullscreenFallback = false;
            shell.classList.remove('is-fullscreen-fallback');
            document.body.classList.remove('dino-fullscreen-fallback');
            setFullscreenLabel();
            resizeCanvas();
            focusGame();
            return;
        }
        try {
            if (!shell.requestFullscreen) throw new Error('Fullscreen API não disponível');
            await shell.requestFullscreen();
            focusGame();
        } catch {
            state.fullscreenFallback = true;
            shell.classList.add('is-fullscreen-fallback');
            document.body.classList.add('dino-fullscreen-fallback');
            setFullscreenLabel();
            resizeCanvas();
            focusGame();
        }
    }

    canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        jump();
    });
    jumpButton?.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        jump();
    });
    jumpButton?.addEventListener('click', (event) => {
        if (event.detail === 0) jump();
    });
    fullscreenButton?.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => {
        setFullscreenLabel();
        resizeCanvas();
        focusGame();
    });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', () => { state.duckHeld = false; });
    window.addEventListener('resize', resizeCanvas, { passive: true });
    document.addEventListener('visibilitychange', () => { state.lastFrame = 0; });

    if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(arena);
    resizeCanvas();
    syncScore();
    focusGame();
    loadSprites();
}
