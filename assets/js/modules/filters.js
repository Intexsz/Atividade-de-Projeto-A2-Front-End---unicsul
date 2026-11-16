/**
 * Filtros combináveis + ordenação. Funções puras: recebem a lista de jogos e devolvem uma nova lista.
 *
 * Regras de combinação:
 *  - Dentro de um grupo (gêneros, plataformas, tipos) vale "OU": o jogo precisa ter ALGUM dos valores marcados.
 *  - Entre grupos vale "E": todos os grupos ativos precisam ser satisfeitos.
 *  - Status de desenvolvimento (`statuses`) segue a mesma regra de gêneros/plataformas/tipos (OU dentro do grupo).
 *  - Controles: `keys` com `match` 'all' (todos os controles marcados) ou 'any' (qualquer um);
 *    `level` 'accepted' (obrigatório OU compatível) ou 'required' (somente obrigatório);
 *    `exclusive` = o jogo aceita SOMENTE os marcados — exige que os demais estejam explicitamente
 *    "não suporta" (controles "não verificado" nunca contam como incompatíveis).
 */
import { CONTROL_KEYS, CONTROL_LABELS, PROJECT_TYPES, DEV_STATUS, isAccepted } from './catalog.js';
import { parseQuery, scoreGame } from './search.js';
import { metrics } from './metrics.js';
import { getFavorites } from './favorites.js';
import { normalizeText, parseDate, slugify } from './utils.js';

export const SORT_MODES = Object.freeze({
    relevance: 'Relevância',
    recent: 'Mais recentes',
    updated: 'Atualizados recentemente',
    popular: 'Mais populares (local)',
    accessed: 'Mais acessados (neste dispositivo)',
    trending: 'Em alta (últimos 7 dias, local)',
    az: 'Nome (A–Z)',
    za: 'Nome (Z–A)',
});

/** Ordenações oferecidas ao navegar por jogos (Todos os jogos e painel de Gêneros). */
export const CATALOG_SORTS = Object.freeze({
    recent: SORT_MODES.recent,
    updated: SORT_MODES.updated,
    popular: SORT_MODES.popular,
    accessed: SORT_MODES.accessed,
    az: SORT_MODES.az,
    za: SORT_MODES.za,
    relevance: 'Relevância (na busca)',
});

export function createEmptyFilters() {
    return {
        query: '',
        genres: [], // slugs
        platforms: [], // nomes
        types: [], // chaves de PROJECT_TYPES
        statuses: [], // chaves de DEV_STATUS (released, in-development, unverified)
        controls: { keys: [], match: 'all', level: 'accepted', exclusive: false },
        single: false,
        multi: false,
        mobile: false,
        save: false,
        issues: false,
        inDevelopment: false,
        letter: '',
    };
}

/** Letra de navegação A–Z de um nome ('#' = começa com número ou símbolo). */
export const firstLetter = (name) => {
    const c = normalizeText(name).replace(/[^a-z0-9]/g, '').charAt(0);
    return /[a-z]/.test(c) ? c.toUpperCase() : '#';
};

function matchesControls(game, c) {
    if (!c.keys.length) return true;
    const ok = (key) => (c.level === 'required' ? game.controls[key] === 'required' : isAccepted(game.controls[key]));
    const base = c.match === 'any' ? c.keys.some(ok) : c.keys.every(ok);
    if (!base) return false;
    if (!c.exclusive) return true;
    return CONTROL_KEYS.filter((k) => !c.keys.includes(k)).every((k) => game.controls[k] === 'unsupported');
}

export function applyFilters(games, f) {
    const tokens = parseQuery(f.query);
    return games.filter((g) => {
        if (tokens.length && !scoreGame(g, tokens)) return false;
        if (f.genres.length && !f.genres.some((s) => g.genreSlugs.includes(s))) return false;
        if (f.platforms.length && !f.platforms.includes(g.platform)) return false;
        if (f.types.length && !f.types.includes(g.projectType)) return false;
        if (f.statuses.length && !f.statuses.includes(g.developmentStatus)) return false;
        if (!matchesControls(g, f.controls)) return false;
        if (f.single && g.players.single !== 'yes') return false;
        if (f.multi && g.players.multi !== 'yes') return false;
        if (f.mobile && !(isAccepted(g.controls.touch) || g.devices.mobile === 'yes')) return false;
        if (f.save && !(g.save.status === 'yes' || g.save.status === 'partial')) return false;
        if (f.issues && !g.knownIssues.length) return false;
        if (f.inDevelopment && !(g.developmentStatus === 'in-development' || g.projectType === 'in-development')) return false;
        if (f.letter && firstLetter(g.name) !== f.letter) return false;
        return true;
    });
}

// Intl.Collator reaproveitado: ordenar milhares de nomes com localeCompare() a cada comparação é muito mais lento.
const collator = new Intl.Collator('pt-BR');
const byName = (a, b) => collator.compare(a.name, b.name);

/** Pontos que cada jogo favoritado soma na popularidade local. */
export const FAVORITE_POINTS = 2;

/** Modos de ordenação que são ranking de popularidade LOCAL (os demais só ordenam). */
export const RANKING_MODES = Object.freeze(['popular', 'accessed', 'trending']);

/**
 * Pontuação local de um jogo nos modos de ranking; `null` nos demais modos.
 * - accessed: total de acessos (JOGAR AGORA) neste dispositivo
 * - trending: acessos dos últimos dias (com data registrada)
 * - popular: acessos + FAVORITE_POINTS por favorito
 * `favs` (Set de ids) pode ser passado para não reler o localStorage a cada jogo.
 */
export function rankScore(game, mode, favs = null) {
    switch (mode) {
        case 'accessed': return metrics.getCount(game.id);
        case 'trending': return metrics.getWindow(game.id).recent;
        case 'popular': return metrics.getCount(game.id) + ((favs ?? new Set(getFavorites())).has(game.id) ? FAVORITE_POINTS : 0);
        default: return null;
    }
}

/** Retorna uma NOVA lista ordenada. Métricas de acesso são locais (neste dispositivo). */
export function sortGames(games, mode = 'recent', { query = '' } = {}) {
    const list = [...games];
    const dateDesc = (field) => (a, b) => (parseDate(b[field]) ?? 0) - (parseDate(a[field]) ?? 0) || byName(a, b);
    switch (mode) {
        case 'az':
            return list.sort(byName);
        case 'za':
            return list.sort((a, b) => byName(b, a));
        case 'updated':
            return list.sort(dateDesc('dateUpdated'));
        case 'accessed': {
            const score = new Map(list.map((g) => [g.id, rankScore(g, 'accessed')]));
            return list.sort((a, b) => score.get(b.id) - score.get(a.id) || byName(a, b));
        }
        case 'trending': {
            // Acessos dos últimos dias (com data registrada); empate → total de acessos → nome.
            const score = new Map(list.map((g) => [g.id, rankScore(g, 'trending')]));
            return list.sort((a, b) => score.get(b.id) - score.get(a.id) || metrics.getCount(b.id) - metrics.getCount(a.id) || byName(a, b));
        }
        case 'popular': {
            const favs = new Set(getFavorites());
            const score = new Map(list.map((g) => [g.id, rankScore(g, 'popular', favs)]));
            return list.sort((a, b) => score.get(b.id) - score.get(a.id) || (a.editorial.featuredOrder ?? 999) - (b.editorial.featuredOrder ?? 999) || byName(a, b));
        }
        case 'relevance': {
            const tokens = parseQuery(query);
            const score = new Map(list.map((g) => [g.id, scoreGame(g, tokens)]));
            return list.sort((a, b) => score.get(b.id) - score.get(a.id) || byName(a, b));
        }
        case 'recent':
        default:
            return list.sort(dateDesc('dateAdded'));
    }
}

/* ---------- Estado <-> URL ---------- */

const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export function queryToFilters(params) {
    const f = createEmptyFilters();
    f.query = (params.get('q') ?? '').slice(0, 120);
    f.genres = csv(params.get('genero')).map(slugify);
    f.platforms = csv(params.get('plataforma'));
    f.types = csv(params.get('tipo')).filter((t) => Object.hasOwn(PROJECT_TYPES, t));
    f.statuses = csv(params.get('status')).filter((t) => Object.hasOwn(DEV_STATUS, t));
    f.controls.keys = csv(params.get('controle')).filter((k) => CONTROL_KEYS.includes(k));
    f.controls.match = params.get('modo') === 'qualquer' ? 'any' : 'all';
    f.controls.level = params.get('nivel') === 'obrigatorio' ? 'required' : 'accepted';
    f.controls.exclusive = params.get('exclusivo') === '1';
    f.single = params.get('singleplayer') === '1';
    f.multi = params.get('multiplayer') === '1';
    f.mobile = params.get('mobile') === '1';
    f.save = params.get('salvamento') === '1';
    f.issues = params.get('problemas') === '1';
    f.inDevelopment = params.get('desenvolvimento') === '1';
    const letter = (params.get('letra') ?? '').toUpperCase();
    f.letter = /^[A-Z#]$/.test(letter) ? letter : '';
    return f;
}

export function filtersToQuery(f) {
    const p = new URLSearchParams();
    if (f.query) p.set('q', f.query);
    if (f.genres.length) p.set('genero', f.genres.join(','));
    if (f.platforms.length) p.set('plataforma', f.platforms.join(','));
    if (f.types.length) p.set('tipo', f.types.join(','));
    if (f.statuses.length) p.set('status', f.statuses.join(','));
    if (f.controls.keys.length) {
        p.set('controle', f.controls.keys.join(','));
        if (f.controls.match === 'any') p.set('modo', 'qualquer');
        if (f.controls.level === 'required') p.set('nivel', 'obrigatorio');
        if (f.controls.exclusive) p.set('exclusivo', '1');
    }
    if (f.single) p.set('singleplayer', '1');
    if (f.multi) p.set('multiplayer', '1');
    if (f.mobile) p.set('mobile', '1');
    if (f.save) p.set('salvamento', '1');
    if (f.issues) p.set('problemas', '1');
    if (f.inDevelopment) p.set('desenvolvimento', '1');
    if (f.letter) p.set('letra', f.letter);
    return p;
}

/**
 * Lista legível dos filtros ativos (para as "tags" removíveis do catálogo).
 * `names.genre(slug)` troca o slug pelo nome de exibição do gênero.
 */
export function describeActiveFilters(f, { genre = (slug) => slug } = {}) {
    const out = [];
    if (f.query) out.push({ key: 'query', label: `Busca: “${f.query}”` });
    f.genres.forEach((s) => out.push({ key: 'genre', value: s, label: `Gênero: ${genre(s)}` }));
    f.platforms.forEach((p) => out.push({ key: 'platform', value: p, label: `Plataforma: ${p}` }));
    f.types.forEach((t) => out.push({ key: 'type', value: t, label: `Tipo: ${PROJECT_TYPES[t]}` }));
    f.statuses.forEach((t) => out.push({ key: 'status', value: t, label: `Status: ${DEV_STATUS[t]}` }));
    if (f.controls.keys.length) {
        const names = f.controls.keys.map((k) => CONTROL_LABELS[k]).join(f.controls.match === 'any' ? ' ou ' : ' + ');
        const flags = [f.controls.level === 'required' ? 'obrigatório' : null, f.controls.exclusive ? 'somente' : null].filter(Boolean);
        out.push({ key: 'controls', label: `Controles: ${names}${flags.length ? ` (${flags.join(', ')})` : ''}` });
    }
    if (f.single) out.push({ key: 'single', label: 'Singleplayer' });
    if (f.multi) out.push({ key: 'multi', label: 'Multiplayer' });
    if (f.mobile) out.push({ key: 'mobile', label: 'Compatível com celular' });
    if (f.save) out.push({ key: 'save', label: 'Com salvamento' });
    if (f.issues) out.push({ key: 'issues', label: 'Com problemas conhecidos' });
    if (f.inDevelopment) out.push({ key: 'inDevelopment', label: 'Em desenvolvimento' });
    if (f.letter) out.push({ key: 'letter', label: `Letra: ${f.letter}` });
    return out;
}

export const countActiveFilters = (f) => describeActiveFilters(f).length;

/** Remove do objeto de filtros o item descrito por uma tag de `describeActiveFilters`. */
export function removeFilter(f, { key, value }) {
    switch (key) {
        case 'query': f.query = ''; break;
        case 'genre': f.genres = f.genres.filter((s) => s !== value); break;
        case 'platform': f.platforms = f.platforms.filter((p) => p !== value); break;
        case 'type': f.types = f.types.filter((t) => t !== value); break;
        case 'status': f.statuses = f.statuses.filter((t) => t !== value); break;
        case 'controls': f.controls = createEmptyFilters().controls; break;
        case 'letter': f.letter = ''; break;
        case 'single': case 'multi': case 'mobile': case 'save': case 'issues': case 'inDevelopment': f[key] = false; break;
        default: break;
    }
    return f;
}
