/**
 * Catálogo central: carrega data/games.json UMA vez, valida cada registro e expõe seletores.
 * Todas as páginas consultam este módulo — nunca cadastre jogos em outro lugar.
 *
 * Contrato dos dados: docs/DATA_SCHEMA.md
 */
import { config } from '../config.js';
import { normalizeText, slugify, safeHttpUrl, parseDate } from './utils.js';
import { metrics } from './metrics.js';

/* ---------- Vocabulários (rótulos em pt-BR) ---------- */

export const CONTROL_KEYS = Object.freeze(['keyboard', 'mouse', 'gamepad', 'touch']);
export const CONTROL_LABELS = Object.freeze({ keyboard: 'Teclado', mouse: 'Mouse', gamepad: 'Controle', touch: 'Toque' });
export const CONTROL_STATES = Object.freeze(['required', 'supported', 'unverified', 'unsupported']);
export const CONTROL_STATE_LABELS = Object.freeze({
    required: 'Obrigatório',
    supported: 'Compatível',
    unverified: 'Não verificado',
    unsupported: 'Não suporta',
});

export const PROJECT_TYPES = Object.freeze({
    'web-native': 'Web-native',
    port: 'Port',
    recreation: 'Recriação',
    emulator: 'Emulador',
    fangame: 'Fangame',
    'rom-hack': 'ROM Hack',
    'in-development': 'Projeto em desenvolvimento',
});
export const DEV_STATUS = Object.freeze({ released: 'Lançado', 'in-development': 'Em desenvolvimento', unverified: 'Não informado' });
export const SAVE_LABELS = Object.freeze({ yes: 'Sim', partial: 'Parcial', no: 'Não', unverified: 'Não verificado' });
export const PLAYER_LABELS = Object.freeze({ yes: 'Sim', no: 'Não', unverified: 'Não verificado' });
export const DEVICE_LABELS = Object.freeze({ yes: 'Sim', limited: 'Limitado', no: 'Não', unverified: 'Não verificado' });
export const LINK_STATUS_LABELS = Object.freeze({
    ok: 'Endereço verificado',
    partial: 'Verificação parcial',
    unverified: 'Endereço não verificado automaticamente',
});

/** Descrições editoriais por gênero (usadas nos cards de gênero). */
export const GENRE_INFO = Object.freeze({
    puzzle: { description: 'Lógica, padrões e raciocínio rápido em partidas curtas.', motif: 'tiles' },
    estrategia: { description: 'Planejamento, recursos e decisões que moldam o rumo da partida.', motif: 'hex' },
    aventura: { description: 'Exploração, narrativa e escolhas ao longo de uma jornada.', motif: 'peaks' },
    sandbox: { description: 'Mundos abertos para construir, explorar e criar sem roteiro fixo.', motif: 'cubes' },
    tabuleiro: { description: 'Jogos de tabuleiro clássicos, de xadrez a outros desafios de mesa.', motif: 'checks' },
    indie: { description: 'Projetos autorais de estúdios independentes e criadores solo.', motif: 'circuit' },
    arcade: { description: 'Ação direta, reflexos e pontuação no estilo dos fliperamas.', motif: 'circuit' },
    acao: { description: 'Reflexos, combate e movimento em ritmo acelerado.', motif: 'circuit' },
    corrida: { description: 'Velocidade, curvas e disputas contra o relógio.', motif: 'circuit' },
    esportes: { description: 'Partidas e competições inspiradas em esportes reais.', motif: 'checks' },
    luta: { description: 'Duelos, golpes e combos em arenas de combate.', motif: 'circuit' },
    rpg: { description: 'Personagens, evolução e histórias com decisões de peso.', motif: 'peaks' },
    simulacao: { description: 'Sistemas que reproduzem atividades, cidades e rotinas.', motif: 'hex' },
    tiro: { description: 'Mira, posicionamento e tempo de reação.', motif: 'circuit' },
    terror: { description: 'Tensão, atmosfera e sobrevivência diante do desconhecido.', motif: 'peaks' },
    plataforma: { description: 'Saltos, obstáculos e fases cheias de precisão.', motif: 'tiles' },
    sobrevivencia: { description: 'Recursos escassos e decisões para continuar vivo.', motif: 'peaks' },
    casual: { description: 'Partidas leves, fáceis de aprender e boas para pausas.', motif: 'tiles' },
});

/* ---------- Erros de carregamento ---------- */

export class CatalogError extends Error {
    constructor(kind, message, cause) {
        super(message);
        this.name = 'CatalogError';
        this.kind = kind;
        this.cause = cause;
    }
    get userMessage() {
        switch (this.kind) {
            case 'file-protocol':
                return 'Esta página foi aberta diretamente do arquivo (file://). Para carregar o catálogo, execute o site por um servidor HTTP local (veja o README).';
            case 'network':
                return 'Não foi possível carregar os dados do catálogo. Verifique sua conexão e tente novamente.';
            case 'http':
                return `O servidor respondeu com um erro ao carregar os dados (${this.message}).`;
            case 'parse':
                return 'Os dados do catálogo estão em formato inválido (JSON malformado).';
            default:
                return 'Os dados do catálogo estão incompletos ou inconsistentes.';
        }
    }
}

/** Leitura central de JSON com tratamento de erros. */
export async function loadJson(path) {
    if (location.protocol === 'file:') throw new CatalogError('file-protocol', 'file://');
    let response;
    try {
        response = await fetch(path, { cache: 'no-cache', headers: { Accept: 'application/json' } });
    } catch (error) {
        throw new CatalogError('network', 'falha de rede', error);
    }
    if (!response.ok) throw new CatalogError('http', `HTTP ${response.status} em ${path}`);
    try {
        return await response.json();
    } catch (error) {
        throw new CatalogError('parse', 'JSON inválido', error);
    }
}

/* ---------- Normalização e validação ---------- */

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const strList = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const dateOrNull = (v) => (typeof v === 'string' && parseDate(v) !== null ? v : null);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function safeLocalOrHttp(value) {
    const v = str(value);
    if (!v) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return safeHttpUrl(v);
    return /^(?!\/\/)[\w./-]+$/.test(v) && !v.includes('..') ? v : null;
}

export function normalizeCover(raw, fallbackSeed, fallbackMotif) {
    const cover = isObj(raw) ? raw : {};
    const src = cover.type === 'image' ? safeLocalOrHttp(cover.src) : null;
    return {
        type: src ? 'image' : 'generated',
        src,
        motif: str(cover.motif) || fallbackMotif || 'circuit',
        seed: str(cover.seed) || fallbackSeed,
        credit: str(cover.credit),
    };
}

export function normalizeGame(raw) {
    const errors = [];
    if (!isObj(raw)) return { game: null, errors: ['registro não é um objeto'] };
    for (const key of ['id', 'slug', 'name']) if (!str(raw[key])) errors.push(`campo obrigatório ausente: ${key}`);
    if (errors.length) return { game: null, errors };

    const genres = strList(raw.genres);
    const firstGenreInfo = GENRE_INFO[slugify(genres[0] ?? '')];
    const controlsRaw = isObj(raw.controls) ? raw.controls : {};
    const controls = {};
    for (const key of CONTROL_KEYS) controls[key] = oneOf(controlsRaw[key], CONTROL_STATES, 'unverified');

    const playUrl = safeHttpUrl(raw.playUrl);
    if (raw.playUrl && !playUrl) errors.push('playUrl inválida (somente http/https)');

    const devices = isObj(raw.devices) ? raw.devices : {};
    const save = isObj(raw.save) ? raw.save : {};
    const players = isObj(raw.players) ? raw.players : {};
    const editorial = isObj(raw.editorial) ? raw.editorial : {};
    const license = isObj(raw.license) ? raw.license : {};
    const linkCheck = isObj(raw.linkCheck) ? raw.linkCheck : {};
    const description = str(raw.description);

    const game = {
        id: str(raw.id),
        slug: str(raw.slug),
        name: str(raw.name),
        shortDescription: str(raw.shortDescription) || (description.length > 140 ? `${description.slice(0, 137)}…` : description),
        description: description || str(raw.shortDescription),
        cover: normalizeCover(raw.cover, str(raw.slug), firstGenreInfo?.motif),
        coverCredit: str(raw.coverCredit),
        images: strList(raw.images).map(safeLocalOrHttp).filter(Boolean),
        genres,
        genreSlugs: genres.map(slugify),
        platform: str(raw.platform) || 'Não informado',
        releaseYear: Number.isInteger(raw.releaseYear) ? raw.releaseYear : null,
        dateAdded: dateOrNull(raw.dateAdded),
        dateUpdated: dateOrNull(raw.dateUpdated),
        projectType: oneOf(raw.projectType, Object.keys(PROJECT_TYPES), 'web-native'),
        developer: str(raw.developer) || 'Não informado',
        officialUrl: safeHttpUrl(raw.officialUrl),
        playUrl,
        controls,
        controlsSource: str(raw.controlsSource),
        devices: {
            desktop: oneOf(devices.desktop, Object.keys(DEVICE_LABELS), 'unverified'),
            mobile: oneOf(devices.mobile, Object.keys(DEVICE_LABELS), 'unverified'),
            note: str(devices.note),
        },
        tags: strList(raw.tags),
        languages: strList(raw.languages),
        languagesNote: str(raw.languagesNote),
        save: { status: oneOf(save.status, Object.keys(SAVE_LABELS), 'unverified'), note: str(save.note) },
        players: {
            single: oneOf(players.single, Object.keys(PLAYER_LABELS), 'unverified'),
            multi: oneOf(players.multi, Object.keys(PLAYER_LABELS), 'unverified'),
            note: str(players.note),
        },
        knownIssues: strList(raw.knownIssues),
        developmentStatus: oneOf(raw.developmentStatus, Object.keys(DEV_STATUS), 'unverified'),
        developmentNote: str(raw.developmentNote),
        license: { name: str(license.name), url: safeHttpUrl(license.url) },
        sources: (Array.isArray(raw.sources) ? raw.sources : [])
            .map((s) => ({ label: str(s?.label), url: safeHttpUrl(s?.url) }))
            .filter((s) => s.label && s.url),
        editorial: {
            featured: editorial.featured === true,
            featuredOrder: Number.isFinite(editorial.featuredOrder) ? editorial.featuredOrder : null,
            pitch: str(editorial.pitch),
        },
        notices: strList(raw.notices),
        linkCheck: {
            status: oneOf(linkCheck.status, Object.keys(LINK_STATUS_LABELS), 'unverified'),
            method: str(linkCheck.method),
            date: dateOrNull(linkCheck.date),
        },
        verifiedAt: dateOrNull(raw.verifiedAt),
    };
    if (!game.dateAdded) errors.push('dateAdded ausente ou inválida (aviso)');
    return { game, errors };
}

/* ---------- Estado e carregamento ---------- */

const state = { games: [], byId: new Map(), warnings: [], meta: null, promise: null };
const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');

export function loadCatalog({ force = false } = {}) {
    if (state.promise && !force) return state.promise;
    state.promise = (async () => {
        const data = await loadJson(config.dataPaths.games);
        if (!isObj(data) || !Array.isArray(data.games)) throw new CatalogError('schema', 'campo "games" ausente');
        const games = [];
        const ids = new Set();
        const warnings = [];
        data.games.forEach((raw, index) => {
            const { game, errors } = normalizeGame(raw);
            if (errors.length) warnings.push({ index, id: raw?.id ?? null, errors });
            if (!game) return;
            if (ids.has(game.id)) {
                warnings.push({ index, id: game.id, errors: ['id duplicado — registro ignorado'] });
                return;
            }
            ids.add(game.id);
            games.push(game);
        });
        state.games = games;
        state.byId = new Map(games.map((g) => [g.id, g]));
        state.warnings = warnings;
        state.meta = { schemaVersion: data.schemaVersion ?? null, generatedAt: data.generatedAt ?? null, seed: data.seed === true, note: str(data.note) };
        if (warnings.length) console.warn('[Projeto Fênix] Avisos de validação do catálogo:', warnings);
        return state.games;
    })();
    state.promise.catch(() => {
        state.promise = null; // permite nova tentativa
    });
    return state.promise;
}

/* ---------- Seletores ---------- */

export const getAll = () => state.games;
export const getMeta = () => state.meta;
export const getWarnings = () => state.warnings;
export const getById = (id) => state.byId.get(id) ?? null;
export const getBySlug = (slug) => state.games.find((g) => g.slug === slug) ?? null;
export const isAccepted = (state_) => state_ === 'required' || state_ === 'supported';

export function getFeatured(limit = Infinity) {
    return state.games
        .filter((g) => g.editorial.featured)
        .sort((a, b) => (a.editorial.featuredOrder ?? 999) - (b.editorial.featuredOrder ?? 999) || byName(a, b))
        .slice(0, limit);
}

/** Mais recentes por data de inclusão (`added`) ou de atualização (`updated`). */
export function getRecent(limit = Infinity, by = 'added') {
    const field = by === 'updated' ? 'dateUpdated' : 'dateAdded';
    return [...state.games]
        .sort((a, b) => (parseDate(b[field]) ?? 0) - (parseDate(a[field]) ?? 0) || byName(a, b))
        .slice(0, limit);
}

/**
 * Popularidade LOCAL (acessos neste dispositivo). Sem dados, retorna a seleção editorial
 * e `basis: 'editorial'` — nunca números inventados.
 */
export function getPopular(limit = Infinity) {
    const counted = state.games
        .map((game) => ({ game, count: metrics.getCount(game.id) }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count || byName(a.game, b.game));
    if (!counted.length) {
        return { items: getFeatured(limit), basis: 'editorial', rankedCount: 0 };
    }
    const rankedIds = new Set(counted.map((e) => e.game.id));
    const rest = getFeatured().concat([...state.games].sort(byName)).filter((g, i, arr) => !rankedIds.has(g.id) && arr.indexOf(g) === i);
    const items = counted.map((e) => e.game).concat(rest).slice(0, limit);
    return { items, basis: 'local', rankedCount: Math.min(counted.length, limit) };
}

function countBy(selectValues) {
    const map = new Map();
    for (const game of state.games) {
        for (const value of selectValues(game)) map.set(value, (map.get(value) ?? 0) + 1);
    }
    return map;
}

/** Gêneros presentes nos dados, com contagem real. */
export function getGenres() {
    const names = new Map(); // slug -> nome de exibição
    state.games.forEach((g) => g.genres.forEach((name) => names.set(slugify(name), name)));
    const counts = countBy((g) => g.genreSlugs);
    return [...names.entries()]
        .map(([slug, name]) => ({
            slug,
            name,
            count: counts.get(slug) ?? 0,
            description: GENRE_INFO[slug]?.description ?? `Jogos classificados como ${name}.`,
            motif: GENRE_INFO[slug]?.motif ?? 'circuit',
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}

export function getPlatforms() {
    const counts = countBy((g) => [g.platform]);
    return [...counts.entries()]
        .map(([name, count]) => ({ name, slug: slugify(name), count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}

export function getProjectTypes() {
    const counts = countBy((g) => [g.projectType]);
    return [...counts.entries()]
        .map(([key, count]) => ({ key, name: PROJECT_TYPES[key], count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}

export function getByGenre(slug) {
    return state.games.filter((g) => g.genreSlugs.includes(slug));
}

/** Jogos que aceitam (obrigatório ou compatível) um controle. Nunca presume compatibilidade. */
export function getWithControl(key, { levels = ['required', 'supported'] } = {}) {
    return state.games.filter((g) => levels.includes(g.controls[key]));
}

/** Compatíveis com dispositivos móveis: toque aceito OU celular marcado como "sim" na ficha. */
export function getForMobile() {
    return state.games.filter((g) => isAccepted(g.controls.touch) || g.devices.mobile === 'yes');
}

export function getRandom(excludeId) {
    const pool = state.games.filter((g) => g.id !== excludeId);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

export function getStats() {
    return {
        total: state.games.length,
        genres: getGenres().length,
        platforms: getPlatforms().length,
    };
}

export { normalizeText };
