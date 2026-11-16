/**
 * Autenticação local de demonstração para o site estático.
 * Não substitui autenticação de servidor nem um fluxo OAuth validado por provedor.
 */
import { config } from '../config.js';

const AUTH_KEY = `${config.storage.prefix}:v${config.storage.version}:auth`;
const USERS_KEY = `${AUTH_KEY}:users`;
const SESSION_KEY = `${AUTH_KEY}:session`;
const HASH_ITERATIONS = 180_000;
const encoder = new TextEncoder();

function readUsers() {
    try {
        const value = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        return Array.isArray(value) ? value.filter((user) => user && typeof user === 'object' && user.id && user.email && user.salt && user.passwordHash) : [];
    } catch {
        return [];
    }
}

function readSession() {
    try {
        const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        return value && typeof value.userId === 'string' ? value : null;
    } catch {
        return null;
    }
}

function saveSession(userId) {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, startedAt: Date.now() }));
        window.dispatchEvent(new CustomEvent('projeto-fenix:auth-changed'));
    } catch {
        throw new Error('O navegador não permitiu manter a sessão. Ative o armazenamento local e tente novamente.');
    }
}

function toHex(bytes) {
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
}

async function passwordHash(password, salt) {
    if (!globalThis.crypto?.subtle) throw new Error('A autenticação local precisa de um contexto seguro. Abra o site em localhost pelo Live Server.');
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: HASH_ITERATIONS, hash: 'SHA-256' }, key, 256);
    return toHex(bits);
}

function publicProfile(user) {
    return user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: typeof user.avatar === 'string' ? user.avatar : '',
        provider: user.provider || 'local',
    } : null;
}

export function getCurrentUser() {
    const session = readSession();
    if (!session) return null;
    return publicProfile(readUsers().find((user) => user.id === session.userId));
}

export async function registerLocalAccount({ name, email, password }) {
    const cleanName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLocaleLowerCase('pt-BR');
    if (cleanName.length < 2) throw new Error('Informe seu nome com pelo menos 2 caracteres.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Informe um e-mail válido.');
    if (typeof password !== 'string' || password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');

    const users = readUsers();
    if (users.some((user) => user.email === normalizedEmail)) throw new Error('Já existe uma conta neste navegador com esse e-mail.');

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const user = {
        id: crypto.randomUUID?.() || `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: cleanName,
        email: normalizedEmail,
        salt: toBase64(salt),
        passwordHash: await passwordHash(password, salt),
        provider: 'local',
        avatar: '',
        createdAt: new Date().toISOString(),
    };
    try {
        localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
    } catch {
        throw new Error('Não foi possível salvar a conta neste navegador. Verifique o espaço disponível e tente de novo.');
    }
    saveSession(user.id);
    return publicProfile(user);
}

export async function loginLocalAccount({ email, password }) {
    const normalizedEmail = String(email || '').trim().toLocaleLowerCase('pt-BR');
    const user = readUsers().find((entry) => entry.email === normalizedEmail);
    if (!user || typeof password !== 'string') throw new Error('E-mail ou senha incorretos.');
    let salt;
    try {
        salt = Uint8Array.from(atob(user.salt), (char) => char.charCodeAt(0));
    } catch {
        throw new Error('Não foi possível validar esta conta. Crie outra conta neste navegador.');
    }
    const candidate = await passwordHash(password, salt);
    if (candidate !== user.passwordHash) throw new Error('E-mail ou senha incorretos.');
    saveSession(user.id);
    return publicProfile(user);
}

export function logoutLocalAccount() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch {
        /* A tela ainda passa a tratar a sessão como encerrada após recarregar. */
    }
    window.dispatchEvent(new CustomEvent('projeto-fenix:auth-changed'));
}
