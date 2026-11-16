/**
 * Brasas ascendentes em Canvas 2D, sem dependências externas.
 * O canvas é decorativo, fica atrás da interface e respeita movimento reduzido.
 */
import { clamp, debounce, prefersReducedMotion } from './utils.js';
import { getPrefs } from './storage.js';

// Parâmetros visuais editáveis.
export const PARTICLE_COUNT = 160;
export const PARTICLE_SPEED = 72;
export const PARTICLE_SIZE = 1.55;
export const PARTICLE_OPACITY = 0.68;
export const PARTICLE_GLOW = 7.5;
export const PARTICLE_SPAWN_RATE = 28;
export const PARTICLE_DRIFT = 18;
export const PARTICLE_LIFETIME = 7600;
export const ANIMATION_INTENSITY = 0.94;

const COLORS = [
    [147, 35, 9],   // #932309 — brasa escura
    [198, 47, 8],   // #C62F08 — vermelho alaranjado
    [240, 72, 7],   // #F04807 — laranja intenso
    [255, 105, 12], // #FF690C — faísca viva
    [255, 157, 43], // #FF9D2B — núcleo quente, raro
];
const TAU = Math.PI * 2;
const MAX_DPR = 1.5;

export function motionEnabled() {
    const preference = getPrefs().motion;
    if (preference === 'off') return false;
    if (preference === 'on') return true;
    return !prefersReducedMotion();
}

function particleLimit(width) {
    if (width <= 600) return clamp(Math.round(PARTICLE_COUNT * 0.34), 48, 64);
    if (width <= 1024) return clamp(Math.round(PARTICLE_COUNT * 0.62), 88, 112);
    return clamp(PARTICLE_COUNT, 144, 192);
}

function colorString(color, alpha) {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

export function initParticles(canvas) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return { refresh() { }, destroy() { } };

    const particleSprites = COLORS.map((color) => {
        const sprite = document.createElement('canvas');
        sprite.width = 64;
        sprite.height = 64;
        const spriteContext = sprite.getContext('2d');
        if (!spriteContext) return sprite;
        const gradient = spriteContext.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 232, 177, 0.94)');
        gradient.addColorStop(0.12, colorString(color, 0.92));
        gradient.addColorStop(0.36, colorString(color, 0.62));
        gradient.addColorStop(0.72, colorString(color, 0.18));
        gradient.addColorStop(1, colorString(color, 0));
        spriteContext.fillStyle = gradient;
        spriteContext.fillRect(0, 0, 64, 64);
        return sprite;
    });

    const footer = document.querySelector('#site-footer');
    const reducedMotionQuery = typeof matchMedia === 'function'
        ? matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let targetCount = 0;
    let active = [];
    const pool = [];
    let frameId = 0;
    let lastTime = 0;
    let spawnProgress = 0;
    let running = false;
    let destroyed = false;

    function emitterY() {
        const rect = footer?.getBoundingClientRect();
        // Use the real footer edge while it is visible; otherwise keep the source
        // just below the viewport so the ambience remains present while browsing.
        if (rect && rect.top >= 0 && rect.top <= height) return rect.top + 3;
        return height + 5;
    }

    function release(particle) {
        particle.life = particle.maxLife;
        pool.push(particle);
    }

    function createParticle(now, sourceY, warmStart = false) {
        const particle = pool.pop() || {};
        const kind = Math.random();
        const fast = kind < 0.12;
        const spark = kind >= 0.62;
        let colorIndex;
        if (fast) colorIndex = Math.random() < 0.72 ? 2 : 3;
        else if (spark) {
            const warmth = Math.random();
            colorIndex = warmth < 0.64 ? 2 : warmth < 0.94 ? 3 : 4;
        } else {
            const warmth = Math.random();
            colorIndex = warmth < 0.1 ? 0 : warmth < 0.48 ? 1 : 2;
        }
        const speed = PARTICLE_SPEED * (fast ? 1.25 + Math.random() * 0.75 : 0.55 + Math.random() * 0.72);

        particle.positionX = Math.random() * width;
        particle.positionY = sourceY + Math.random() * 5;
        particle.velocityX = (Math.random() - 0.5) * PARTICLE_SPEED * (fast ? 1.4 : 0.82);
        particle.velocityY = -speed;
        particle.size = PARTICLE_SIZE * (spark ? 0.65 + Math.random() * 1.05 : fast ? 0.5 + Math.random() * 0.55 : 0.42 + Math.random() * 0.65);
        particle.opacity = PARTICLE_OPACITY * (0.6 + Math.random() * 0.6) * (fast ? 0.78 : 1);
        particle.maxLife = PARTICLE_LIFETIME * (fast ? 0.38 + Math.random() * 0.3 : 0.62 + Math.random() * 0.78);
        particle.life = 0;
        particle.glow = spark ? PARTICLE_GLOW * (0.45 + Math.random() * 0.5) : (kind > 0.43 ? PARTICLE_GLOW * 0.16 : 0);
        particle.flicker = 2 + Math.random() * 5;
        particle.drift = PARTICLE_DRIFT * (0.45 + Math.random() * 0.9);
        particle.driftRate = 0.45 + Math.random() * 0.9;
        particle.phase = Math.random() * TAU;
        particle.colorIndex = colorIndex;
        particle.color = COLORS[colorIndex];
        particle.trail = (spark || fast) && Math.random() < (fast ? 0.78 : 0.58);
        particle.trailLength = 6 + Math.random() * (spark ? 16 : 6);
        particle.ceilingY = Math.max(-12, sourceY - Math.min(height * 0.62, 540));
        particle.createdAt = now;

        if (warmStart) {
            const age = Math.random() * particle.maxLife * 0.55;
            const maxVisibleAge = Math.max(0, ((sourceY - particle.ceilingY) / speed) * 1000);
            particle.life = Math.min(age, maxVisibleAge);
            particle.positionY += particle.velocityY * (particle.life / 1000);
        }

        return particle;
    }

    function addParticle(now, sourceY, warmStart = false) {
        active.push(createParticle(now, sourceY, warmStart));
    }

    function resize() {
        const oldWidth = width;
        const oldHeight = height;
        width = window.innerWidth;
        height = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        targetCount = particleLimit(width);

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (oldWidth && oldHeight) {
            for (const particle of active) {
                particle.positionX = (particle.positionX / oldWidth) * width;
                particle.positionY = (particle.positionY / oldHeight) * height;
                particle.ceilingY = Math.max(-12, particle.positionY - Math.min(height * 0.62, 540));
            }
        }

        while (active.length > targetCount) release(active.pop());
        spawnProgress = Math.min(spawnProgress, 1);
    }

    function retire(index) {
        release(active[index]);
        active[index] = active[active.length - 1];
        active.pop();
    }

    function drawParticle(particle, now) {
        const progress = particle.life / particle.maxLife;
        const fadeIn = clamp(progress / 0.16, 0, 1);
        const fadeOut = clamp((1 - progress) / 0.42, 0, 1);
        const flicker = 0.76 + 0.24 * Math.sin((now / 1000) * particle.flicker + particle.phase);
        const alpha = particle.opacity * fadeIn * fadeOut * flicker * ANIMATION_INTENSITY;
        if (alpha < 0.006) return;

        const color = colorString(particle.color, alpha);
        if (particle.trail) {
            const speed = Math.hypot(particle.velocityX, particle.velocityY) || 1;
            ctx.beginPath();
            ctx.moveTo(particle.positionX, particle.positionY);
            ctx.lineTo(
                particle.positionX - (particle.velocityX / speed) * particle.trailLength,
                particle.positionY - (particle.velocityY / speed) * particle.trailLength
            );
            ctx.strokeStyle = colorString(particle.color, alpha * 0.46);
            ctx.lineWidth = Math.max(0.45, particle.size * 0.7);
            ctx.stroke();
        }

        if (particle.glow > 0.5) {
            const spriteSize = particle.size * 2.6 + particle.glow * 0.8;
            ctx.globalAlpha = alpha;
            ctx.drawImage(
                particleSprites[particle.colorIndex],
                particle.positionX - spriteSize / 2,
                particle.positionY - spriteSize / 2,
                spriteSize,
                spriteSize
            );
            ctx.globalAlpha = 1;
        } else {
            ctx.beginPath();
            ctx.arc(particle.positionX, particle.positionY, particle.size, 0, TAU);
            ctx.fillStyle = color;
            ctx.fill();
        }
    }

    function tick(now) {
        if (!running) return;
        const delta = lastTime ? Math.min(now - lastTime, 50) : 16.7;
        const seconds = delta / 1000;
        lastTime = now;
        ctx.clearRect(0, 0, width, height);

        for (let i = active.length - 1; i >= 0; i--) {
            const particle = active[i];
            const progress = particle.life / particle.maxLife;
            const sway = Math.sin((now / 1000) * particle.driftRate + particle.phase) * particle.drift;
            particle.positionX += (particle.velocityX + sway) * seconds;
            particle.positionY += particle.velocityY * seconds * (0.88 + progress * 0.2);
            particle.life += delta;

            if (particle.positionX < -12) particle.positionX = width + 8;
            else if (particle.positionX > width + 12) particle.positionX = -8;

            if (particle.life >= particle.maxLife || particle.positionY <= particle.ceilingY) {
                retire(i);
                continue;
            }
            drawParticle(particle, now);
        }

        const deviceRate = width <= 600 ? 0.5 : width <= 1024 ? 0.72 : 1;
        const spawnRate = PARTICLE_SPAWN_RATE * deviceRate;
        spawnProgress += (delta / 1000) * spawnRate;
        const sourceY = emitterY();
        while (spawnProgress >= 1 && active.length < targetCount) {
            addParticle(now, sourceY);
            spawnProgress -= 1;
        }
        if (active.length >= targetCount) spawnProgress = Math.min(spawnProgress, 1);

        frameId = requestAnimationFrame(tick);
    }

    function start() {
        if (running || destroyed) return;
        running = true;
        canvas.hidden = false;
        resize();
        lastTime = 0;
        spawnProgress = 0;

        const warmCount = Math.min(targetCount, Math.round(targetCount * 0.34));
        const sourceY = emitterY();
        for (let i = 0; i < warmCount; i++) addParticle(performance.now(), sourceY, true);
        frameId = requestAnimationFrame(tick);
    }

    function stop() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(frameId);
        frameId = 0;
        lastTime = 0;
        spawnProgress = 0;
        for (const particle of active) pool.push(particle);
        active = [];
        ctx.clearRect(0, 0, width, height);
        canvas.hidden = true;
    }

    function refresh() {
        if (motionEnabled() && !document.hidden) start();
        else stop();
    }

    const onResize = debounce(() => running && resize(), 160);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('projeto-fenix:prefs-changed', refresh);
    reducedMotionQuery?.addEventListener?.('change', refresh);

    function destroy() {
        stop();
        destroyed = true;
        onResize.cancel?.();
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', refresh);
        window.removeEventListener('projeto-fenix:prefs-changed', refresh);
        reducedMotionQuery?.removeEventListener?.('change', refresh);
    }

    refresh();
    return { refresh, destroy };
}
