/**
 * Serviço de métricas de acesso.
 *
 * IMPORTANTE: sem backend, os números abaixo existem apenas neste navegador.
 * Eles nunca devem ser apresentados como estatísticas globais.
 *
 * Contrato (usado por catalog.js, filters.js e pelas páginas):
 *   source          'local' | 'remote'
 *   label           texto curto para a interface
 *   isGlobal        boolean
 *   recordAccess(id)
 *   getCount(id) -> number
 *   getWindow(id, days) -> { recent, previous }   (acessos nos últimos N dias × N dias anteriores)
 *   getTotals() -> { accesses, games, last }
 *   hasData() -> boolean
 *   reset()
 *
 * Para integrar uma API compartilhada no futuro, implemente RemoteMetrics e altere
 * `config.metrics.provider`. Ela deve informar a origem e a data de atualização dos números.
 */
import { config } from '../config.js';
import { KEYS, read, write, remove } from './storage.js';

const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Chave do dia no fuso do usuário (AAAA-MM-DD). Contagem diária é a base do comparativo "em alta". */
const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Soma os acessos dos `days` dias que terminam `offset` dias antes de hoje (offset 0 = hoje e os dias anteriores). */
function sumWindow(buckets, days, offset = 0) {
    if (!buckets) return 0;
    let total = 0;
    for (let i = offset; i < offset + days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        total += buckets[dayKey(d)] ?? 0;
    }
    return total;
}

class LocalMetrics {
    source = 'local';
    isGlobal = false;
    label = 'Popularidade local (acessos neste dispositivo)';

    /**
     * Cache dos dados já validados. Sem ele, ordenar um catálogo grande por acessos releria e
     * reprocessaria o localStorage a cada comparação. É invalidado quando este navegador grava,
     * apaga ou quando outra aba altera o armazenamento (evento `storage`).
     */
    #cache = null;

    constructor() {
        if (typeof window !== 'undefined') window.addEventListener('storage', () => { this.#cache = null; });
    }

    #load() {
        if (this.#cache) return this.#cache;
        const data = read(KEYS.access, {}, isRecord);
        const clean = {};
        for (const [id, entry] of Object.entries(data)) {
            if (isRecord(entry) && Number.isFinite(entry.count) && entry.count > 0) {
                // `days` é opcional: registros antigos (só total) continuam válidos, mas sem histórico diário.
                const days = {};
                if (isRecord(entry.days)) {
                    for (const [key, n] of Object.entries(entry.days)) {
                        if (DAY_KEY.test(key) && Number.isFinite(n) && n > 0) days[key] = Math.floor(n);
                    }
                }
                clean[id] = { count: Math.floor(entry.count), last: typeof entry.last === 'string' ? entry.last : null, days };
            }
        }
        this.#cache = clean;
        return clean;
    }

    recordAccess(id) {
        if (!id) return;
        const data = this.#load();
        const entry = data[id] ?? { count: 0, last: null, days: {} };
        const today = dayKey(new Date());
        entry.count += 1;
        entry.last = new Date().toISOString();
        entry.days[today] = (entry.days[today] ?? 0) + 1;
        // Mantém só a janela de retenção (privacidade: guardar o mínimo necessário).
        const limit = new Date();
        limit.setDate(limit.getDate() - config.metrics.retentionDays);
        const oldest = dayKey(limit);
        for (const key of Object.keys(entry.days)) if (key < oldest) delete entry.days[key];
        data[id] = entry;
        this.#cache = null;
        write(KEYS.access, data);
        window.dispatchEvent(new CustomEvent('projeto-fenix:metrics-changed', { detail: { id } }));
    }

    getCount(id) {
        return this.#load()[id]?.count ?? 0;
    }

    getLast(id) {
        return this.#load()[id]?.last ?? null;
    }

    /**
     * Acessos nos últimos `days` dias (a partir de hoje) e, se `previous`, nos `days` dias imediatamente anteriores.
     * Só conta acessos que têm data registrada — total antigo sem histórico diário não entra aqui.
     */
    getWindow(id, days = config.metrics.trendWindowDays) {
        const buckets = this.#load()[id]?.days;
        return { recent: sumWindow(buckets, days, 0), previous: sumWindow(buckets, days, days) };
    }

    /** Totais deste dispositivo: acessos, jogos com acesso e data do último acesso. */
    getTotals() {
        const data = this.#load();
        let accesses = 0;
        let last = null;
        for (const entry of Object.values(data)) {
            accesses += entry.count;
            if (entry.last && (!last || entry.last > last)) last = entry.last;
        }
        return { accesses, games: Object.keys(data).length, last };
    }

    hasData() {
        return Object.keys(this.#load()).length > 0;
    }

    reset() {
        this.#cache = null;
        remove(KEYS.access);
        window.dispatchEvent(new CustomEvent('projeto-fenix:metrics-changed', { detail: { id: null } }));
    }
}

/** Esqueleto para uma futura integração. Não faz requisições. */
class RemoteMetrics {
    source = 'remote';
    isGlobal = true;
    label = 'Popularidade global';
    constructor(options = {}) {
        this.options = options;
    }
    recordAccess() {
        throw new Error('RemoteMetrics ainda não foi implementado.');
    }
    getCount() {
        throw new Error('RemoteMetrics ainda não foi implementado.');
    }
    getWindow() {
        throw new Error('RemoteMetrics ainda não foi implementado.');
    }
    getTotals() {
        throw new Error('RemoteMetrics ainda não foi implementado.');
    }
    hasData() {
        return false;
    }
    reset() { }
}

function createMetrics() {
    if (config.metrics.provider === 'remote') return new RemoteMetrics();
    return new LocalMetrics();
}

export const metrics = createMetrics();
export { LocalMetrics, RemoteMetrics };
