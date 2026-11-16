/**
 * Armazenamento local versionado.
 * - Chaves: `projeto-fenix:v1:<nome>`.
 * - Se o localStorage estiver indisponível (modo privado, bloqueio), usa memória durante a sessão.
 * - Todo valor lido passa por validação; dados corrompidos são descartados.
 */
import { config } from '../config.js';

const memory = new Map();
let persistent = null;

export const KEYS = Object.freeze({
    favorites: 'favorites',
    history: 'history',
    access: 'access',
    prefs: 'prefs',
    consent: 'consent',
});

const fullKey = (name) => `${config.storage.prefix}:v${config.storage.version}:${name}`;

function canPersist() {
    if (persistent !== null) return persistent;
    try {
        const probe = `${config.storage.prefix}:probe`;
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        persistent = true;
    } catch {
        persistent = false;
    }
    return persistent;
}

export const isPersistent = () => canPersist();

// Importa dados locais que já existiam antes da troca de identidade do site.
const previousNamespace = ['play', 'hub'].join('');
function migratePreviousNamespace() {
    try {
        if (!canPersist()) return;
        const oldPrefix = `${previousNamespace}:v${config.storage.version}:`;
        const newPrefix = `${config.storage.prefix}:v${config.storage.version}:`;
        const oldKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
            .filter((key) => key && key.startsWith(oldPrefix));
        for (const oldKey of oldKeys) {
            const newKey = `${newPrefix}${oldKey.slice(oldPrefix.length)}`;
            const value = localStorage.getItem(oldKey);
            if (value !== null && localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
            localStorage.removeItem(oldKey);
        }
    } catch {
        /* ignora */
    }
}
migratePreviousNamespace();

export function read(name, fallback, validate) {
    const key = fullKey(name);
    let raw = null;
    try {
        raw = canPersist() ? localStorage.getItem(key) : memory.get(key) ?? null;
    } catch {
        raw = memory.get(key) ?? null;
    }
    if (raw === null) return fallback;
    try {
        const value = JSON.parse(raw);
        return !validate || validate(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

export function write(name, value) {
    const key = fullKey(name);
    const raw = JSON.stringify(value);
    try {
        if (canPersist()) localStorage.setItem(key, raw);
        else memory.set(key, raw);
        return true;
    } catch {
        memory.set(key, raw);
        return false;
    }
}

export function remove(name) {
    const key = fullKey(name);
    memory.delete(key);
    try {
        if (canPersist()) localStorage.removeItem(key);
    } catch {
        /* ignora */
    }
}

/** Remove TODOS os dados do Projeto Fênix (qualquer versão) deste navegador. */
export function clearAll() {
    memory.clear();
    try {
        if (!canPersist()) return;
        const prefix = `${config.storage.prefix}:`;
        const oldPrefix = `${previousNamespace}:`;
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith(prefix) || k.startsWith(oldPrefix))) toRemove.push(k);
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
        /* ignora */
    }
}

/** Descarta chaves de versões antigas do esquema (ex.: projeto-fenix:v0:*). */
export function pruneOldVersions() {
    try {
        if (!canPersist()) return;
        const current = `${config.storage.prefix}:v${config.storage.version}:`;
        const prefix = `${config.storage.prefix}:v`;
        const old = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix) && !k.startsWith(current)) old.push(k);
        }
        old.forEach((k) => localStorage.removeItem(k));
    } catch {
        /* ignora */
    }
}

/* ---------- Preferências ---------- */

const DEFAULT_PREFS = Object.freeze({
    recordHistory: true,
    /** 'auto' segue o sistema (prefers-reduced-motion), 'on' ativa, 'off' desativa partículas e animações pesadas. */
    motion: 'auto',
});

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function getPrefs() {
    const stored = read(KEYS.prefs, {}, isObject);
    return {
        recordHistory: typeof stored.recordHistory === 'boolean' ? stored.recordHistory : DEFAULT_PREFS.recordHistory,
        motion: ['auto', 'on', 'off'].includes(stored.motion) ? stored.motion : DEFAULT_PREFS.motion,
    };
}

export function setPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    write(KEYS.prefs, next);
    window.dispatchEvent(new CustomEvent('projeto-fenix:prefs-changed', { detail: next }));
    return next;
}

/* ---------- Consentimento (tecnologias não essenciais) ---------- */

/**
 * Hoje o Projeto Fênix não usa nenhuma tecnologia não essencial (analytics, anúncios, rastreadores).
 * Qualquer serviço desse tipo, no futuro, só deve ser carregado se `canUseNonEssential()` retornar true.
 */
export function getConsent() {
    const stored = read(KEYS.consent, {}, isObject);
    return { nonEssential: stored.nonEssential === true, decidedAt: stored.decidedAt ?? null };
}

export function setConsent(nonEssential) {
    const next = { nonEssential: Boolean(nonEssential), decidedAt: new Date().toISOString() };
    write(KEYS.consent, next);
    window.dispatchEvent(new CustomEvent('projeto-fenix:consent-changed', { detail: next }));
    return next;
}

export const canUseNonEssential = () => getConsent().nonEssential === true;
