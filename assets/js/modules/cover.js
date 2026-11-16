/**
 * Capas geradas por código (SVG original, determinístico por `cover.seed`).
 *
 * Por que isso existe: não presumimos direitos sobre imagens de jogos. Enquanto não houver capa
 * licenciada/autorizada (`cover.type = "image"`), o Projeto Fênix gera uma arte abstrata própria —
 * nada aqui reproduz personagens, logotipos ou artes de terceiros.
 */
import { hashString, mulberry32 } from './utils.js';

const SIZES = Object.freeze({ poster: [600, 800], wide: [1280, 720], banner: [1920, 820], thumb: [320, 180] });

const PALETTES = [
    ['#0D0D0D', '#2B2B2B', '#F20519', '#F27405'],
    ['#0D0D0D', '#A60311', '#F27405', '#F20519'],
    ['#1A1A1A', '#2B2B2B', '#F27405', '#A60311'],
    ['#0D0D0D', '#A60311', '#F20519', '#F27405'],
    ['#2B2B2B', '#A60311', '#F27405', '#F20519'],
];

const cache = new Map();
const f = (n) => Math.round(n * 10) / 10;

/* ---------- Motivos ---------- */

function motifTiles(w, h, p, rand) {
    const size = Math.min(w, h) * 0.17;
    const gap = size * 0.14;
    const grid = 4 * size + 3 * gap;
    const ox = (w > h ? w * 0.66 : w / 2) - grid / 2;
    const oy = (w > h ? h / 2 : h * 0.4) - grid / 2;
    let out = '';
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const hot = rand() < 0.24;
            const x = ox + c * (size + gap);
            const y = oy + r * (size + gap);
            const op = hot ? 0.55 + rand() * 0.35 : 0.08 + rand() * 0.22;
            out += `<rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" rx="${f(size * 0.16)}" fill="${hot ? p[2] : '#fff'}" opacity="${f(op * 100) / 100}"${hot ? ` stroke="${p[2]}" stroke-width="2"` : ''}/>`;
        }
    }
    return out;
}

function motifHex(w, h, p, rand) {
    const r = Math.min(w, h) * 0.085;
    const dx = r * Math.sqrt(3);
    const dy = r * 1.5;
    const fx = w * (w > h ? 0.68 : 0.6);
    const fy = h * 0.38;
    const maxD = Math.hypot(w, h) * 0.7;
    let out = '';
    for (let row = -1; row < h / dy + 1; row++) {
        for (let col = -1; col < w / dx + 1; col++) {
            const cx = col * dx + (row % 2 ? dx / 2 : 0);
            const cy = row * dy;
            const fade = Math.max(0, 1 - Math.hypot(cx - fx, cy - fy) / maxD);
            if (fade < 0.12) continue;
            let d = '';
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i - Math.PI / 6;
                d += `${i ? 'L' : 'M'}${f(cx + r * 0.92 * Math.cos(a))} ${f(cy + r * 0.92 * Math.sin(a))}`;
            }
            const filled = rand() < 0.14 * fade * 2;
            out += `<path d="${d}Z" fill="${filled ? p[2] : 'none'}" fill-opacity="${filled ? f(fade * 60) / 100 : 0}" stroke="${p[2]}" stroke-opacity="${f(fade * 70) / 100}" stroke-width="1.5"/>`;
        }
    }
    return out;
}

function motifChecks(w, h, p, rand) {
    const s = Math.min(w, h) * 0.115;
    const cx = w > h ? w * 0.66 : w / 2;
    const cy = w > h ? h * 0.5 : h * 0.4;
    let out = `<g transform="translate(${f(cx)} ${f(cy)}) rotate(-16) skewX(-10) translate(${f(-4 * s)} ${f(-4 * s)})">`;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const dark = (r + c) % 2 === 1;
            const hot = rand() < 0.07;
            out += `<rect x="${f(c * s)}" y="${f(r * s)}" width="${f(s)}" height="${f(s)}" fill="${hot ? p[2] : '#fff'}" opacity="${hot ? 0.7 : dark ? 0.2 : 0.05}"/>`;
        }
    }
    return `${out}<rect x="0" y="0" width="${f(8 * s)}" height="${f(8 * s)}" fill="none" stroke="${p[2]}" stroke-width="3" opacity=".7"/></g>`;
}

function motifCubes(w, h, p, rand) {
    const a = Math.min(w, h) * 0.075;
    const ox = w > h ? w * 0.66 : w / 2;
    const oy = (w > h ? h * 0.44 : h * 0.36) - a;
    const cube = (x, y, hot) => {
        const k = 0.866;
        const top = `${f(x)},${f(y - a)} ${f(x + a * k)},${f(y - a / 2)} ${f(x)},${f(y)} ${f(x - a * k)},${f(y - a / 2)}`;
        const left = `${f(x - a * k)},${f(y - a / 2)} ${f(x)},${f(y)} ${f(x)},${f(y + a)} ${f(x - a * k)},${f(y + a / 2)}`;
        const right = `${f(x)},${f(y)} ${f(x + a * k)},${f(y - a / 2)} ${f(x + a * k)},${f(y + a / 2)} ${f(x)},${f(y + a)}`;
        const tone = hot ? p[2] : '#fff';
        return `<polygon points="${top}" fill="${tone}" opacity="${hot ? 0.85 : 0.34}"/><polygon points="${left}" fill="${p[3]}" opacity="${hot ? 0.55 : 0.28}"/><polygon points="${right}" fill="${p[1]}" opacity=".95"/><polyline points="${top} ${f(x)},${f(y - a)}" fill="none" stroke="${p[2]}" stroke-opacity=".5" stroke-width="1.2"/>`;
    };
    const heights = [];
    for (let i = 0; i < 4; i++) {
        heights.push([]);
        for (let j = 0; j < 4; j++) heights[i].push(1 + Math.floor(rand() * 3));
    }
    const order = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) order.push([i, j]);
    order.sort((m, n) => m[0] + m[1] - (n[0] + n[1]));
    let out = '';
    for (const [i, j] of order) {
        for (let lvl = 0; lvl < heights[i][j]; lvl++) {
            out += cube(ox + (i - j) * a * 0.866, oy + (i + j) * a * 0.5 - lvl * a, lvl === heights[i][j] - 1 && rand() < 0.3);
        }
    }
    return out;
}

function motifPeaks(w, h, p, rand) {
    let out = '';
    const mr = Math.min(w, h) * 0.075;
    const mx = w * (w > h ? 0.72 : 0.68);
    const my = h * 0.26;
    out += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr * 2.6)}" fill="url(#glow)"/><circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="${p[2]}" opacity=".85"/>`;
    for (let i = 0; i < 34; i++) out += `<circle cx="${f(rand() * w)}" cy="${f(rand() * h * 0.5)}" r="${f(0.8 + rand() * 1.8)}" fill="#fff" opacity="${f(0.2 + rand() * 0.5)}"/>`;
    for (let layer = 0; layer < 4; layer++) {
        const base = h * (0.56 + layer * 0.1);
        const amp = h * (0.26 - layer * 0.045);
        const steps = 9;
        let d = `M0 ${f(h)} L0 ${f(base - rand() * amp)}`;
        for (let s = 1; s <= steps; s++) d += ` L${f((w / steps) * s)} ${f(base - rand() * amp)}`;
        d += ` L${f(w)} ${f(h)}Z`;
        out += `<path d="${d}" fill="${layer % 2 ? p[1] : p[0]}" opacity="${f(0.45 + layer * 0.16)}" stroke="${p[2]}" stroke-opacity="${f(0.35 - layer * 0.07)}" stroke-width="1.5"/>`;
    }
    return out;
}

function motifCircuit(w, h, p, rand) {
    const g = Math.min(w, h) / 16;
    const cx = Math.round((w * 0.56) / g) * g;
    const cy = Math.round((h * 0.4) / g) * g;
    const half = g * 2;
    // Chip central com brilho: garante um foco visual mesmo quando a capa é recortada (cards quadrados).
    let out = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(g * 7)}" fill="url(#glow)" opacity=".7"/>`;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Trilhas ortogonais partindo dos pinos do chip.
    for (let i = 0; i < 24; i++) {
        const [dx, dy] = dirs[i % 4];
        const lane = (Math.floor(rand() * 5) - 2) * (g * 0.7);
        let x = cx + (dx ? dx * half : lane);
        let y = cy + (dy ? dy * half : lane);
        let d = `M${f(x)} ${f(y)}`;
        let horizontal = dx !== 0;
        const segs = 2 + Math.floor(rand() * 3);
        for (let s = 0; s < segs; s++) {
            const sign = s === 0 ? (horizontal ? dx : dy) : (rand() < 0.5 ? -1 : 1);
            const len = (1 + Math.floor(rand() * 4)) * g * sign;
            if (horizontal) x += len;
            else y += len;
            d += ` L${f(x)} ${f(y)}`;
            horizontal = !horizontal;
        }
        const hot = rand() < 0.4;
        out += `<path d="${d}" fill="none" stroke="${hot ? p[2] : p[3]}" stroke-opacity="${hot ? 0.8 : 0.45}" stroke-width="${hot ? 2.5 : 1.5}" stroke-linejoin="round"/>`;
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(g * 0.22)}" fill="${hot ? p[2] : p[3]}" opacity=".9"/>`;
    }
    out += `<rect x="${f(cx - half)}" y="${f(cy - half)}" width="${f(half * 2)}" height="${f(half * 2)}" rx="${f(g * 0.4)}" fill="${p[0]}" stroke="${p[2]}" stroke-width="3" stroke-opacity=".9"/>`;
    out += `<rect x="${f(cx - half / 2)}" y="${f(cy - half / 2)}" width="${f(half)}" height="${f(half)}" rx="${f(g * 0.2)}" fill="${p[2]}" opacity=".55"/>`;
    return out;
}

const MOTIFS = { tiles: motifTiles, hex: motifHex, checks: motifChecks, cubes: motifCubes, peaks: motifPeaks, circuit: motifCircuit };

/* ---------- Montagem ---------- */

function buildSvg(item, variant) {
    const [w, h] = SIZES[variant] ?? SIZES.poster;
    const seedText = item.cover?.seed || item.slug || item.id || 'Projeto Fênix';
    const base = hashString(seedText);
    const p = PALETTES[base % PALETTES.length];
    const rand = mulberry32(base ^ (w * 31 + h));
    const motif = MOTIFS[item.cover?.motif] ?? MOTIFS.circuit;
    const m = Math.min(w, h) * 0.045;
    const L = Math.min(w, h) * 0.09;
    const bracket = (x, y, sx, sy) => `<path d="M${f(x)} ${f(y + sy * L)} V${f(y)} H${f(x + sx * L)}" fill="none" stroke="${p[2]}" stroke-opacity=".55" stroke-width="2"/>`;
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">` +
        `<defs>` +
        `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset=".55" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient>` +
        `<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${p[2]}" stop-opacity=".55"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></radialGradient>` +
        `<radialGradient id="g1" cx=".72" cy=".25" r=".75"><stop offset="0" stop-color="${p[2]}" stop-opacity=".45"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></radialGradient>` +
        `<radialGradient id="g2" cx=".15" cy=".9" r=".7"><stop offset="0" stop-color="${p[3]}" stop-opacity=".4"/><stop offset="1" stop-color="${p[3]}" stop-opacity="0"/></radialGradient>` +
        `<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#0D0D0D" stop-opacity="0"/><stop offset="1" stop-color="#0D0D0D" stop-opacity=".88"/></linearGradient>` +
        `<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#fff" opacity=".05"/></pattern>` +
        `</defs>` +
        `<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#g1)"/><rect width="${w}" height="${h}" fill="url(#g2)"/>` +
        motif(w, h, p, rand) +
        `<rect width="${w}" height="${h}" fill="url(#scan)"/>` +
        bracket(m, m, 1, 1) + bracket(w - m, m, -1, 1) + bracket(m, h - m, 1, -1) + bracket(w - m, h - m, -1, -1) +
        `<rect width="${w}" height="${h}" fill="url(#shade)"/>` +
        `</svg>`
    );
}

/**
 * URL da capa de um jogo. Usa a imagem autorizada (`cover.type = "image"`) quando existir;
 * caso contrário, gera a arte original. `variant`: poster (3:4), wide (16:9), banner (21:9), thumb.
 */
export function coverSrc(item, variant = 'poster') {
    if (item.cover?.type === 'image' && item.cover.src) return item.cover.src;
    const key = `${item.cover?.seed || item.slug}|${item.cover?.motif}|${variant}`;
    let uri = cache.get(key);
    if (!uri) {
        uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSvg(item, variant))}`;
        cache.set(key, uri);
    }
    return uri;
}

export const coverSize = (variant) => SIZES[variant] ?? SIZES.poster;

/** Cor de destaque da paleta usada na arte gerada de `item` (mesma regra do `buildSvg`): dá identidade própria a cada gênero/jogo. */
export function coverAccent(item) {
    const base = hashString(item.cover?.seed || item.slug || item.id || 'Projeto Fênix');
    return PALETTES[base % PALETTES.length][2];
}
