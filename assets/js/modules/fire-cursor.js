/**
 * Cursor de fogo com rastro curto e rajadas ao clicar.
 * A camada é pequena, não captura eventos e respeita movimento reduzido.
 */
import { clamp } from './utils.js';
import { motionEnabled } from './particles.js';

const COLORS = [
    [255, 54, 5],
    [255, 91, 8],
    [255, 133, 20],
    [255, 181, 55],
    [255, 223, 132],
];
const TAU = Math.PI * 2;
const CANVAS_SIZE = 440;
const MAX_PARTICLES = 72;
const TRAIL_MS = 260;
const LINK_SELECTOR = 'a[href],button:not(:disabled),[role="link"],[role="button"],[data-action],input[type="button"],input[type="submit"],input[type="reset"],input[type="checkbox"],input[type="radio"],select,summary';
const EDITABLE_SELECTOR = 'textarea,input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]),[contenteditable=""],[contenteditable="true"],[role="textbox"]';
const TEXT_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,code,dt,dd,small,strong,em,time,span';

function rgba(color, alpha) {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function cursorModeFor(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    if (!element) return 'normal';
    if (element.closest(LINK_SELECTOR)) return 'link';
    if (element.closest(EDITABLE_SELECTOR)) return 'text';
    const cursor = getComputedStyle(element).cursor;
    if (cursor === 'pointer') return 'link';
    if (cursor === 'text' || element.closest(TEXT_SELECTOR)) return 'text';
    return 'normal';
}

function makeGlowSprite(color, size = 48) {
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const spriteContext = sprite.getContext('2d');
    if (!spriteContext) return sprite;

    const center = size / 2;
    const gradient = spriteContext.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255, 244, 196, 0.96)');
    gradient.addColorStop(0.12, rgba(color, 0.96));
    gradient.addColorStop(0.38, rgba(color, 0.62));
    gradient.addColorStop(0.72, rgba(color, 0.18));
    gradient.addColorStop(1, rgba(color, 0));
    spriteContext.fillStyle = gradient;
    spriteContext.fillRect(0, 0, size, size);
    return sprite;
}

export function initFireCursor() {
    const canvas = document.createElement('canvas');
    canvas.className = 'fire-cursor-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.hidden = true;
    document.body.append(canvas);

    // Diálogos nativos ficam na top layer do navegador, acima do body.
    // Reposicionar o canvas no diálogo aberto mantém o cursor flamejante visível na biblioteca e em qualquer modal.
    let observedDialog = null;
    let dialogContentObserver = null;
    function syncTopLayer() {
        const activeDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
        const layer = activeDialog || document.body;
        if (canvas.parentElement !== layer) layer.append(canvas);
        if (activeDialog !== observedDialog) {
            dialogContentObserver?.disconnect();
            observedDialog = activeDialog;
            if (activeDialog) dialogContentObserver?.observe(activeDialog, { childList: true });
        }
    }
    const topLayerObserver = new MutationObserver(syncTopLayer);
    dialogContentObserver = new MutationObserver(syncTopLayer);
    topLayerObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('close', syncTopLayer, true);

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
        topLayerObserver.disconnect();
        dialogContentObserver.disconnect();
        document.removeEventListener('close', syncTopLayer, true);
        return { destroy() { canvas.remove(); } };
    }

    const sparkSprites = COLORS.map((color) => makeGlowSprite(color));
    const auraSprite = makeGlowSprite(COLORS[2], 80);
    let viewportWidth = 0;
    let viewportHeight = 0;
    let originX = 0;
    let originY = 0;
    let dpr = 1;
    let frameId = 0;
    let lastFrame = 0;
    let emissionProgress = 0;
    let running = false;
    let destroyed = false;
    let particles = [];
    const pool = [];
    const trail = [];
    const pointer = {
        x: -1000,
        y: -1000,
        visible: false,
        active: false,
        type: 'mouse',
        lastMove: 0,
        mode: 'normal',
    };
    let hoverProgress = 0;
    let hoverTarget = 0;
    const finePointerQuery = typeof matchMedia === 'function'
        ? matchMedia('(any-pointer: fine)')
        : null;
    const reducedMotionQuery = typeof matchMedia === 'function'
        ? matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    function moveLayer(x = pointer.x, y = pointer.y) {
        originX = clamp(x - CANVAS_SIZE / 2, 0, Math.max(0, viewportWidth - CANVAS_SIZE));
        originY = clamp(y - CANVAS_SIZE / 2, 0, Math.max(0, viewportHeight - CANVAS_SIZE));
        canvas.style.transform = `translate3d(${Math.round(originX)}px, ${Math.round(originY)}px, 0)`;
    }

    function setCursorMode(target) {
        const mode = cursorModeFor(target);
        if (mode === pointer.mode) return false;
        pointer.mode = mode;
        hoverTarget = mode === 'link' ? 1 : 0;
        return true;
    }

    function hasFinePointer() {
        return finePointerQuery ? finePointerQuery.matches : true;
    }

    function resize() {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(CANVAS_SIZE * dpr);
        canvas.height = Math.round(CANVAS_SIZE * dpr);
        canvas.style.width = `${CANVAS_SIZE}px`;
        canvas.style.height = `${CANVAS_SIZE}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        moveLayer();
    }

    function colorIndexForParticle() {
        const roll = Math.random();
        if (roll < 0.48) return 1;
        if (roll < 0.77) return 2;
        if (roll < 0.94) return 3;
        return 4;
    }

    function addParticle(x, y, vx, vy, burst = false) {
        if (particles.length >= MAX_PARTICLES) return;
        const particle = pool.pop() || {};
        const colorIndex = colorIndexForParticle();
        particle.x = x;
        particle.y = y;
        particle.previousX = x;
        particle.previousY = y;
        particle.vx = vx;
        particle.vy = vy;
        particle.size = burst ? 0.9 + Math.random() * 1.9 : 0.65 + Math.random() * 1.2;
        particle.life = 0;
        particle.maxLife = burst ? 430 + Math.random() * 540 : 300 + Math.random() * 460;
        particle.color = COLORS[colorIndex];
        particle.sprite = sparkSprites[colorIndex];
        particle.glow = 3 + Math.random() * (burst ? 10 : 7);
        particle.core = Math.random() < 0.48;
        particle.streak = Math.random() < (burst ? 0.72 : 0.55);
        particles.push(particle);
    }

    function emitAlong(x0, y0, x1, y1, distance, amount) {
        if (amount <= 0) return;
        const directionX = distance > 0 ? (x1 - x0) / distance : 0;
        const directionY = distance > 0 ? (y1 - y0) / distance : 0;
        for (let i = 0; i < amount; i++) {
            const t = (i + 1) / (amount + 1);
            const x = x0 + (x1 - x0) * t + (Math.random() - 0.5) * 5;
            const y = y0 + (y1 - y0) * t + (Math.random() - 0.5) * 5;
            const backwash = 18 + Math.random() * (pointer.active ? 76 : 48);
            const vx = -directionX * backwash + (Math.random() - 0.5) * 68;
            const vy = -directionY * backwash - 26 - Math.random() * (pointer.active ? 88 : 58);
            addParticle(x, y, vx, vy);
        }
    }

    function burst(x, y) {
        const count = pointer.type === 'touch' ? 18 : 22;
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.45;
            const speed = 58 + Math.random() * 178;
            addParticle(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8,
                Math.cos(angle) * speed, Math.sin(angle) * speed, true);
        }
    }

    function wake() {
        if (destroyed || running || !motionEnabled() || document.hidden) return;
        resize();
        canvas.hidden = false;
        running = true;
        lastFrame = 0;
        frameId = requestAnimationFrame(tick);
    }

    function release(index) {
        const particle = particles[index];
        particle.life = particle.maxLife;
        pool.push(particle);
        particles[index] = particles[particles.length - 1];
        particles.pop();
    }

    function drawTrail(now) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < trail.length - 1; i++) {
            const a = trail[i];
            const b = trail[i + 1];
            const fade = clamp(1 - (now - a.time) / TRAIL_MS, 0, 1);
            if (fade <= 0) continue;
            const previous = trail[i - 1] || a;
            const x0 = ((previous.x + a.x) / 2) - originX;
            const y0 = ((previous.y + a.y) / 2) - originY;
            const controlX = a.x - originX;
            const controlY = a.y - originY;
            const x1 = ((a.x + b.x) / 2) - originX;
            const y1 = ((a.y + b.y) / 2) - originY;
            const baseWidth = (2.5 + 8 * fade) * (a.active ? 1 : 0.72);

            ctx.strokeStyle = `rgba(255, 67, 6, ${fade * 0.48})`;
            ctx.lineWidth = baseWidth;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(controlX, controlY, x1, y1);
            ctx.stroke();

            ctx.strokeStyle = `rgba(255, 162, 38, ${fade * 0.76})`;
            ctx.lineWidth = Math.max(1.2, baseWidth * 0.42);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(controlX, controlY, x1, y1);
            ctx.stroke();

            if (a.active || pointer.active) {
                ctx.strokeStyle = `rgba(255, 235, 166, ${fade * 0.56})`;
                ctx.lineWidth = Math.max(0.8, baseWidth * 0.15);
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.quadraticCurveTo(controlX, controlY, x1, y1);
                ctx.stroke();
            }
        }
    }

    function drawSparkCircle(x, y, now, radius, alpha = 1) {
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        for (let i = 0; i < 36; i++) {
            const angle = (i / 36) * TAU;
            const flicker = 0.5 + 0.5 * Math.sin(now * 0.016 + i * 2.31);
            const wobble = (flicker - 0.5) * 2.8 + Math.sin(i * 4.7) * 0.65;
            const r = radius + wobble;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 66, 7, 0.92)';
        ctx.lineWidth = 2.8;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 191, 65, 0.92)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * TAU + Math.sin(now * 0.01 + i) * 0.035;
            const flicker = 0.5 + 0.5 * Math.sin(now * 0.021 + i * 2.63);
            const inner = radius - 1;
            const outer = radius + 2 + flicker * 4.2;
            ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
            ctx.quadraticCurveTo(
                x + Math.cos(angle + 0.12) * (outer + 1.8),
                y + Math.sin(angle + 0.12) * (outer + 1.8),
                x + Math.cos(angle + 0.2) * outer,
                y + Math.sin(angle + 0.2) * outer
            );
        }
        ctx.strokeStyle = 'rgba(255, 108, 13, 0.88)';
        ctx.lineWidth = 1.35;
        ctx.stroke();

        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * TAU + Math.sin(now * 0.013 + i * 1.7) * 0.045;
            const flicker = 0.45 + 0.55 * Math.sin(now * 0.025 + i * 2.4);
            const sparkSize = 3 + flicker * 3.2;
            const sparkRadius = radius + 1 + flicker * 1.8;
            ctx.globalAlpha = alpha * (0.46 + flicker * 0.48);
            ctx.drawImage(
                sparkSprites[3],
                x + Math.cos(angle) * sparkRadius - sparkSize / 2,
                y + Math.sin(angle) * sparkRadius - sparkSize / 2,
                sparkSize,
                sparkSize
            );
        }
        ctx.globalAlpha = 1;
    }

    function drawLinkRing(now) {
        if (hoverProgress <= 0.005) return;
        const x = pointer.x - originX;
        const y = pointer.y - originY;
        const radius = 31 + 23 * hoverProgress;
        ctx.globalAlpha = hoverProgress;
        ctx.strokeStyle = 'rgba(255, 61, 7, 0.58)';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 175, 42, 0.9)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, radius - 2.4, 0, TAU);
        ctx.stroke();

        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * TAU;
            const flicker = 0.5 + 0.5 * Math.sin(now * 0.018 + i * 2.17);
            const inner = radius - 1 + flicker * 1.5;
            const outer = radius + 3 + flicker * 5.5;
            ctx.strokeStyle = `rgba(255, ${115 + Math.round(flicker * 95)}, 34, ${0.42 + flicker * 0.42})`;
            ctx.lineWidth = 1 + flicker * 1.2;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
            ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawTextCursor() {
        const x = pointer.x - originX;
        const y = pointer.y - originY;
        ctx.globalAlpha = 0.82;
        ctx.drawImage(auraSprite, x - 15, y - 22, 30, 44);
        ctx.globalAlpha = 1;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255, 65, 7, 0.82)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y - 17);
        ctx.lineTo(x, y + 17);
        ctx.moveTo(x - 8, y - 17);
        ctx.lineTo(x + 8, y - 17);
        ctx.moveTo(x - 8, y + 17);
        ctx.lineTo(x + 8, y + 17);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 220, 128, 0.98)';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(x, y - 16);
        ctx.lineTo(x, y + 16);
        ctx.moveTo(x - 7, y - 16);
        ctx.lineTo(x + 7, y - 16);
        ctx.moveTo(x - 7, y + 16);
        ctx.lineTo(x + 7, y + 16);
        ctx.stroke();
    }

    function drawFlameCursor(now) {
        if (hoverProgress > 0.005) drawLinkRing(now);
        if (!pointer.visible) return;
        if (pointer.mode === 'text') {
            drawTextCursor();
            return;
        }

        const x = pointer.x - originX;
        const y = pointer.y - originY;
        drawSparkCircle(x, y, now, pointer.active ? 24 : 22);
        const size = pointer.active ? 32 : 30;
        ctx.drawImage(auraSprite, x - size / 2, y - size / 2, size, size);
    }

    function drawParticles(delta) {
        const seconds = delta / 1000;
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.previousX = p.x;
            p.previousY = p.y;
            p.vy += 26 * seconds;
            p.vx *= Math.pow(0.986, delta / 16.67);
            p.x += p.vx * seconds;
            p.y += p.vy * seconds;
            p.life += delta;

            if (p.life >= p.maxLife) {
                release(i);
                continue;
            }

            const progress = p.life / p.maxLife;
            const fadeIn = clamp(p.life / 32, 0, 1);
            const fadeOut = clamp((1 - progress) / 0.4, 0, 1);
            const alpha = fadeIn * fadeOut;
            if (alpha < 0.015) continue;
            const x = p.x - originX;
            const y = p.y - originY;
            const spriteSize = p.size * (4.5 + p.glow * 0.28);

            if (p.streak) {
                ctx.strokeStyle = rgba(p.color, alpha * 0.6);
                ctx.lineWidth = Math.max(0.55, p.size * 0.62);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(p.previousX - originX, p.previousY - originY);
                ctx.stroke();
            }

            ctx.globalAlpha = alpha;
            ctx.drawImage(p.sprite, x - spriteSize / 2, y - spriteSize / 2, spriteSize, spriteSize);
            ctx.globalAlpha = 1;
            if (p.core) {
                ctx.fillStyle = `rgba(255, 225, 150, ${alpha * 0.72})`;
                ctx.beginPath();
                ctx.arc(x, y, Math.max(0.4, p.size * 0.26), 0, TAU);
                ctx.fill();
            }
        }
    }

    function tick(now) {
        if (!running) return;
        const delta = lastFrame ? Math.min(now - lastFrame, 50) : 16.7;
        lastFrame = now;
        const easing = 1 - Math.exp(-delta / 250);
        hoverProgress += (hoverTarget - hoverProgress) * easing;
        if (Math.abs(hoverTarget - hoverProgress) < 0.002) hoverProgress = hoverTarget;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.globalCompositeOperation = 'lighter';

        let firstActive = 0;
        while (firstActive < trail.length && now - trail[firstActive].time > TRAIL_MS) firstActive++;
        if (firstActive) trail.splice(0, firstActive);
        drawTrail(now);
        drawParticles(delta);
        drawFlameCursor(now);
        ctx.globalCompositeOperation = 'source-over';

        const expanding = Math.abs(hoverTarget - hoverProgress) > 0.002;
        if (!particles.length && trail.length < 2 && !expanding) {
            running = false;
            lastFrame = 0;
            if (!pointer.visible) {
                ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                pointer.x = -1000;
                pointer.y = -1000;
                canvas.hidden = true;
            }
            return;
        }
        frameId = requestAnimationFrame(tick);
    }

    function onPointerMove(event) {
        if (!motionEnabled() || document.hidden || event.pointerType === 'touch') return;
        const now = performance.now();
        const x = event.clientX;
        const y = event.clientY;
        const wasVisible = pointer.visible;
        pointer.type = event.pointerType || 'mouse';
        pointer.visible = hasFinePointer();
        pointer.lastMove = now;
        if (pointer.visible) document.body.classList.add('fire-cursor-enabled');
        setCursorMode(event.target);

        if (!wasVisible || pointer.x < 0) {
            trail.length = 0;
            pointer.x = x;
            pointer.y = y;
            trail.push({ x, y, time: now, active: pointer.active });
            moveLayer(x, y);
            wake();
            return;
        }

        const x0 = pointer.x;
        const y0 = pointer.y;
        const dx = x - x0;
        const dy = y - y0;
        const distance = Math.hypot(dx, dy);
        pointer.x = x;
        pointer.y = y;
        trail.push({ x, y, time: now, active: pointer.active });
        if (trail.length > 24) trail.shift();
        moveLayer(x, y);

        emissionProgress += distance * (pointer.active ? 0.13 : 0.075);
        const count = Math.min(10, Math.floor(emissionProgress));
        if (count > 0) {
            emissionProgress -= count;
            emitAlong(x0, y0, x, y, distance, count);
        }
        wake();
    }

    function onPointerDown(event) {
        if (!motionEnabled() || document.hidden) return;
        pointer.type = event.pointerType || 'mouse';
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.visible = pointer.type !== 'touch' && hasFinePointer();
        pointer.active = true;
        pointer.lastMove = performance.now();
        if (pointer.visible) document.body.classList.add('fire-cursor-enabled');
        setCursorMode(event.target);
        trail.length = 0;
        if (pointer.visible) trail.push({ x: pointer.x, y: pointer.y, time: pointer.lastMove, active: true });
        moveLayer(pointer.x, pointer.y);
        burst(pointer.x, pointer.y);
        if (pointer.visible) document.body.classList.add('aura-active');
        wake();
    }

    function onPointerUp() {
        pointer.active = false;
        document.body.classList.remove('aura-active');
        if (pointer.visible) wake();
    }

    function onPointerOver(event) {
        if (!motionEnabled() || document.hidden || event.pointerType === 'touch') return;
        if (setCursorMode(event.target) && pointer.visible) wake();
    }

    function onPointerOut(event) {
        if (event.relatedTarget) {
            if (setCursorMode(event.relatedTarget) && pointer.visible) wake();
            return;
        }
        pointer.active = false;
        pointer.visible = false;
        pointer.mode = 'normal';
        hoverTarget = 0;
        document.body.classList.remove('aura-active');
        document.body.classList.remove('fire-cursor-enabled');
        wake();
    }

    function onWindowBlur() {
        pointer.active = false;
        pointer.visible = false;
        pointer.mode = 'normal';
        hoverTarget = 0;
        document.body.classList.remove('aura-active');
        document.body.classList.remove('fire-cursor-enabled');
        wake();
    }

    function clear() {
        running = false;
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
        lastFrame = 0;
        particles.forEach((p) => pool.push(p));
        particles = [];
        trail.length = 0;
        pointer.visible = false;
        pointer.active = false;
        pointer.x = -1000;
        pointer.y = -1000;
        pointer.lastMove = 0;
        emissionProgress = 0;
        hoverProgress = 0;
        hoverTarget = 0;
        document.body.classList.remove('aura-active');
        document.body.classList.remove('fire-cursor-enabled');
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        canvas.hidden = true;
    }

    function refresh() {
        if (!motionEnabled() || document.hidden) {
            clear();
            return;
        }
        if (!hasFinePointer() || !pointer.visible) document.body.classList.remove('fire-cursor-enabled');
        if (!hasFinePointer()) {
            document.body.classList.remove('fire-cursor-enabled');
            pointer.visible = false;
            pointer.active = false;
            pointer.mode = 'normal';
            hoverTarget = 0;
            wake();
        }
    }

    function destroy() {
        clear();
        destroyed = true;
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerover', onPointerOver);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('pointerout', onPointerOut);
        window.removeEventListener('blur', onWindowBlur);
        document.removeEventListener('visibilitychange', refresh);
        window.removeEventListener('projeto-fenix:prefs-changed', refresh);
        reducedMotionQuery?.removeEventListener?.('change', refresh);
        finePointerQuery?.removeEventListener?.('change', refresh);
        topLayerObserver.disconnect();
        dialogContentObserver.disconnect();
        document.removeEventListener('close', syncTopLayer, true);
        canvas.remove();
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerover', onPointerOver, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    window.addEventListener('pointerout', onPointerOut, { passive: true });
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('projeto-fenix:prefs-changed', refresh);
    reducedMotionQuery?.addEventListener?.('change', refresh);
    finePointerQuery?.addEventListener?.('change', refresh);
    resize();
    refresh();

    return { refresh, destroy };
}
