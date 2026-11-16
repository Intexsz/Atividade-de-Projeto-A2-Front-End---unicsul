/**
 * Todos os jogos (todos-os-jogos.html) — Etapa 4.
 *
 * O catálogo completo: busca com sugestões, filtros combináveis (gênero, plataforma, tipo de projeto,
 * controles, jogadores, características e status), ordenação, navegação A–Z, tags removíveis e paginação.
 *
 * Desempenho: filtrar/ordenar trabalha sobre a lista inteira (O(n), com pontuações pré-calculadas), mas só a
 * página atual (`config.catalog.pageSize` cards) vira DOM, com imagens em lazy loading. O resultado do último
 * cálculo fica em memória e é reaproveitado ao trocar de página.
 *
 * Estado ⇄ URL: filtros (mesmos parâmetros do restante do site), `ordem` e `pagina`. Mudar de página cria uma
 * entrada no histórico (o "voltar" funciona); mudar filtros só atualiza a URL.
 *
 * Popularidade/acessos: contagens LOCAIS (neste dispositivo) — a página avisa quando a ordenação é por elas.
 */
import { config } from '../config.js';
import { $, el, clear, icon, clamp, pluralize, prefersReducedMotion, trapFocus } from '../modules/utils.js';
import { loadCatalog, getAll, getGenres, getPlatforms } from '../modules/catalog.js';
import {
    CATALOG_SORTS, RANKING_MODES, createEmptyFilters, applyFilters, sortGames, firstLetter, describeActiveFilters, removeFilter,
} from '../modules/filters.js';
import { createFilterKit, readFilterUrl, writeFilterUrl } from '../modules/filterbar.js';
import { mountPagination } from '../modules/pagination.js';
import { openGame, renderEmpty, renderError, renderGameGrid, skeletonCards } from '../modules/components.js';

const slot = (name) => $(`[data-slot="${name}"]`);
const PAGE_SIZE = config.catalog.pageSize;
const DEFAULT_SORT = 'recent';
const SORT_OPTIONS = CATALOG_SORTS;
const URL_OPTIONS = { sortOptions: SORT_OPTIONS, defaultSort: DEFAULT_SORT, extended: true };
const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const DESKTOP = matchMedia('(min-width: 1024px)');

const state = { filters: createEmptyFilters(), sort: DEFAULT_SORT, sortChosen: false, page: 1 };
const ui = {};
let kit = null;
let memo = { key: '', value: null };

const fmt = (n) => n.toLocaleString('pt-BR');
const countGames = (n) => `${fmt(n)} ${pluralize(n, 'jogo', 'jogos')}`;

/* ---------- Estado <-> URL ---------- */

/** Sem escolha explícita do usuário: a busca ordena por relevância; sem busca, volta ao padrão. */
function syncAutoSort() {
    if (!state.sortChosen) state.sort = state.filters.query ? 'relevance' : DEFAULT_SORT;
}

function readUrl() {
    const params = readFilterUrl(state, URL_OPTIONS);
    state.sortChosen = params.has('ordem') && params.get('ordem') === state.sort; // `ordem` inválida já voltou ao padrão
    const page = Number.parseInt(params.get('pagina') ?? '', 10);
    state.page = Number.isFinite(page) && page >= 1 ? page : 1;
    syncAutoSort();
}

function writeUrl(push) {
    const forUrl = { filters: state.filters, sort: state.sortChosen ? state.sort : DEFAULT_SORT };
    writeFilterUrl(forUrl, { defaultSort: DEFAULT_SORT, push }, { pagina: state.page > 1 ? String(state.page) : '' });
}

/* ---------- Filtragem e ordenação (resultado em memória) ---------- */

const letterCache = new Map();
function letterOf(game) {
    let letter = letterCache.get(game.id);
    if (letter === undefined) {
        letter = firstLetter(game.name);
        letterCache.set(game.id, letter);
    }
    return letter;
}

/** { found, available }: jogos filtrados/ordenados e letras que ainda têm jogos com os OUTROS filtros. */
function compute() {
    const key = JSON.stringify([state.filters, state.sort]);
    if (memo.key === key) return memo.value;
    const base = applyFilters(getAll(), { ...state.filters, letter: '' });
    const available = new Set(base.map(letterOf));
    const filtered = state.filters.letter ? base.filter((g) => letterOf(g) === state.filters.letter) : base;
    const found = sortGames(filtered, state.sort, { query: state.filters.query });
    memo = { key, value: { found, available } };
    return memo.value;
}

/* ---------- Atualização da tela ---------- */

function update({ push = false, scroll = false } = {}) {
    syncAutoSort();
    const { found, available } = compute();
    const total = getAll().length;
    const pages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
    state.page = clamp(state.page, 1, pages);
    const from = (state.page - 1) * PAGE_SIZE;
    const shown = found.slice(from, from + PAGE_SIZE);

    kit.sync();
    renderSummary(found.length, total, from, shown.length);
    renderTags();
    syncAz(available);
    renderResults(shown, found.length, total);
    ui.paginate({ page: state.page, pages, onPage: (page) => { state.page = page; update({ push: true, scroll: true }); } });
    syncFilterControls(found.length);
    slot('local-note').hidden = !RANKING_MODES.includes(state.sort);
    writeUrl(push);

    if (scroll) {
        ui.heading.focus({ preventScroll: true });
        ui.heading.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
}

function renderSummary(count, total, from, shownCount) {
    const filtered = describeActiveFilters(state.filters).length > 0;
    let text;
    if (!total) text = 'O catálogo ainda está vazio.';
    else if (!count) text = 'Nenhum jogo encontrado.';
    else text = `Mostrando ${fmt(from + 1)}–${fmt(from + shownCount)} de ${countGames(count)}${filtered ? ` (catálogo: ${fmt(total)})` : ''}`;
    slot('summary').textContent = text;
}

function renderResults(shown, count, total) {
    const host = slot('results');
    host.setAttribute('aria-busy', 'false');
    if (count) {
        renderGameGrid(host, shown, { query: state.filters.query });
        return;
    }
    if (!total) {
        renderEmpty(host, { iconName: 'grid', title: 'O catálogo ainda está vazio', text: 'Ainda não há jogos cadastrados. Volte em breve.' });
        return;
    }
    const { query, letter } = state.filters;
    const actions = [el('button', { class: 'btn btn--secondary', type: 'button', onclick: clearAll }, 'Limpar filtros')];
    if (letter) actions.push(el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => change(() => { state.filters.letter = ''; }) }, 'Ver todas as letras'));
    renderEmpty(host, {
        title: 'Nenhum jogo corresponde à sua seleção',
        text: query
            ? `Não encontramos “${query}” com os filtros atuais. Tente outro nome, gênero ou controle, ou remova algum filtro.`
            : 'Nenhum jogo reúne todas essas características ao mesmo tempo. Remova algum filtro para ampliar a busca.',
        actions,
    });
}

/* ---------- Tags dos filtros ativos ---------- */

function renderTags() {
    const genreNames = new Map(getGenres().map((g) => [g.slug, g.name]));
    const items = describeActiveFilters(state.filters, { genre: (slug) => genreNames.get(slug) ?? slug });
    const host = clear(slot('tags'));
    host.hidden = items.length === 0;
    items.forEach((item) => host.appendChild(el('li', null,
        el('button', {
            class: 'tag tag--removable', type: 'button', 'aria-label': `Remover filtro: ${item.label}`,
            dataset: { key: item.key, value: item.value ?? '' },
        }, item.label, icon('close', { size: 12 })))));
    if (items.length) host.appendChild(el('li', null, el('button', { class: 'link-btn', type: 'button', dataset: { tags: 'clear' } }, 'Limpar filtros')));
}

function onTagClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const buttons = [...slot('tags').querySelectorAll('button')];
    const index = buttons.indexOf(button);
    change(() => {
        if (button.dataset.tags === 'clear') state.filters = createEmptyFilters();
        else removeFilter(state.filters, { key: button.dataset.key, value: button.dataset.value });
    });
    // O botão clicado saiu da tela: o foco vai para a tag seguinte (ou para o campo de busca).
    const remaining = [...slot('tags').querySelectorAll('button')];
    (remaining[Math.min(index, remaining.length - 1)] ?? $('#cat-q'))?.focus();
}

/* ---------- Navegação A–Z (montada uma vez; só os atributos mudam) ---------- */

function mountAz() {
    const button = (letter, label, text) => el('button', {
        class: `az-nav__btn${letter === '' ? ' az-nav__btn--all' : ''}`, type: 'button', 'aria-pressed': 'false', 'aria-label': label, dataset: { letter },
    }, text);
    const list = el('div', { class: 'az-nav__list', role: 'group', 'aria-label': 'Filtrar pela letra inicial do nome' },
        button('', 'Todas as letras', 'Todos'),
        ALPHABET.map((l) => button(l, l === '#' ? 'Nomes que começam com número ou símbolo' : `Letra ${l}`, l)));
    list.addEventListener('click', (event) => {
        const target = event.target.closest('button[data-letter]');
        if (!target || target.disabled) return;
        const { letter } = target.dataset;
        change(() => { state.filters.letter = state.filters.letter === letter ? '' : letter; });
    });
    slot('az').appendChild(list);
}

function syncAz(available) {
    slot('az').querySelectorAll('button[data-letter]').forEach((b) => {
        const { letter } = b.dataset;
        const selected = state.filters.letter === letter;
        b.setAttribute('aria-pressed', String(letter === '' ? !state.filters.letter : selected));
        b.disabled = letter !== '' && !selected && !available.has(letter);
    });
}

/* ---------- Painel de filtros: sidebar (desktop) · gaveta (celular) ---------- */

function mountPanel() {
    const panel = slot('panel');
    const backdrop = slot('backdrop');
    let open = false;

    ui.closeBtn = el('button', { class: 'icon-btn filters-panel__close', type: 'button', 'aria-label': 'Fechar filtros' }, icon('close', { size: 20 }));
    ui.applyBtn = el('button', { class: 'btn btn--primary filters-panel__apply', type: 'button' }, 'Ver jogos');
    ui.foot = kit.foot({ live: false });

    panel.append(
        el('div', { class: 'filters-panel__head' },
            el('h2', { class: 'filters-panel__title', id: 'filters-title' }, icon('sliders', { size: 18 }), 'Filtros'),
            ui.closeBtn),
        el('div', { class: 'filters-panel__body' }, kit.groups({ layout: 'accordion', extended: true })),
        el('div', { class: 'filters-panel__foot' }, ui.foot.node, ui.applyBtn));

    /** Enquanto a gaveta está aberta, o resto da página fica inerte (foco preso + leitores de tela só veem a gaveta). */
    const setInertOutside = (on) => {
        for (let node = panel; node && node !== document.body; node = node.parentElement) {
            for (const sibling of node.parentElement.children) {
                if (sibling === node || sibling === backdrop || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
                sibling.toggleAttribute('inert', on);
            }
        }
    };

    const setOpen = (next, { restoreFocus = true } = {}) => {
        open = next;
        panel.classList.toggle('is-open', next);
        backdrop.hidden = !next;
        ui.filterBtn.setAttribute('aria-expanded', String(next));
        document.documentElement.classList.toggle('is-scroll-locked', next);
        panel.setAttribute('aria-modal', String(next));
        setInertOutside(next);
        if (next) ui.closeBtn.focus();
        else if (restoreFocus) ui.filterBtn.focus();
    };

    /** No desktop o painel é um <aside> fixo na página; no celular vira um diálogo (gaveta). */
    const applyMode = () => {
        if (DESKTOP.matches) {
            if (open) setOpen(false, { restoreFocus: false });
            panel.removeAttribute('role');
            panel.removeAttribute('aria-modal');
        } else {
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', String(open));
        }
    };

    ui.filterBtn.addEventListener('click', () => setOpen(!open));
    ui.closeBtn.addEventListener('click', () => setOpen(false));
    ui.applyBtn.addEventListener('click', () => setOpen(false));
    backdrop.addEventListener('click', () => setOpen(false));
    panel.addEventListener('keydown', (event) => open && trapFocus(panel, event));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && open && !document.querySelector('dialog[open]')) {
            event.preventDefault();
            setOpen(false);
        }
    });
    DESKTOP.addEventListener('change', applyMode);
    applyMode();
}

function syncFilterControls(count) {
    const active = describeActiveFilters(state.filters).filter((i) => i.key !== 'query' && i.key !== 'letter').length;
    ui.filterCount.textContent = String(active);
    ui.filterCount.hidden = active === 0;
    ui.filterBtn.setAttribute('aria-label', active ? `Filtros (${active} ${pluralize(active, 'ativo', 'ativos')})` : 'Filtros');
    ui.foot.setCount(!count ? 'Nenhum jogo encontrado' : count === 1 ? '1 jogo encontrado' : `${fmt(count)} jogos encontrados`);
    ui.applyBtn.textContent = count ? `Ver ${countGames(count)}` : 'Fechar';
}

/* ---------- Ações ---------- */

/** Altera o estado, volta à página 1 e redesenha. */
function change(mutator) {
    mutator();
    state.page = 1;
    update();
}

function clearAll() {
    change(() => { state.filters = createEmptyFilters(); });
}

/* ---------- Montagem ---------- */

function mountToolbar() {
    ui.filterCount = el('span', { class: 'catalog-filter-btn__count', hidden: true });
    ui.filterBtn = el('button', {
        class: 'btn btn--secondary catalog-filter-btn', type: 'button', 'aria-controls': 'filters-panel', 'aria-expanded': 'false', 'aria-haspopup': 'dialog',
    }, icon('sliders', { size: 18 }), 'Filtros', ui.filterCount);

    slot('toolbar').append(
        kit.search({ label: 'Pesquisar jogos', placeholder: 'Nome, gênero, tag, plataforma…', suggestions: true, onPick: (game) => openGame(game.id) }),
        kit.sort(),
        ui.filterBtn);
}

function renderStats() {
    const stat = (value, text) => el('li', { class: 'stat-pills__item' }, el('strong', null, fmt(value)), ` ${text}`);
    const total = getAll().length;
    const genres = getGenres().length;
    const platforms = getPlatforms().length;
    clear(slot('stats')).append(
        stat(total, pluralize(total, 'jogo cadastrado', 'jogos cadastrados')),
        stat(genres, pluralize(genres, 'gênero', 'gêneros')),
        stat(platforms, pluralize(platforms, 'plataforma de origem', 'plataformas de origem')));
}

function init() {
    readUrl();
    kit = createFilterKit(state, { id: 'cat', sortOptions: SORT_OPTIONS, defaultSort: DEFAULT_SORT, onChange: () => change(() => { }) });
    ui.heading = $('#results-title');
    ui.paginate = mountPagination(slot('pagination'));

    renderStats();
    mountToolbar();
    mountPanel();
    mountAz();
    slot('tags').addEventListener('click', onTagClick);
    update();

    window.addEventListener('popstate', () => {
        readUrl();
        update();
    });
    // Acessos/favoritos mudaram (aqui ou em outra aba): o resultado em memória pode estar desatualizado.
    for (const name of ['projeto-fenix:metrics-changed', 'projeto-fenix:favorites-changed', 'storage']) window.addEventListener(name, () => { memo = { key: '', value: null }; });
}

async function start() {
    const host = slot('results');
    host.setAttribute('aria-busy', 'true');
    clear(host).appendChild(el('div', { class: 'grid-cards', 'aria-hidden': 'true' }, skeletonCards(Math.min(PAGE_SIZE, 12))));
    try {
        await loadCatalog();
    } catch (error) {
        host.setAttribute('aria-busy', 'false');
        renderError(host, error, start);
        return;
    }
    init();
}

start();
