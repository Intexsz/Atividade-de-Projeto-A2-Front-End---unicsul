/**
 * Blog (blog.html) — Etapa 6.
 *
 * Experiência editorial derivada de data/posts.json (nada fixo no HTML): banner, artigo principal, destaques,
 * últimas publicações, categorias, tags, pesquisa e leitura em painel (<dialog>, `#artigo=slug`) — sem página nova.
 *
 * Regras de exibição:
 * - Visão padrão (sem busca/categoria/tag): artigo principal + destaques no topo e, abaixo, as demais publicações.
 * - Com algum filtro: o topo some e a lista passa a conter TODOS os artigos que correspondem.
 * - Contagens de categorias e tags são "facetadas": mostram quantos artigos sobrariam se o chip fosse marcado.
 * Estado ⇄ URL: `?q=`, `categoria=`, `tag=`, `ordem=`, `pagina=`. Filtros usam replaceState; paginar usa pushState.
 */
import { config } from '../config.js';
import { $, el, clear, icon, clamp, debounce, pluralize } from '../modules/utils.js';
import { coverSrc, coverSize } from '../modules/cover.js';
import { loadPosts, getPosts, BLOG_SORTS, filterPosts, sortPosts, listFacets, pickLead } from '../modules/posts.js';
import { mountPagination } from '../modules/pagination.js';
import {
    createPostCard, openPost, sectionHead, formatDots, badge, renderEmpty, renderError, skeletonCards,
} from '../modules/components.js';

const slot = (name) => $(`[data-slot="${name}"]`);
const PAGE_SIZE = config.blog.pageSize;
const HIGHLIGHTS = config.blog.highlights;
const DEFAULT_SORT = 'recent';
const SORT_KEYS = [...Object.keys(BLOG_SORTS), 'relevance'];
const TAG_LIMIT = 12;
const QUERY_MAX = 80;

const state = { query: '', category: '', tag: '', sort: DEFAULT_SORT, sortChosen: false, page: 1, allTags: false };
const ui = {};
let facets = { categories: [], tags: [] }; // acervo inteiro (ordem estável)
let memo = { key: '', value: null };

const fmt = (n) => n.toLocaleString('pt-BR');
const countPosts = (n) => `${fmt(n)} ${pluralize(n, 'artigo', 'artigos')}`;
const hasQuery = () => state.query.trim().length > 0;
const isFiltering = () => hasQuery() || Boolean(state.category) || Boolean(state.tag);

/* ---------- Estado <-> URL ---------- */

function syncAutoSort() {
    if (state.sortChosen) {
        if (state.sort === 'relevance' && !hasQuery()) { state.sort = DEFAULT_SORT; state.sortChosen = false; }
        return;
    }
    state.sort = hasQuery() ? 'relevance' : DEFAULT_SORT;
}

function readUrl() {
    const params = new URLSearchParams(location.search);
    state.query = (params.get('q') ?? '').slice(0, QUERY_MAX);
    const category = (params.get('categoria') ?? '').trim();
    const tag = (params.get('tag') ?? '').trim();
    state.category = facets.categories.some((c) => c.slug === category) ? category : '';
    state.tag = facets.tags.some((t) => t.slug === tag) ? tag : '';
    const sort = params.get('ordem') ?? '';
    state.sortChosen = SORT_KEYS.includes(sort) && (sort !== 'relevance' || hasQuery());
    state.sort = state.sortChosen ? sort : DEFAULT_SORT;
    const page = Number.parseInt(params.get('pagina') ?? '', 10);
    state.page = Number.isFinite(page) && page >= 1 ? page : 1;
    syncAutoSort();
}

function writeUrl(push) {
    const params = new URLSearchParams();
    if (hasQuery()) params.set('q', state.query.trim());
    if (state.category) params.set('categoria', state.category);
    if (state.tag) params.set('tag', state.tag);
    if (state.sortChosen) params.set('ordem', state.sort);
    if (state.page > 1) params.set('pagina', String(state.page));
    const qs = params.toString();
    history[push ? 'pushState' : 'replaceState'](null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}

/* ---------- Dados derivados ---------- */

function compute() {
    const key = JSON.stringify([state.query.trim(), state.category, state.tag, state.sort]);
    if (memo.key === key) return memo.value;
    const all = getPosts();
    const filters = { query: state.query, category: state.category, tag: state.tag };
    const lead = pickLead(all, HIGHLIGHTS);
    const inLead = new Set([lead.main?.id, ...lead.highlights.map((p) => p.id)]);
    const universe = isFiltering() ? all : all.filter((p) => !inLead.has(p.id));
    const found = sortPosts(filterPosts(universe, filters), state.sort, state.query);
    const value = {
        all, lead, universe, found,
        categories: listFacets(all, filterPosts(all, { query: state.query, tag: state.tag })).categories,
        tags: listFacets(all, filterPosts(all, { query: state.query, category: state.category })).tags,
    };
    memo = { key, value };
    return value;
}

const facetName = (list, slug) => list.find((f) => f.slug === slug)?.name ?? slug;

/* ---------- Banner, números e topo editorial ---------- */

function renderHero(posts) {
    const { main } = pickLead(posts, 0);
    const demo = posts.filter((p) => p.demo).length;
    const stat = (value, text) => el('li', { class: 'stat-pills__item' }, el('strong', null, fmt(value)), ` ${text}`);
    clear(slot('stats')).append(
        stat(posts.length, pluralize(posts.length, 'artigo', 'artigos')),
        stat(facets.categories.length, pluralize(facets.categories.length, 'categoria', 'categorias')),
        stat(facets.tags.length, pluralize(facets.tags.length, 'tag', 'tags')),
        ...(demo ? [stat(demo, pluralize(demo, 'texto de demonstração', 'textos de demonstração'))] : []));
    if (main) {
        const [w, h] = coverSize('wide');
        clear(slot('hero-art')).appendChild(el('img', { src: coverSrc(main, 'wide'), alt: '', width: w, height: h, decoding: 'async' }));
    }
}

function leadItem(post, index) {
    return el('li', { class: 'lead-item' },
        el('img', { class: 'lead-item__img', src: coverSrc(post, 'wide'), alt: '', width: 160, height: 90, loading: 'lazy', decoding: 'async' }),
        el('div', { class: 'lead-item__body' },
            el('p', { class: 'lead-item__cat' }, el('span', { class: 'lead-item__n', 'aria-hidden': 'true' }, String(index + 2).padStart(2, '0')), post.category),
            el('h3', { class: 'lead-item__title' },
                el('button', { class: 'lead-item__open', type: 'button', 'aria-haspopup': 'dialog', dataset: { action: 'open-post', id: post.id } }, post.title)),
            el('p', { class: 'lead-item__meta' },
                [formatDots(post.publishedAt), post.readingMinutes && `${post.readingMinutes} min de leitura`].filter(Boolean).join(' · '),
                post.demo && badge('Demonstração', 'demo'))));
}

function renderLead() {
    const host = slot('lead');
    const { lead } = compute();
    const show = Boolean(lead.main) && !isFiltering();
    host.hidden = !show;
    if (!show) return;
    if (host.dataset.ready === lead.main.id + lead.highlights.map((p) => p.id).join()) return; // já desenhado
    host.dataset.ready = lead.main.id + lead.highlights.map((p) => p.id).join();
    clear(host).appendChild(el('div', { class: 'container-wide' },
        sectionHead({ id: 'lead-title', eyebrow: 'Em destaque', title: 'Leitura principal' }),
        el('div', { class: 'lead-grid' },
            el('div', { class: 'lead-grid__main' }, createPostCard(lead.main, { variant: 'feature', eager: true })),
            lead.highlights.length > 0 && el('div', { class: 'lead-grid__side' },
                el('h3', { class: 'lead-grid__side-title' }, 'Destaques'),
                el('ol', { class: 'lead-list' }, lead.highlights.map(leadItem))))));
}

/* ---------- Barra de pesquisa e ordenação ---------- */

function mountToolbar() {
    ui.input = el('input', {
        class: 'search-input__field', id: 'blog-q', type: 'search', placeholder: 'Título, assunto, tag…',
        autocomplete: 'off', spellcheck: 'false', maxlength: String(QUERY_MAX), 'aria-describedby': 'blog-q-hint',
    });
    ui.clearQuery = el('button', { class: 'search-input__clear', type: 'button', 'aria-label': 'Limpar pesquisa', hidden: true }, icon('close', { size: 16 }));
    ui.sort = el('select', { class: 'select', id: 'blog-sort' },
        Object.entries(BLOG_SORTS).map(([key, text]) => el('option', { value: key }, text)),
        (ui.relevance = el('option', { value: 'relevance' }, 'Mais relevantes')));

    const applyQuery = debounce(() => change(() => { state.query = ui.input.value; }), 220);
    ui.input.addEventListener('input', () => {
        ui.clearQuery.hidden = !ui.input.value;
        applyQuery();
    });
    ui.clearQuery.addEventListener('click', () => {
        applyQuery.cancel?.();
        ui.input.value = '';
        ui.clearQuery.hidden = true;
        change(() => { state.query = ''; });
        ui.input.focus();
    });
    ui.sort.addEventListener('change', () => change(() => {
        if (!SORT_KEYS.includes(ui.sort.value)) return;
        state.sort = ui.sort.value;
        state.sortChosen = true;
    }));
    ui.applyQuery = applyQuery;

    const form = el('form', { class: 'blog-toolbar__form', role: 'search', 'aria-label': 'Pesquisar no blog', novalidate: true },
        el('div', { class: 'field field--search' },
            el('label', { class: 'field__label', for: 'blog-q' }, 'Pesquisar artigos'),
            el('div', { class: 'search-input' }, icon('search', { size: 18 }), ui.input, ui.clearQuery),
            el('p', { class: 'field__hint', id: 'blog-q-hint' }, 'A busca atualiza a lista enquanto você digita.')),
        el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'blog-sort' }, 'Ordenar por'), ui.sort));
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        ui.applyQuery.cancel?.();
        change(() => { state.query = ui.input.value; });
    });
    slot('toolbar').appendChild(form);
}

/* ---------- Categorias e tags ---------- */

function mountAside(posts) {
    ui.cats = new Map();
    ui.tags = new Map();

    const allBtn = el('button', { class: 'cat-item', type: 'button', 'aria-pressed': 'false', dataset: { category: '' } },
        el('span', { class: 'cat-item__name' }, 'Todas as categorias'), (ui.allCount = el('span', { class: 'cat-item__count' })));
    ui.cats.set('', { btn: allBtn, count: ui.allCount });
    const catItems = [el('li', null, allBtn)];
    for (const cat of facets.categories) {
        const count = el('span', { class: 'cat-item__count' });
        const btn = el('button', { class: 'cat-item', type: 'button', 'aria-pressed': 'false', dataset: { category: cat.slug } }, el('span', { class: 'cat-item__name' }, cat.name), count);
        ui.cats.set(cat.slug, { btn, count });
        catItems.push(el('li', null, btn));
    }

    const tagChips = facets.tags.map((tag, index) => {
        const count = el('span', { class: 'chip__count' });
        const btn = el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', dataset: { tag: tag.slug } }, `#${tag.name}`, count);
        ui.tags.set(tag.slug, { btn, count, index });
        return btn;
    });
    ui.moreTags = el('button', { class: 'link-btn blog-aside__more', type: 'button', 'aria-expanded': 'false' });
    ui.moreTags.addEventListener('click', () => {
        state.allTags = !state.allTags;
        syncAside();
    });

    const demo = posts.filter((p) => p.demo).length;
    slot('aside').append(
        el('section', { class: 'blog-aside__block', 'aria-labelledby': 'cat-title' },
            el('h2', { class: 'blog-aside__title', id: 'cat-title' }, 'Categorias'),
            el('ul', { class: 'cat-list' }, catItems)),
        facets.tags.length > 0 && el('section', { class: 'blog-aside__block', 'aria-labelledby': 'tag-title' },
            el('h2', { class: 'blog-aside__title', id: 'tag-title' }, 'Tags'),
            el('div', { class: 'chips', role: 'group', 'aria-labelledby': 'tag-title' }, tagChips),
            facets.tags.length > TAG_LIMIT && ui.moreTags),
        demo > 0 && el('p', { class: 'callout callout--info blog-aside__note' }, icon('info', { size: 18 }),
            el('span', null, `${fmt(demo)} ${pluralize(demo, 'artigo é', 'artigos são')} texto${demo === 1 ? '' : 's'} de demonstração, identificado${demo === 1 ? '' : 's'} em cada card. Não são notícias.`)));

    slot('aside').addEventListener('click', (event) => {
        const cat = event.target.closest('button[data-category]');
        if (cat) { change(() => { state.category = state.category === cat.dataset.category ? '' : cat.dataset.category; }); return; }
        const tag = event.target.closest('button[data-tag]');
        if (tag) change(() => { state.tag = state.tag === tag.dataset.tag ? '' : tag.dataset.tag; });
    });
}

function syncAside() {
    const { categories, tags, all } = compute();
    ui.allCount.textContent = fmt(filterPosts(all, { query: state.query, tag: state.tag }).length);
    ui.cats.get('').btn.setAttribute('aria-pressed', String(!state.category));
    for (const cat of categories) {
        const ref = ui.cats.get(cat.slug);
        const on = cat.slug === state.category;
        ref.count.textContent = fmt(cat.count);
        ref.btn.setAttribute('aria-pressed', String(on));
        ref.btn.disabled = cat.count === 0 && !on;
        ref.btn.setAttribute('aria-label', `${cat.name}, ${countPosts(cat.count)}`);
    }
    for (const tag of tags) {
        const ref = ui.tags.get(tag.slug);
        const on = tag.slug === state.tag;
        ref.count.textContent = fmt(tag.count);
        ref.btn.setAttribute('aria-pressed', String(on));
        ref.btn.disabled = tag.count === 0 && !on;
        ref.btn.setAttribute('aria-label', `Tag ${tag.name}, ${countPosts(tag.count)}`);
        ref.btn.hidden = !state.allTags && ref.index >= TAG_LIMIT && !on; // a tag marcada nunca some
    }
    const extra = facets.tags.length - TAG_LIMIT;
    ui.moreTags.hidden = extra <= 0;
    ui.moreTags.textContent = state.allTags ? 'Mostrar menos tags' : `Mostrar todas as tags (+${extra})`;
    ui.moreTags.setAttribute('aria-expanded', String(state.allTags));
}

/* ---------- Filtros ativos ---------- */

function renderActive() {
    const chips = [];
    const { categories, tags } = compute();
    const add = (label, text, onRemove) => chips.push(el('li', null,
        el('button', { class: 'chip chip--remove', type: 'button', 'aria-label': `Remover filtro: ${label} ${text}`, onclick: onRemove }, el('span', null, el('span', { class: 'chip__label' }, `${label}: `), text), icon('close', { size: 14 }))));
    if (hasQuery()) add('Busca', `“${state.query.trim()}”`, () => dropFilter(() => { state.query = ''; ui.input.value = ''; ui.clearQuery.hidden = true; }));
    if (state.category) add('Categoria', facetName(categories, state.category), () => dropFilter(() => { state.category = ''; }));
    if (state.tag) add('Tag', `#${facetName(tags, state.tag)}`, () => dropFilter(() => { state.tag = ''; }));
    const host = slot('active');
    host.hidden = chips.length === 0;
    clear(host);
    if (!chips.length) return;
    host.append(...chips, el('li', null, el('button', { class: 'link-btn', type: 'button', dataset: { blog: 'clear-filters' }, onclick: clearFilters }, 'Limpar filtros')));
}

/** Remover um filtro apaga o botão que estava em foco: o foco vai para o título da lista (sem rolar). */
function dropFilter(mutator) {
    ui.applyQuery.cancel?.();
    change(mutator);
    $('#results-title').focus({ preventScroll: true });
}

function clearFilters() {
    dropFilter(() => { state.query = ''; state.category = ''; state.tag = ''; ui.input.value = ''; ui.clearQuery.hidden = true; });
}

/* ---------- Lista de resultados ---------- */

function renderResults() {
    const { found, universe, all } = compute();
    const pages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
    state.page = clamp(state.page, 1, pages);
    const from = (state.page - 1) * PAGE_SIZE;
    const shown = found.slice(from, from + PAGE_SIZE);
    const host = slot('results');
    const filtering = isFiltering();

    $('#results-title').textContent = filtering ? 'Resultados' : 'Últimas publicações';
    slot('summary').textContent = found.length
        ? `Mostrando ${fmt(from + 1)}–${fmt(from + shown.length)} de ${countPosts(found.length)}${!filtering && universe.length !== all.length ? ' (os demais estão em destaque, acima)' : filtering ? ` (de ${fmt(all.length)} no blog)` : ''}`
        : filtering ? 'Nenhum artigo encontrado' : '';
    host.setAttribute('aria-busy', 'false');

    if (found.length) {
        clear(host).appendChild(el('ul', { class: 'post-grid' }, shown.map((post, i) =>
            el('li', { class: 'post-grid__item' }, createPostCard(post, { query: state.query, eager: state.page === 1 && i < 3 })))));
    } else if (filtering) {
        renderEmpty(host, {
            title: 'Nenhum artigo corresponde à sua seleção',
            text: hasQuery()
                ? `Não encontramos “${state.query.trim()}” com os filtros atuais. Tente outro termo ou remova algum filtro.`
                : 'Nenhum artigo reúne essa categoria e essa tag ao mesmo tempo. Remova um dos filtros.',
            actions: [el('button', { class: 'btn btn--secondary', type: 'button', onclick: clearFilters }, 'Limpar filtros')],
        });
    } else {
        // Visão padrão em que tudo já está no topo (acervo pequeno): sem lista duplicada.
        clear(host);
        slot('summary').textContent = `${countPosts(all.length)} no blog, todos em destaque acima.`;
    }
    ui.paginate({ page: state.page, pages, onPage: (page) => { state.page = page; update({ push: true, scrollTo: 'results' }); } });
}

/* ---------- Ciclo de atualização ---------- */

function update({ push = false, scrollTo = '' } = {}) {
    syncAutoSort();
    ui.relevance.hidden = ui.relevance.disabled = !hasQuery();
    ui.sort.value = state.sort;
    renderLead();
    renderResults();
    syncAside();
    renderActive();
    writeUrl(push);
    if (scrollTo === 'results') {
        const title = $('#results-title');
        title.focus({ preventScroll: true });
        title.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
}

/** Mudança de filtro/ordem: volta à página 1 e só atualiza a URL (sem criar entrada de histórico). */
function change(mutator) {
    mutator();
    state.page = 1;
    update();
}

/* ---------- Montagem ---------- */

function init(posts) {
    facets = listFacets(posts);
    renderHero(posts);
    mountToolbar();
    mountAside(posts);
    ui.paginate = mountPagination(slot('pagination'));

    readUrl();
    ui.input.value = state.query;
    ui.clearQuery.hidden = !state.query;
    update();

    window.addEventListener('popstate', () => {
        readUrl();
        ui.input.value = state.query;
        ui.clearQuery.hidden = !state.query;
        update();
    });

    // Tags e categoria dentro do painel de leitura aplicam o filtro aqui mesmo, em vez de recarregar a página.
    document.addEventListener('click', (event) => {
        const link = event.target.closest('#post-dialog a[data-blog-filter]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        const { blogFilter, value } = link.dataset;
        link.closest('dialog').close();
        ui.applyQuery.cancel?.();
        change(() => {
            state.query = ''; state.category = ''; state.tag = '';
            ui.input.value = ''; ui.clearQuery.hidden = true;
            if (blogFilter === 'categoria' && facets.categories.some((c) => c.slug === value)) state.category = value;
            if (blogFilter === 'tag' && facets.tags.some((t) => t.slug === value)) state.tag = value;
        });
        const title = $('#results-title');
        title.focus({ preventScroll: true });
        title.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
}

async function start() {
    const results = slot('results');
    slot('lead').hidden = true;
    clear(results).appendChild(el('div', { class: 'post-grid', 'aria-hidden': 'true' }, skeletonCards(3, 'wide')));
    results.setAttribute('aria-busy', 'true');
    let posts;
    try {
        posts = await loadPosts();
    } catch (error) {
        results.setAttribute('aria-busy', 'false');
        renderError(results, error, start);
        return;
    }
    if (!posts.length) {
        results.setAttribute('aria-busy', 'false');
        renderEmpty(results, { title: 'Nenhum artigo publicado ainda', text: 'Os artigos aparecem aqui automaticamente quando forem adicionados em data/posts.json.', iconName: 'news' });
        return;
    }
    init(posts);
}

start();
