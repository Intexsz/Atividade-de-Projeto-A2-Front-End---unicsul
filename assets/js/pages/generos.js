/**
 * Gêneros (generos.html) — Etapa 5.
 *
 * Cards visuais para os gêneros que REALMENTE existem em data/games.json (nome, descrição, quantidade real,
 * arte gerada e cor própria). Escolher um card abre, logo abaixo, o painel com os jogos do gênero — sem página
 * nova — e filtros secundários por plataforma e controles aceitos, além de busca, ordenação e paginação.
 *
 * Tudo é derivado do catálogo: gêneros e quantidades se atualizam sozinhos quando os dados mudam.
 * Estado ⇄ URL: `?genero=` (gênero aberto), `plataforma`, `controle`, `modo`, `nivel`, `q`, `ordem`, `pagina`.
 * Abrir/trocar de gênero e trocar de página criam entrada no histórico (o "voltar" fecha o painel ou volta a página);
 * filtros apenas atualizam a URL.
 */
import { config } from '../config.js';
import { $, el, clear, icon, clamp, pluralize, normalizeText, prefersReducedMotion } from '../modules/utils.js';
import { loadCatalog, getAll, getGenres } from '../modules/catalog.js';
import { coverSrc, coverSize, coverAccent } from '../modules/cover.js';
import {
    CATALOG_SORTS, RANKING_MODES, createEmptyFilters, applyFilters, sortGames, filtersToQuery,
} from '../modules/filters.js';
import { createFilterKit, readFilterUrl, writeFilterUrl } from '../modules/filterbar.js';
import { mountPagination } from '../modules/pagination.js';
import { renderEmpty, renderError, renderGameGrid, skeletonCards } from '../modules/components.js';

const slot = (name) => $(`[data-slot="${name}"]`);
const PAGE_SIZE = config.catalog.pageSize;
const DEFAULT_SORT = 'recent';
const URL_OPTIONS = { sortOptions: CATALOG_SORTS, defaultSort: DEFAULT_SORT };
const GENRE_ORDER = Object.freeze({ count: 'Mais jogos', az: 'Nome (A–Z)' });

const state = { selected: '', filters: createEmptyFilters(), sort: DEFAULT_SORT, sortChosen: false, page: 1, find: '', order: 'count' };
const ui = {};
let kit = null;
let scoped = ''; // gênero cujo universo está aplicado aos chips de plataforma
let genres = [];
let bySlug = new Map(); // slug do gênero -> jogos (ordem editorial)
let memo = { key: '', value: null };

const collator = new Intl.Collator('pt-BR');
const fmt = (n) => n.toLocaleString('pt-BR');
const countGames = (n) => `${fmt(n)} ${pluralize(n, 'jogo', 'jogos')}`;
const genreOf = (slug) => genres.find((g) => g.slug === slug) ?? null;
const blank = () => ({ ...createEmptyFilters(), genres: state.selected ? [state.selected] : [] });

/** Cada gênero tem arte própria (SVG em assets/images/genres, a mesma da página inicial); a cor de destaque segue a semente. */
const coverItem = (genre) => ({ slug: `genero-${genre.slug}`, cover: { type: 'image', src: `assets/images/genres/${genre.slug}.svg`, motif: genre.motif, seed: `genero-${genre.slug}` } });

/* ---------- Estado <-> URL ---------- */

function syncAutoSort() {
    if (!state.sortChosen) state.sort = state.filters.query ? 'relevance' : DEFAULT_SORT;
}

function readUrl() {
    const params = readFilterUrl(state, URL_OPTIONS);
    state.sortChosen = params.has('ordem') && params.get('ordem') === state.sort;
    const known = new Set(genres.map((g) => g.slug));
    const wanted = (params.get('genero') ?? '').split(',').map((s) => s.trim()).find((s) => known.has(s)) ?? '';
    state.selected = wanted;
    state.filters.genres = wanted ? [wanted] : [];
    const page = Number.parseInt(params.get('pagina') ?? '', 10);
    state.page = wanted && Number.isFinite(page) && page >= 1 ? page : 1;
    syncAutoSort();
}

function writeUrl(push) {
    const forUrl = { filters: state.filters, sort: state.sortChosen ? state.sort : DEFAULT_SORT };
    writeFilterUrl(forUrl, { defaultSort: DEFAULT_SORT, push }, { pagina: state.selected && state.page > 1 ? String(state.page) : '' });
}

/* ---------- Dados derivados ---------- */

/** Jogos por gênero em ordem editorial (destaque → nome), construído uma vez a partir do catálogo. */
function buildIndex() {
    const sorted = [...getAll()].sort((a, b) => (a.editorial.featuredOrder ?? 999) - (b.editorial.featuredOrder ?? 999) || collator.compare(a.name, b.name));
    const map = new Map();
    for (const game of sorted) for (const slug of game.genreSlugs) {
        if (!map.has(slug)) map.set(slug, []);
        map.get(slug).push(game);
    }
    return map;
}

function compute() {
    const key = JSON.stringify([state.selected, state.filters, state.sort]);
    if (memo.key === key) return memo.value;
    const universe = bySlug.get(state.selected) ?? [];
    const found = sortGames(applyFilters(universe, { ...state.filters, genres: [] }), state.sort, { query: state.filters.query });
    memo = { key, value: { universe, found } };
    return memo.value;
}

/* ---------- Cards de gênero ---------- */

function genreCard(genre) {
    const item = coverItem(genre);
    const [w, h] = coverSize('wide');
    const games = bySlug.get(genre.slug) ?? [];
    const names = games.slice(0, 3).map((g) => g.name);
    const rest = games.length - names.length;
    const nameId = `gc-${genre.slug}-name`;
    const infoId = `gc-${genre.slug}-info`;
    const button = el('button', {
        class: 'genre-tile', type: 'button', 'aria-pressed': 'false', 'aria-controls': 'genre-panel',
        'aria-labelledby': nameId, 'aria-describedby': infoId,
        style: { '--g-accent': coverAccent(item) }, dataset: { genre: genre.slug },
    },
        el('img', { class: 'genre-tile__img', src: coverSrc(item, 'wide'), alt: '', width: w, height: h, loading: 'lazy', decoding: 'async' }),
        el('span', { class: 'genre-tile__top' },
            el('span', { class: 'genre-tile__count' }, countGames(genre.count)),
            el('span', { class: 'genre-tile__mark', 'aria-hidden': 'true' }, icon('check', { size: 16 }))),
        el('span', { class: 'genre-tile__body', id: infoId },
            el('span', { class: 'genre-tile__name', id: nameId }, genre.name),
            el('span', { class: 'genre-tile__desc' }, genre.description),
            names.length > 0 && el('span', { class: 'genre-tile__sample' }, `Ex.: ${names.join(', ')}${rest > 0 ? ` e mais ${rest}` : ''}`),
            el('span', { class: 'genre-tile__cta' }, el('span', { class: 'genre-tile__cta-text' }, 'Explorar jogos'), icon('arrow-right', { size: 16 }))));
    return el('li', { class: 'genre-grid__item' }, button);
}

function visibleGenres() {
    const query = normalizeText(state.find);
    const list = genres.filter((g) => !query || normalizeText(`${g.name} ${g.description}`).includes(query));
    if (state.order === 'az') list.sort((a, b) => collator.compare(a.name, b.name));
    return list; // `genres` já vem por quantidade (mais jogos primeiro)
}

function renderCards() {
    const list = visibleGenres();
    const host = slot('genres');
    ui.findCount.textContent = state.find.trim() ? `${list.length} de ${genres.length} ${pluralize(genres.length, 'gênero', 'gêneros')}` : `${genres.length} ${pluralize(genres.length, 'gênero', 'gêneros')}`;
    if (!list.length) {
        renderEmpty(host, {
            title: 'Nenhum gênero encontrado',
            text: `Não há gênero com “${state.find.trim()}”. Tente outro termo.`,
            actions: [el('button', { class: 'btn btn--secondary', type: 'button', onclick: () => { ui.findInput.value = ''; state.find = ''; renderCards(); ui.findInput.focus(); } }, 'Limpar busca')],
        });
        return;
    }
    clear(host).appendChild(el('ul', { class: 'genre-grid' }, list.map(genreCard)));
    syncCards();
}

function syncCards() {
    slot('genres').querySelectorAll('.genre-tile').forEach((button) => {
        const on = button.dataset.genre === state.selected;
        button.setAttribute('aria-pressed', String(on));
        button.querySelector('.genre-tile__cta-text').textContent = on ? 'Gênero aberto' : 'Explorar jogos';
    });
}

function mountTools() {
    ui.findInput = el('input', { class: 'search-input__field', id: 'genre-q', type: 'search', placeholder: 'Nome ou assunto do gênero…', autocomplete: 'off', spellcheck: 'false', maxlength: '60' });
    const clearBtn = el('button', { class: 'search-input__clear', type: 'button', 'aria-label': 'Limpar busca de gênero', hidden: true }, icon('close', { size: 16 }));
    const order = el('select', { class: 'select', id: 'genre-order' }, Object.entries(GENRE_ORDER).map(([key, text]) => el('option', { value: key }, text)));
    ui.findCount = el('p', { class: 'result-count', role: 'status', 'aria-live': 'polite' });

    ui.findInput.addEventListener('input', () => {
        state.find = ui.findInput.value;
        clearBtn.hidden = !ui.findInput.value;
        renderCards();
    });
    clearBtn.addEventListener('click', () => {
        ui.findInput.value = '';
        state.find = '';
        clearBtn.hidden = true;
        renderCards();
        ui.findInput.focus();
    });
    order.addEventListener('change', () => {
        state.order = Object.hasOwn(GENRE_ORDER, order.value) ? order.value : 'count';
        renderCards();
    });

    slot('tools').append(
        el('div', { class: 'field field--search' },
            el('label', { class: 'field__label', for: 'genre-q' }, 'Buscar gênero'),
            el('div', { class: 'search-input' }, icon('search', { size: 18 }), ui.findInput, clearBtn)),
        el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'genre-order' }, 'Ordenar gêneros'), order),
        ui.findCount);
}

/* ---------- Painel do gênero ---------- */

function mountPanel() {
    ui.pagination = el('div', { class: 'genre-panel__pagination' });
    ui.paginate = mountPagination(ui.pagination);
    ui.title = el('h2', { class: 'genre-panel__title', id: 'genre-panel-title', tabindex: '-1' });
    ui.desc = el('p', { class: 'genre-panel__desc' });
    ui.meta = el('p', { class: 'genre-panel__meta' });
    ui.catalogLink = el('a', { class: 'btn btn--ghost btn--sm', href: 'todos-os-jogos.html' }, 'Abrir no catálogo completo', icon('arrow-right', { size: 16 }));
    ui.closeBtn = el('button', { class: 'btn btn--secondary btn--sm', type: 'button' }, icon('close', { size: 16 }), 'Fechar gênero');
    ui.closeBtn.addEventListener('click', closeGenre);

    kit = createFilterKit(state, { id: 'gen', sortOptions: CATALOG_SORTS, defaultSort: DEFAULT_SORT, onChange: () => change(() => { }), blank });
    const foot = kit.foot();
    ui.foot = foot;
    const filterbar = el('form', { class: 'filterbar genre-panel__filters', role: 'search', 'aria-label': 'Filtros do gênero', novalidate: true },
        el('div', { class: 'filterbar__row' }, kit.search({ label: 'Pesquisar neste gênero', placeholder: 'Nome, tag, plataforma…' }), kit.sort()),
        kit.groups({ layout: 'bar', genres: false }),
        foot.node);
    filterbar.addEventListener('submit', (event) => event.preventDefault());

    ui.localNote = el('p', { class: 'local-note', hidden: true }, icon('info', { size: 14 }), 'Popularidade e acessos são contados somente neste dispositivo; não são estatísticas globais.');
    ui.resultsTitle = el('h3', { class: 'genre-panel__results-title', id: 'genre-results-title', tabindex: '-1' }, 'Jogos');
    ui.results = el('div', { 'aria-labelledby': 'genre-results-title' });

    slot('panel').append(el('div', { class: 'container-wide genre-panel__inner' },
        el('header', { class: 'genre-panel__head' },
            el('div', { class: 'genre-panel__text' }, el('p', { class: 'eyebrow' }, 'Gênero'), ui.title, ui.desc, ui.meta),
            el('div', { class: 'genre-panel__actions' }, ui.catalogLink, ui.closeBtn)),
        filterbar,
        el('div', { class: 'genre-panel__results' }, ui.resultsTitle, ui.localNote, ui.results, ui.pagination)));
}

function renderPanel() {
    const genre = genreOf(state.selected);
    const { universe, found } = compute();
    const pages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
    state.page = clamp(state.page, 1, pages);
    const from = (state.page - 1) * PAGE_SIZE;
    const shown = found.slice(from, from + PAGE_SIZE);
    const panel = slot('panel');

    panel.style.setProperty('--g-accent', coverAccent(coverItem(genre)));
    ui.title.textContent = genre.name;
    ui.desc.textContent = genre.description;
    ui.meta.textContent = `${countGames(universe.length)} no catálogo`;
    ui.resultsTitle.textContent = `Jogos de ${genre.name}`;
    const query = filtersToQuery({ ...state.filters, genres: [state.selected] });
    if (state.sortChosen) query.set('ordem', state.sort);
    ui.catalogLink.href = `todos-os-jogos.html?${query.toString()}`;

    if (scoped !== state.selected) { // chips de plataforma só com o que existe neste gênero
        kit.setScope(universe);
        scoped = state.selected;
    }
    kit.sync();
    ui.foot.setCount(found.length
        ? `Mostrando ${fmt(from + 1)}–${fmt(from + shown.length)} de ${countGames(found.length)}${found.length !== universe.length ? ` (de ${fmt(universe.length)} no gênero)` : ''}`
        : 'Nenhum jogo encontrado');
    ui.localNote.hidden = !RANKING_MODES.includes(state.sort);

    if (found.length) renderGameGrid(ui.results, shown, { query: state.filters.query });
    else {
        renderEmpty(ui.results, {
            title: `Nenhum jogo de ${genre.name} corresponde à sua seleção`,
            text: state.filters.query
                ? `Não encontramos “${state.filters.query}” com os filtros atuais. Tente outro termo ou remova algum filtro.`
                : 'Nenhum jogo deste gênero reúne todas essas características. Lembre: só aparecem controles confirmados na ficha do jogo.',
            actions: [el('button', { class: 'btn btn--secondary', type: 'button', onclick: () => change(() => { state.filters = blank(); }) }, 'Limpar filtros')],
        });
    }
    ui.paginate({ page: state.page, pages, onPage: (page) => { state.page = page; update({ push: true, scrollTo: 'results' }); } });
}

/* ---------- Ações ---------- */

function update({ push = false, scrollTo = '' } = {}) {
    syncAutoSort();
    const panel = slot('panel');
    panel.hidden = !state.selected;
    syncCards();
    if (state.selected) renderPanel();
    writeUrl(push);

    const smooth = prefersReducedMotion() ? 'auto' : 'smooth';
    if (scrollTo === 'panel') {
        ui.title.focus({ preventScroll: true });
        panel.scrollIntoView({ behavior: smooth, block: 'start' });
    } else if (scrollTo === 'results') {
        ui.resultsTitle.focus({ preventScroll: true });
        ui.resultsTitle.scrollIntoView({ behavior: smooth, block: 'start' });
    }
}

/** Mudança de filtro/ordem dentro do painel: volta à página 1. */
function change(mutator) {
    mutator();
    state.page = 1;
    update();
}

/** Clique no card: abre o gênero; clicar de novo no aberto fecha. Cada gênero começa sem filtros secundários. */
function toggleGenre(slug) {
    if (slug === state.selected) {
        closeGenre();
        return;
    }
    state.selected = slug;
    state.filters = blank();
    state.page = 1;
    update({ push: true, scrollTo: 'panel' });
}

function closeGenre() {
    const slug = state.selected;
    state.selected = '';
    state.filters = blank();
    state.page = 1;
    update({ push: true });
    slot('genres').querySelector(`[data-genre="${CSS.escape(slug)}"]`)?.focus();
}

/* ---------- Montagem ---------- */

function renderStats() {
    const stat = (value, text) => el('li', { class: 'stat-pills__item' }, el('strong', null, fmt(value)), ` ${text}`);
    const total = getAll().length;
    clear(slot('stats')).append(
        stat(genres.length, pluralize(genres.length, 'gênero', 'gêneros')),
        stat(total, pluralize(total, 'jogo cadastrado', 'jogos cadastrados')));
}

function init() {
    genres = getGenres();
    bySlug = buildIndex();
    const host = slot('genres');
    if (!genres.length) {
        renderEmpty(host, { title: 'Nenhum gênero cadastrado', text: 'Os gêneros aparecem automaticamente conforme os jogos são cadastrados.' });
        return;
    }
    renderStats();
    mountTools();
    mountPanel();
    renderCards();
    host.addEventListener('click', (event) => {
        const button = event.target.closest('.genre-tile');
        if (button) toggleGenre(button.dataset.genre);
    });
    readUrl();
    update({ scrollTo: '' });
    if (state.selected) requestAnimationFrame(() => slot('panel').scrollIntoView({ behavior: 'auto', block: 'start' }));

    window.addEventListener('popstate', () => {
        readUrl();
        update();
    });
    for (const name of ['projeto-fenix:metrics-changed', 'projeto-fenix:favorites-changed', 'storage']) window.addEventListener(name, () => { memo = { key: '', value: null }; });
}

async function start() {
    const host = slot('genres');
    clear(host).appendChild(el('div', { class: 'genre-grid', 'aria-hidden': 'true' }, skeletonCards(3, 'wide')));
    try {
        await loadCatalog();
    } catch (error) {
        renderError(host, error, start);
        return;
    }
    init();
}

start();
