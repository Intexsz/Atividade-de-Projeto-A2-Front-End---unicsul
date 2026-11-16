/**
 * Utilitários compartilhados (sem dependências).
 * Regra de segurança: o DOM é montado com createElement/textContent — nunca com innerHTML.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

function isUnsafeUrlValue(key, value) {
    const v = String(value);
    if (/^\s*data:image\/svg\+xml/i.test(v) && key === 'src') return false; // capas geradas
    return /^\s*(javascript|data|vbscript):/i.test(v);
}

function applyProps(node, props) {
    if (!props) return;
    for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined) continue;
        if (key.startsWith('aria-') && typeof value === 'boolean') {
            node.setAttribute(key, String(value));
            continue;
        }
        if (value === false) continue;
        if (key === 'class') node.setAttribute('class', value);
        else if (key === 'text') node.textContent = value;
        else if (key === 'dataset') {
            for (const [k, v] of Object.entries(value)) if (v !== null && v !== undefined) node.dataset[k] = v;
        } else if (key === 'style' && typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) {
                if (k.startsWith('--')) node.style.setProperty(k, v);
                else node.style[k] = v;
            }
        } else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) node.setAttribute(key, '');
        else {
            if (URL_ATTRS.has(key) && isUnsafeUrlValue(key, value)) continue;
            node.setAttribute(key, String(value));
        }
    }
}

function appendChildren(node, children) {
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        if (Array.isArray(child)) appendChildren(node, child);
        else if (child instanceof Node) node.appendChild(child);
        else node.appendChild(document.createTextNode(String(child)));
    }
}

/** Cria um elemento HTML. `el('div', { class: 'x' }, 'texto', outroNo)` */
export function el(tag, props, ...children) {
    const node = document.createElement(tag);
    applyProps(node, props);
    appendChildren(node, children);
    return node;
}

/** Cria um elemento SVG. */
export function svgEl(tag, props, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    applyProps(node, props);
    appendChildren(node, children);
    return node;
}

/** Ícone do sprite `assets/icons/sprite.svg` (símbolos `i-<nome>`). */
export function icon(name, { size = 20, label = '', className = '' } = {}) {
    const svg = svgEl('svg', {
        class: `icon icon--${name}${className ? ' ' + className : ''}`,
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        focusable: 'false',
        'aria-hidden': label ? null : 'true',
        role: label ? 'img' : null,
        'aria-label': label || null,
    });
    svg.appendChild(svgEl('use', { href: `assets/icons/sprite.svg#i-${name}` }));
    return svg;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
}

export function debounce(fn, wait = 150) {
    let timer = 0;
    const wrapped = (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
    wrapped.cancel = () => clearTimeout(timer);
    return wrapped;
}

/** Minúsculas, sem acentos — usado na pesquisa e na ordenação. */
export function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
}

export function slugify(value) {
    return normalizeText(value)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Aceita somente http(s). Retorna a URL normalizada ou null. */
export function safeHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
}

export function hostOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateShortFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

export function formatDate(iso, short = false) {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return 'Não informado';
    return (short ? dateShortFormatter : dateFormatter).format(new Date(ts));
}

export function parseDate(iso) {
    const ts = Date.parse(iso);
    return Number.isNaN(ts) ? null : ts;
}

export function daysSince(iso, now = Date.now()) {
    const ts = parseDate(iso);
    if (ts === null) return Infinity;
    // Datas sem hora (AAAA-MM-DD) contam por dia de calendário local: o selo e o período de um jogo
    // não mudam no meio da noite por causa do fuso horário.
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (day) {
        const today = new Date(now);
        return Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(+day[1], +day[2] - 1, +day[3])) / 86400000);
    }
    return Math.floor((now - ts) / 86400000);
}

export function pluralize(count, one, many) {
    return count === 1 ? one : many;
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** Hash FNV-1a de 32 bits. */
export function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** PRNG determinístico (mulberry32). */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function prefersReducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let uidCounter = 0;
export const uid = (prefix = 'ph') => `${prefix}-${++uidCounter}`;

export const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(container) {
    return $$(FOCUSABLE, container).filter((n) => n.offsetParent !== null || n === document.activeElement);
}

/** Mantém o foco dentro de `container` ao pressionar Tab. */
export function trapFocus(container, event) {
    if (event.key !== 'Tab') return;
    const items = focusableIn(container);
    if (!items.length) {
        event.preventDefault();
        container.focus();
        return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

/** Aleatório sem repetir `excludeId`. */
export function pickRandom(list, excludeId) {
    const pool = excludeId ? list.filter((item) => item.id !== excludeId) : list;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
