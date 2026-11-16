/**
 * Períodos cronológicos (página Recentes). Funções puras, sem DOM.
 *
 * Tudo vem das datas REAIS cadastradas em data/games.json (`dateAdded`, `dateUpdated`):
 * nenhuma data é estimada ou inventada. A data de inclusão é a do cadastro no Projeto Fênix,
 * não a do lançamento do jogo original.
 *
 * Períodos (relativos a "hoje", no dia de calendário local):
 *   Hoje · Nos últimos 7 dias · Nos últimos 30 dias · <mês de ano> (mais antigos) · Sem data informada
 */
import { config } from '../config.js';
import { daysSince, parseDate, formatDate } from './utils.js';

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** O jogo teve a ficha atualizada DEPOIS de entrar no catálogo? (atualização igual à inclusão não conta) */
export function wasUpdated(game) {
    const added = parseDate(game.dateAdded);
    const updated = parseDate(game.dateUpdated);
    return added !== null && updated !== null && updated > added;
}

/** Período ao qual uma data pertence: `{ key, label }`. */
export function periodOf(iso, now = Date.now()) {
    if (parseDate(iso) === null) return { key: 'nodate', label: 'Sem data informada' };
    const days = daysSince(iso, now);
    if (days === 0) return { key: 'today', label: 'Hoje' };
    if (days > 0 && days <= 7) return { key: 'week', label: 'Nos últimos 7 dias' };
    if (days > 0 && days <= 30) return { key: 'month', label: 'Nos últimos 30 dias' };
    const m = /^(\d{4})-(\d{2})/.exec(iso);
    if (!m) return { key: 'nodate', label: 'Sem data informada' };
    return { key: `${m[1]}-${m[2]}`, label: capitalize(monthFormatter.format(new Date(Date.UTC(+m[1], +m[2] - 1, 1)))) };
}

/**
 * Agrupa jogos (já ordenados por data) em períodos, na ordem em que aparecem.
 * Retorna `[{ key, label, games, first, last }]`, com `first`/`last` = menor/maior data do grupo.
 */
export function groupByPeriod(games, field, now = Date.now()) {
    const groups = new Map();
    for (const game of games) {
        const period = periodOf(game[field], now);
        if (!groups.has(period.key)) groups.set(period.key, { ...period, games: [], first: null, last: null });
        const group = groups.get(period.key);
        group.games.push(game);
        const ts = parseDate(game[field]);
        if (ts !== null) {
            if (group.first === null || ts < parseDate(group.first)) group.first = game[field];
            if (group.last === null || ts > parseDate(group.last)) group.last = game[field];
        }
    }
    return [...groups.values()];
}

/** Há períodos distintos suficientes para valer a separação visual? (`config.recent.minPeriodsToSplit`) */
export const shouldSplit = (groups) => groups.length >= config.recent.minPeriodsToSplit;

/** Texto da data (ou intervalo) real de um conjunto de jogos: "5 de novembro de 2026" ou "de 3 a 5 de novembro de 2026". */
export function describeDates(games, field) {
    const stamps = games.map((g) => g[field]).filter((iso) => parseDate(iso) !== null).sort((a, b) => parseDate(a) - parseDate(b));
    if (!stamps.length) return 'Sem data informada';
    const first = stamps[0];
    const last = stamps[stamps.length - 1];
    return parseDate(first) === parseDate(last) ? formatDate(first) : `de ${formatDate(first, true)} a ${formatDate(last, true)}`;
}

/** Ordena cronologicamente por `field`: `dir` 'desc' (mais novo primeiro) ou 'asc'. Empate → nome; sem data vai para o fim. */
export function sortByDate(games, field, dir = 'desc') {
    const sign = dir === 'asc' ? 1 : -1;
    const missing = dir === 'asc' ? Infinity : -Infinity;
    const stamp = (game) => parseDate(game[field]) ?? missing;
    return [...games].sort((a, b) => {
        const diff = stamp(a) === stamp(b) ? 0 : sign * (stamp(a) - stamp(b));
        return diff || a.name.localeCompare(b.name, 'pt-BR');
    });
}
