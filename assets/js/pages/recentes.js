/**
 * Recentes (recentes.html) — Etapa 3.
 *
 * Linha do tempo das novidades do catálogo, calculada SOMENTE com as datas reais de data/games.json:
 *  - "Adicionados": por data de inclusão (`dateAdded`).
 *  - "Atualizados": só jogos cuja ficha foi atualizada DEPOIS da inclusão (`dateUpdated` > `dateAdded`).
 *  - Períodos (Hoje, últimos 7/30 dias, meses): a separação visual só aparece quando as datas caem em
 *    pelo menos `config.recent.minPeriodsToSplit` períodos; senão a página diz a data real em vez de
 *    fingir uma linha do tempo.
 *  - Busca, filtros (gênero, plataforma, controles) e ordenação por data/nome; estado espelhado na URL
 *    (`?vista=atualizados`, `?ordem=`, filtros do catálogo).
 */
import { config } from '../config.js';
import { $, el, clear, icon, pluralize, daysSince, formatDate } from '../modules/utils.js';
import { loadCatalog, getAll } from '../modules/catalog.js';
import { applyFilters, sortGames, SORT_MODES, createEmptyFilters } from '../modules/filters.js';
import { mountFilterBar, readFilterUrl, writeFilterUrl } from '../modules/filterbar.js';
import { mountTabs } from '../modules/tabs.js';
import { wasUpdated, groupByPeriod, shouldSplit, describeDates, sortByDate } from '../modules/periods.js';
import { renderEmpty, renderError, renderGameGrid, skeletonCards } from '../modules/components.js';

const slot = (name) => $(`[data-slot="${name}"]`);

const VIEWS = Object.freeze({
    added: { field: 'dateAdded', url: 'adicionados', noun: 'adicionados', basis: 'a data de inclusão no Projeto Fênix' },
    updated: { field: 'dateUpdated', url: 'atualizados', noun: 'atualizados', basis: 'a data da última atualização da ficha' },
});
const SORT_OPTIONS = Object.freeze({
    recent: 'Mais recentes primeiro',
    oldest: 'Mais antigos primeiro',
    az: SORT_MODES.az,
    za: SORT_MODES.za,
});
const DATE_SORTS = new Set(['recent', 'oldest']);
const URL_OPTIONS = { sortOptions: SORT_OPTIONS, defaultSort: 'recent' };

const state = { filters: createEmptyFilters(), sort: 'recent', view: 'added' };
let bar = null;
let tabs = null;

/* ---------- Estado <-> URL ---------- */

function readUrl() {
    const params = readFilterUrl(state, URL_OPTIONS);
    state.view = params.get('vista') === VIEWS.updated.url ? 'updated' : 'added';
}
const writeUrl = () => writeFilterUrl(state, URL_OPTIONS, { vista: state.view === 'updated' ? VIEWS.updated.url : '' });

/* ---------- Dados da visão atual ---------- */

const universeOf = (view) => (view === 'updated' ? getAll().filter(wasUpdated) : getAll());

function sortedFor(view, games) {
    if (!DATE_SORTS.has(state.sort)) return sortGames(games, state.sort);
    return sortByDate(games, VIEWS[view].field, state.sort === 'oldest' ? 'asc' : 'desc');
}

/* ---------- Resumo (números reais do catálogo) ---------- */

function renderSummary() {
    const all = getAll();
    const latest = sortByDate(all, 'dateAdded')[0];
    const recentCount = all.filter((g) => daysSince(g.dateAdded) <= config.freshness.newDays).length;
    const updatedCount = all.filter(wasUpdated).length;
    const stat = (value, text) => el('li', { class: 'stat-pills__item' }, el('strong', null, String(value)), ` ${text}`);

    clear(slot('summary')).append(
        el('ul', { class: 'stat-pills recent-summary' },
            stat(all.length, pluralize(all.length, 'jogo no catálogo', 'jogos no catálogo')),
            latest?.dateAdded && el('li', { class: 'stat-pills__item' }, `Último cadastro: ${formatDate(latest.dateAdded)}`),
            stat(recentCount, `${pluralize(recentCount, 'adicionado', 'adicionados')} nos últimos ${config.freshness.newDays} dias`),
            stat(updatedCount, `${pluralize(updatedCount, 'jogo', 'jogos')} com ficha atualizada depois da inclusão`)
        )
    );
}

/* ---------- Linha do tempo ---------- */

function periodBlock(group, view) {
    const box = el('div', { class: 'timeline__games' });
    renderGameGrid(box, group.games, cardOptions(view));
    return el('li', { class: 'timeline__period' },
        el('header', { class: 'timeline__head' },
            el('span', { class: 'timeline__dot', 'aria-hidden': 'true' }),
            el('h3', { class: 'timeline__title' }, group.label),
            el('p', { class: 'timeline__meta' }, `${group.games.length} ${pluralize(group.games.length, 'jogo', 'jogos')} · ${describeDates(group.games, VIEWS[view].field)}`)
        ),
        box
    );
}

const cardOptions = (view) => ({ badge: true, showDate: true, dateField: VIEWS[view].field, preferUpdate: view === 'updated' });

function renderEmptyView(container, view, universe) {
    if (!universe.length) {
        renderEmpty(container, {
            iconName: 'bolt',
            title: 'Nenhuma ficha foi atualizada depois da inclusão',
            text: 'Hoje todos os jogos têm a ficha do mesmo dia em que foram adicionados. Quando uma ficha for revisada (data de atualização posterior à de inclusão), ela aparece aqui.',
            actions: [el('button', { class: 'btn btn--secondary', type: 'button', onclick: () => tabs.select('added') }, 'Ver os adicionados')],
        });
        return;
    }
    renderEmpty(container, {
        title: 'Nenhum jogo corresponde a esta seleção',
        text: 'Tente outros termos ou remova algum filtro. Lembre: só aparecem controles confirmados na ficha do jogo.',
        actions: [el('button', { class: 'btn btn--secondary', type: 'button', onclick: () => { state.filters = createEmptyFilters(); update(); } }, 'Limpar filtros')],
    });
}

function renderTimeline() {
    const view = state.view;
    const { field, noun, basis } = VIEWS[view];
    const container = slot('timeline');
    const universe = universeOf(view);
    const filtered = applyFilters(universe, state.filters);

    // Contagens das duas abas respeitam os filtros ativos.
    for (const key of Object.keys(VIEWS)) $(`[data-count="${key}"]`).textContent = `(${applyFilters(universeOf(key), state.filters).length})`;
    bar.setCount(`${filtered.length} de ${universe.length} ${pluralize(universe.length, 'jogo', 'jogos')}`);

    const dateSort = DATE_SORTS.has(state.sort);
    slot('basis').textContent = dateSort
        ? `Jogos ${noun} ordenados por ${basis}, do mais ${state.sort === 'recent' ? 'novo ao mais antigo' : 'antigo ao mais novo'}.`
        : 'Ordenados por nome. A separação por períodos só aparece quando a ordenação é por data.';

    if (!filtered.length) {
        renderEmptyView(container, view, universe);
        return;
    }

    const games = sortedFor(view, filtered);
    const options = cardOptions(view);

    if (!dateSort) {
        renderGameGrid(container, games, options);
        return;
    }

    const groups = groupByPeriod(games, field);
    if (shouldSplit(groups)) {
        clear(container).appendChild(el('ol', { class: 'timeline' }, groups.map((group) => periodBlock(group, view))));
        return;
    }

    // Poucos períodos distintos: sem linha do tempo de enfeite; a data real vem escrita.
    const only = groups[0];
    const note = el('p', { class: 'timeline-flat' },
        icon('calendar', { size: 18 }),
        el('span', null,
            el('strong', null, `${noun.charAt(0).toUpperCase()}${noun.slice(1)} em ${describeDates(only.games, field)}`),
            ' — as datas cadastradas caem em um único período, por isso não há separação por períodos.')
    );
    const box = el('div');
    renderGameGrid(box, games, options);
    clear(container).append(note, box);
}

/* ---------- Ciclo de renderização ---------- */

function update() {
    bar.sync();
    writeUrl();
    renderTimeline();
}

let built = false;

async function start() {
    slot('timeline').replaceChildren(el('div', { class: 'grid-cards', 'aria-hidden': 'true' }, skeletonCards(6)));
    try {
        await loadCatalog();
    } catch (error) {
        renderError(slot('timeline'), error, start);
        return;
    }
    if (!built) {
        bar = mountFilterBar(slot('toolbar'), state, {
            id: 'rec',
            sortOptions: SORT_OPTIONS,
            defaultSort: 'recent',
            ariaLabel: 'Filtrar e ordenar as novidades',
            searchLabel: 'Pesquisar nas novidades',
            placeholder: 'Nome, gênero, tag ou plataforma',
            onChange: update,
        });
        tabs = mountTabs(slot('view-tabs'), slot('timeline'), {
            onSelect: (key) => {
                state.view = key;
                update();
            },
        });
        built = true;
    }
    readUrl();
    tabs.select(state.view, { silent: true });
    bar.sync();
    renderSummary();
    renderTimeline();
}

window.addEventListener('popstate', () => {
    if (!getAll().length) return;
    readUrl();
    tabs.select(state.view, { silent: true });
    bar.sync();
    renderTimeline();
});

start();
