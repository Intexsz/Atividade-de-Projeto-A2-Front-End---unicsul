/**
 * Favoritos e histórico (armazenamento local).
 * Eventos emitidos em `window`:
 *   Projeto Fênix:favorites-changed  { id, active }
 *   Projeto Fênix:history-changed
 */
import { config } from '../config.js';
import { KEYS, read, write, getPrefs } from './storage.js';

const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isHistory = (v) =>
    Array.isArray(v) && v.every((x) => x && typeof x.id === 'string' && typeof x.at === 'string');

/* ---------- Favoritos (mais recente primeiro) ---------- */

export const getFavorites = () => read(KEYS.favorites, [], isStringArray);
export const isFavorite = (id) => getFavorites().includes(id);

function emitFavorites(id, active) {
    window.dispatchEvent(new CustomEvent('projeto-fenix:favorites-changed', { detail: { id, active } }));
}

export function addFavorite(id) {
    const list = getFavorites().filter((x) => x !== id);
    list.unshift(id);
    write(KEYS.favorites, list);
    emitFavorites(id, true);
}

export function removeFavorite(id) {
    write(KEYS.favorites, getFavorites().filter((x) => x !== id));
    emitFavorites(id, false);
}

export function toggleFavorite(id) {
    if (isFavorite(id)) {
        removeFavorite(id);
        return false;
    }
    addFavorite(id);
    return true;
}

export function clearFavorites() {
    write(KEYS.favorites, []);
    emitFavorites(null, false);
}

/* ---------- Histórico de jogos acessados ---------- */

export const getHistory = () => read(KEYS.history, [], isHistory);

function emitHistory() {
    window.dispatchEvent(new CustomEvent('projeto-fenix:history-changed'));
}

/** Registra um acesso (respeita a preferência "registrar histórico"). */
export function addHistory(id) {
    if (!getPrefs().recordHistory) return;
    const list = getHistory().filter((entry) => entry.id !== id);
    list.unshift({ id, at: new Date().toISOString() });
    write(KEYS.history, list.slice(0, config.history.max));
    emitHistory();
}

export function removeHistoryEntry(id) {
    write(KEYS.history, getHistory().filter((entry) => entry.id !== id));
    emitHistory();
}

export function clearHistory() {
    write(KEYS.history, []);
    emitHistory();
}
