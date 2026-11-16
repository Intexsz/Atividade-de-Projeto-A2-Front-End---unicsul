/**
 * Tendências (tendencias.html) — Etapa 2.
 *
 * O que a página mostra (tudo derivado de data/games.json + acessos LOCAIS deste navegador):
 *  - Ranking com pódio Top 3, linhas numeradas e indicador proporcional ao dado real.
 *  - Pesquisa, filtros (gênero, plataforma, controles) e ordenação; estado espelhado na URL.
 *  - "Em alta": comparativo dos últimos 7 dias × 7 dias anteriores (só acessos com data registrada).
 *  - Seleção editorial e classificação por gênero / plataforma.
 *
 * Regras de honestidade (brief): nada de números globais, gráficos ou crescimento inventados.
 * Sem acessos registrados, o ranking NÃO é numerado — aparece um pódio vazio explicativo e a seleção editorial.
 */
import { config } from '../config.js';
import { $, $$, el, clear, icon, pluralize, prefersReducedMotion } from '../modules/utils.js';
import { loadCatalog, getAll, getFeatured, getGenres, getPlatforms } from '../modules/catalog.js';
import {
    applyFilters, sortGames, SORT_MODES, RANKING_MODES, FAVORITE_POINTS, rankScore,
    createEmptyFilters, countActiveFilters,
} from '../modules/filters.js';
import { mountFilterBar, readFilterUrl, writeFilterUrl } from '../modules/filterbar.js';
import { mountTabs } from '../modules/tabs.js';
import { metrics } from '../modules/metrics.js';
import { getFavorites } from '../modules/favorites.js';
import { coverSrc, coverSize } from '../modules/cover.js';
import { createGameCard, createRail, renderEmpty, renderError, renderGameGrid, skeletonCards } from '../modules/components.js';

const slot = (name) => $(`[data-slot="${name}"]`);
const SORT_KEYS = ['popular', 'accessed', 'trending', 'recent', 'updated', 'az', 'za'];
const WINDOW_DAYS = config.metrics.trendWindowDays;
const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
const lastFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const state = {
    filters: createEmptyFilters(),
    sort: 'popular',
    group: 'genre', // aba da classificação: 'genre' | 'platform'
};

/* =========================================================================
   Estado <-> URL (filtros e ordenação: ver modules/filterbar.js)
   ========================================================================= */

const SORT_OPTIONS = Object.fromEntries(SORT_KEYS.map((key) => [key, SORT_MODES[key]]));
const URL_OPTIONS = { sortOptions: SORT_OPTIONS, defaultSort: 'popular' };
const readUrl = () => readFilterUrl(state, URL_OPTIONS);
const writeUrl = () => writeFilterUrl(state, URL_OPTIONS);

/* =========================================================================
   Resumo local (números reais deste navegador)
   ========================================================================= */

function renderSummary() {
    const box = clear(slot('summary'));
    const totals = metrics.getTotals();
    const total = getAll().length;
    const favs = getFavorites().length;
    const stat = (value, text) => el('li', { class: 'stat-pills__item' }, el('strong', null, String(value)), ` ${text}`);

    const list = el('ul', { class: 'stat-pills' });
    if (totals.accesses > 0) {
        list.append(
            stat(totals.accesses, pluralize(totals.accesses, 'acesso registrado', 'acessos registrados')),
            stat(totals.games, `de ${total} ${pluralize(total, 'jogo acessado', 'jogos acessados')}`)
        );
    } else {
        list.append(el('li', { class: 'stat-pills__item' }, 'Nenhum acesso registrado neste dispositivo ainda'));
    }
    list.append(stat(favs, pluralize(favs, 'favorito', 'favoritos')));
    if (totals.last) list.append(el('li', { class: 'stat-pills__item' }, `Último acesso: ${lastFormatter.format(new Date(totals.last))}`));

    box.append(
        list,
        el('p', { class: 'local-summary__note' },
            icon('info', { size: 16 }),
            'Estes números existem só neste navegador. ',
            el('button', { class: 'link-btn', type: 'button', dataset: { action: 'open-privacy' } }, 'Gerenciar dados locais')
        )
    );
}

/* =========================================================================
   Indicador de popularidade (proporcional ao dado local real)
   ========================================================================= */

function meterText(entry, mode) {
    if (mode === 'trending') {
        const { previous } = metrics.getWindow(entry.game.id);
        return [el('strong', null, `+${entry.score}`), ` nos últimos ${WINDOW_DAYS} dias · ${previous} nos ${WINDOW_DAYS} anteriores`];
    }
    const count = metrics.getCount(entry.game.id);
    const parts = [el('strong', null, String(count)), ` ${pluralize(count, 'acesso', 'acessos')}`];
    if (mode === 'popular' && entry.score > count) parts.push(' · ', icon('heart', { size: 13, className: 'meter__heart' }), ` favorito (+${FAVORITE_POINTS})`);
    return parts;
}

function meter(entry, mode, max) {
    const fill = el('span', { class: 'meter__fill' });
    // Largura proporcional ao líder; piso de 6% para a barra continuar visível.
    fill.style.setProperty('--w', `${Math.max(6, Math.round((entry.score / max) * 100))}%`);
    return el('div', { class: 'meter' },
        el('div', { class: 'meter__track', 'aria-hidden': 'true' }, fill),
        el('p', { class: 'meter__text' }, meterText(entry, mode))
    );
}

/* =========================================================================
   Ranking principal
   ========================================================================= */

/** Ordem editorial (destaques primeiro, depois nome) — usada quando ainda não há acessos. */
const editorialOrder = (games) => [...games].sort((a, b) =>
    Number(b.editorial.featured) - Number(a.editorial.featured)
    || (a.editorial.featuredOrder ?? 999) - (b.editorial.featuredOrder ?? 999)
    || byName(a, b));

function podiumSlot(entry, index, mode, max) {
    const tier = Math.min(entry.rank, 3);
    return el('li', { class: `podium__slot podium__slot--${index + 1} tier-${tier}` },
        createGameCard(entry.game, { variant: 'poster', eager: index === 0 }),
        el('div', { class: 'podium__plinth' },
            el('span', { class: 'podium__num', 'aria-hidden': 'true' }, String(entry.rank)),
            el('div', { class: 'podium__info' },
                el('p', { class: 'podium__place' }, `${entry.rank}º lugar`),
                meter(entry, mode, max)
            )
        )
    );
}

function rankRow(entry, mode, max) {
    return el('li', { class: 'rank-row' },
        el('span', { class: 'rank-row__num', 'aria-label': `Posição ${entry.rank}` }, String(entry.rank).padStart(2, '0')),
        createGameCard(entry.game, { variant: 'row' }),
        meter(entry, mode, max)
    );
}

const blockHead = (title, text) => el('header', { class: 'trend-block__head' },
    el('h3', { class: 'trend-block__title' }, title),
    text && el('p', { class: 'trend-block__text' }, text));

/** Sem nenhum acesso: pódio vazio (só ilustra o mecanismo) + seleção editorial sem numeração. */
function renderNoData(container, games, mode, filtered) {
    const why = mode === 'trending'
        ? `Nenhum acesso dos últimos ${WINDOW_DAYS} dias foi registrado neste dispositivo.`
        : 'Ainda não há acessos registrados neste dispositivo.';
    const ghost = (n) => el('li', { class: `podium__slot podium__slot--${n} podium__slot--ghost` },
        el('div', { class: 'podium__ghost' }, el('span', { class: 'podium__ghost-num' }, String(n)), el('span', { class: 'podium__ghost-text' }, 'Vaga livre')));

    clear(container).append(
        el('div', { class: 'podium podium--empty', 'aria-hidden': 'true' }, el('ol', { class: 'podium__list' }, [1, 2, 3].map(ghost))),
        el('div', { class: 'state state--empty trend-empty', role: 'status' },
            el('span', { class: 'state__icon' }, icon('bolt', { size: 28 })),
            el('h3', { class: 'state__title' }, 'Seu pódio começa no primeiro acesso'),
            el('p', { class: 'state__text' }, `${why} Cada clique em JOGAR AGORA passa a contar para o ranking local — ele não é global e nada aqui é estimado.`)
        ),
        // Sem filtros, a seleção editorial já aparece na seção "Em destaque" logo abaixo — não repetir.
        // Com filtros ativos ela vira a lista de jogos da seleção (que a seção de destaques não reflete).
        filtered && el('section', { class: 'trend-block', 'aria-label': 'Jogos desta seleção' },
            blockHead('Jogos desta seleção', 'Em ordem editorial. Não é um ranking e por isso os jogos não são numerados.'),
            (() => { const box = el('div'); renderGameGrid(box, games, { badge: true }); return box; })()
        )
    );
}

function renderRanking() {
    const container = slot('ranking');
    const all = getAll();
    const filtered = applyFilters(all, state.filters);
    const mode = state.sort;
    const ranking = RANKING_MODES.includes(mode);

    bar.setCount(`${filtered.length} de ${all.length} ${pluralize(all.length, 'jogo', 'jogos')}`);
    const basis = slot('basis');

    if (!filtered.length) {
        basis.textContent = 'Nenhum jogo corresponde aos filtros atuais.';
        renderEmpty(container, {
            title: 'Nenhum jogo corresponde a esta seleção',
            text: 'Tente outros termos ou remova algum filtro. Lembre: só aparecem controles confirmados na ficha do jogo.',
            actions: [el('button', { class: 'btn btn--secondary', type: 'button', onclick: () => { state.filters = createEmptyFilters(); update({ toolbar: true }); } }, 'Limpar filtros')],
        });
        return;
    }

    const sorted = sortGames(filtered, mode, { query: state.filters.query });

    if (!ranking) {
        basis.textContent = `Ordenado por “${SORT_MODES[mode].toLowerCase()}”. Esta ordenação não mede popularidade, então os jogos não são numerados — escolha uma ordenação por acessos para ver o pódio.`;
        renderGameGrid(container, sorted, { badge: true, showDate: mode === 'recent' || mode === 'updated' });
        return;
    }

    const favs = new Set(getFavorites());
    const scored = sorted.map((game) => ({ game, score: rankScore(game, mode, favs) }));
    const ranked = scored.filter((e) => e.score > 0);
    const unranked = scored.filter((e) => e.score <= 0).map((e) => e.game);

    if (!ranked.length) {
        basis.textContent = mode === 'trending'
            ? `Sem acessos dos últimos ${WINDOW_DAYS} dias registrados neste dispositivo — o ranking “em alta” só existe a partir de acessos reais.`
            : 'Sem acessos registrados neste dispositivo — ainda não há ranking para mostrar.';
        renderNoData(container, editorialOrder(filtered), mode, countActiveFilters(state.filters) > 0);
        return;
    }

    basis.textContent = {
        popular: `Ordem pelos acessos registrados neste dispositivo, com +${FAVORITE_POINTS} pontos por jogo favoritado. Não são estatísticas globais.`,
        accessed: 'Ordem pelo total de acessos (JOGAR AGORA) registrados neste dispositivo. Não são estatísticas globais.',
        trending: `Ordem pelos acessos dos últimos ${WINDOW_DAYS} dias neste dispositivo. Não são estatísticas globais.`,
    }[mode];

    // Empates dividem a posição (1, 2, 2, 4…): nenhum jogo "ganha" um lugar por desempate de nome.
    ranked.forEach((entry, i) => { entry.rank = i > 0 && entry.score === ranked[i - 1].score ? ranked[i - 1].rank : i + 1; });
    const max = ranked[0].score;
    const top = ranked.slice(0, 3);
    const rest = ranked.slice(3);

    const blocks = [
        el('div', { class: `podium podium--n${top.length}`, role: 'group', 'aria-label': `Top ${top.length}` },
            el('ol', { class: 'podium__list' }, top.map((entry, i) => podiumSlot(entry, i, mode, max)))
        ),
    ];
    if (rest.length) {
        blocks.push(el('section', { class: 'trend-block', 'aria-label': 'Demais posições' },
            blockHead('Demais posições'),
            el('ol', { class: 'rank-list' }, rest.map((entry) => rankRow(entry, mode, max)))
        ));
    }
    if (unranked.length) {
        blocks.push(el('section', { class: 'trend-block', 'aria-label': 'Sem acessos ainda' },
            blockHead('Ainda sem acessos', 'Jogos desta seleção que você ainda não abriu neste dispositivo — por isso não entram no ranking.'),
            (() => { const box = el('div'); renderGameGrid(box, unranked, { badge: true }); return box; })()
        ));
    }
    clear(container).append(...blocks);
}

/* =========================================================================
   Em alta (últimos N dias × N dias anteriores)
   ========================================================================= */

function renderRising() {
    const container = slot('rising');
    const entries = getAll()
        .map((game) => ({ game, ...metrics.getWindow(game.id) }))
        .filter((e) => e.recent > 0 && e.recent > e.previous)
        .sort((a, b) => (b.recent - b.previous) - (a.recent - a.previous) || b.recent - a.recent || byName(a.game, b.game));

    if (!entries.length) {
        renderEmpty(container, {
            iconName: 'bolt',
            title: 'Nada em alta por enquanto',
            text: metrics.hasData()
                ? `Nenhum jogo teve mais acessos nos últimos ${WINDOW_DAYS} dias do que nos ${WINDOW_DAYS} anteriores. O comparativo só usa acessos com data registrada; acessos antigos, sem data, não entram.`
                : 'Ainda não há acessos registrados neste dispositivo. Use JOGAR AGORA nos jogos para começar a medir.',
        });
        return;
    }
    const items = entries.map((e) => el('div', { class: 'rising-item' },
        createGameCard(e.game, { variant: 'poster' }),
        el('p', { class: 'rising-item__delta' }, icon('bolt', { size: 16 }), el('strong', null, `+${e.recent - e.previous}`), ` vs. ${WINDOW_DAYS} dias anteriores`),
        el('p', { class: 'rising-item__detail' }, `${e.recent} nos últimos ${WINDOW_DAYS} dias · ${e.previous} nos ${WINDOW_DAYS} anteriores`)
    ));
    clear(container).appendChild(createRail(items, { label: 'Jogos em alta' }));
}

/* =========================================================================
   Em destaque (editorial)
   ========================================================================= */

function renderFeatured() {
    const container = slot('featured');
    const games = getFeatured();
    if (!games.length) {
        renderEmpty(container, { title: 'Sem destaques editoriais', text: 'Marque jogos com editorial.featured em data/games.json.' });
        return;
    }
    clear(container).appendChild(createRail(games.map((game) => createGameCard(game, { variant: 'poster', badge: true })), { label: 'Jogos em destaque' }));
}

/* =========================================================================
   Classificação por gênero / plataforma
   ========================================================================= */

function groupsFor(kind) {
    const all = getAll();
    if (kind === 'platform') {
        return getPlatforms().map((p) => ({ key: p.name, name: p.name, games: all.filter((g) => g.platform === p.name) }));
    }
    return getGenres().map((g) => ({ key: g.slug, name: g.name, games: all.filter((x) => x.genreSlugs.includes(g.slug)) }));
}

function groupCard(group, kind) {
    const games = sortGames(group.games, 'popular');
    const accesses = group.games.reduce((sum, g) => sum + metrics.getCount(g.id), 0);
    const [w, h] = coverSize('thumb');
    const leaders = games.slice(0, 3).map((game) => {
        const count = metrics.getCount(game.id);
        return el('li', { class: 'class-card__item' },
            el('button', { class: 'class-card__game', type: 'button', 'aria-haspopup': 'dialog', dataset: { action: 'open-game', id: game.id } },
                el('img', { class: 'class-card__thumb', src: coverSrc(game, 'thumb'), alt: '', width: w, height: h, loading: 'lazy', decoding: 'async' }),
                el('span', { class: 'class-card__name' }, game.name),
                el('span', { class: 'class-card__meta' }, count > 0 ? `${count} ${pluralize(count, 'acesso', 'acessos')}` : 'sem acessos')
            )
        );
    });
    return el('article', { class: 'class-card' },
        el('header', { class: 'class-card__head' },
            el('h3', { class: 'class-card__title' }, group.name),
            el('p', { class: 'class-card__stats' },
                el('strong', null, String(group.games.length)), ` ${pluralize(group.games.length, 'jogo', 'jogos')} · `,
                accesses > 0 ? `${accesses} ${pluralize(accesses, 'acesso', 'acessos')} neste dispositivo` : 'sem acessos neste dispositivo')
        ),
        el('ol', { class: 'class-card__list' }, leaders),
        el('button', { class: 'btn btn--ghost btn--sm class-card__apply', type: 'button', dataset: { actionTrend: 'apply-group', kind, key: group.key } }, 'Filtrar o ranking')
    );
}

function renderClassification() {
    const panel = clear(slot('class-panel'));
    const groups = groupsFor(state.group).filter((g) => g.games.length);
    if (!groups.length) {
        renderEmpty(panel, { title: 'Nenhum grupo disponível', text: 'O catálogo ainda não tem jogos classificados.' });
        return;
    }
    panel.appendChild(el('div', { class: 'class-grid' }, groups.map((g) => groupCard(g, state.group))));
}

function setupClassification() {
    mountTabs(slot('class-tabs'), slot('class-panel'), {
        onSelect: (kind) => {
            state.group = kind;
            renderClassification();
        },
    });

    // Botão "Filtrar o ranking": zera os outros filtros e aplica só o grupo escolhido.
    slot('class-panel').addEventListener('click', (event) => {
        const button = event.target.closest('[data-action-trend="apply-group"]');
        if (!button) return;
        const { kind, key } = button.dataset;
        state.filters = createEmptyFilters();
        if (kind === 'platform') state.filters.platforms = [key];
        else state.filters.genres = [key];
        update({ toolbar: true });
        const heading = $('#ranking-title');
        heading.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        heading.focus({ preventScroll: true });
    });
}

/* =========================================================================
   Ciclo de renderização
   ========================================================================= */

/** Re-renderiza o ranking preservando o foco do botão de favorito (o card pode mudar de posição). */
function renderRankingKeepingFocus() {
    const container = slot('ranking');
    const active = document.activeElement;
    const favId = active instanceof HTMLElement && container.contains(active) && active.matches('[data-action="toggle-fav"]') ? active.dataset.id : null;
    renderRanking();
    if (favId) {
        const again = $$('[data-action="toggle-fav"]', container).find((node) => node.dataset.id === favId);
        again?.focus({ preventScroll: true });
    }
}

function update({ toolbar = false } = {}) {
    if (toolbar) {
        bar.sync();
        writeUrl();
    }
    renderRankingKeepingFocus();
}

function renderAll() {
    bar.sync();
    renderSummary();
    renderRanking();
    renderRising();
    renderFeatured();
    renderClassification();
}

let built = false;
let bar = null; // barra de filtros compartilhada (montada após o catálogo carregar)

async function start() {
    slot('ranking').replaceChildren(el('div', { class: 'grid-cards', 'aria-hidden': 'true' }, skeletonCards(6)));
    try {
        await loadCatalog();
    } catch (error) {
        renderError(slot('ranking'), error, start);
        return;
    }
    if (!built) {
        // Chips e abas dependem dos gêneros/plataformas reais do catálogo; só existem depois do carregamento.
        bar = mountFilterBar(slot('toolbar'), state, {
            id: 'trend',
            sortOptions: SORT_OPTIONS,
            defaultSort: 'popular',
            ariaLabel: 'Filtrar e ordenar o ranking',
            searchLabel: 'Pesquisar no ranking',
            placeholder: 'Nome, gênero, tag ou plataforma',
            onChange: () => update({ toolbar: true }),
        });
        setupClassification();
        built = true;
    }
    readUrl();
    renderAll();
}

// Acessos mudaram (ex.: JOGAR AGORA na ficha): tudo que depende de acessos é refeito.
window.addEventListener('projeto-fenix:metrics-changed', () => {
    if (!getAll().length) return;
    renderSummary();
    renderRankingKeepingFocus();
    renderRising();
    renderClassification();
});
// Favorito mudou: só afeta o modo "populares" (e o resumo).
window.addEventListener('projeto-fenix:favorites-changed', () => {
    if (!getAll().length) return;
    renderSummary();
    if (state.sort === 'popular') renderRankingKeepingFocus();
});
window.addEventListener('popstate', () => {
    if (!getAll().length) return;
    readUrl();
    renderAll();
});

start();
