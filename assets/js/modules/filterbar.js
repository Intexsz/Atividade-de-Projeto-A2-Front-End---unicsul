/**
 * Filtros compartilhados (Tendências, Recentes, Catálogo, Gêneros…): busca, ordenação, gêneros,
 * plataformas, controles aceitos e — no layout estendido do catálogo — tipo de projeto, status,
 * jogadores e demais características. Tudo combinável e espelhado na URL.
 *
 * A página é dona do `state` (`{ filters, sort, ... }`); os controles só o alteram e avisam `onChange()`.
 * Os chips vêm do catálogo carregado (contagens reais), então só podem ser montados depois de `loadCatalog()`.
 *
 * Duas formas de uso:
 *  - `mountFilterBar(host, state, opções)`: formulário horizontal completo (Tendências, Recentes).
 *  - `createFilterKit(state, opções)`: peças soltas (`search`, `sort`, `groups`, `foot`) que a página
 *    posiciona onde quiser — o catálogo põe busca e ordenação no cabeçalho e os grupos na sidebar.
 *
 * URL: mesmos parâmetros do catálogo (`q`, `genero`, `plataforma`, `controle`, `modo`, `nivel`, …) mais `ordem`.
 * Valores desconhecidos (link antigo/digitado) são descartados em vez de gerar "0 resultados" sem nenhum chip marcado.
 */
import { $$, el, debounce, icon, uid } from './utils.js';
import { getAll, getGenres, getPlatforms, getProjectTypes, DEV_STATUS } from './catalog.js';
import { createEmptyFilters, queryToFilters, filtersToQuery, applyFilters, countActiveFilters } from './filters.js';
import { mountSearchBox } from './search.js';

const CONTROL_CHIPS = Object.freeze([
    ['keyboard', 'Teclado'],
    ['mouse', 'Mouse'],
    ['gamepad', 'Controle'],
    ['touch', 'Toque'],
]);

/** Características booleanas do layout estendido: `chave do filtro` → rótulo. */
const PLAYER_FLAGS = Object.freeze([['single', 'Singleplayer'], ['multi', 'Multiplayer']]);
const OTHER_FLAGS = Object.freeze([['mobile', 'Compatível com celular'], ['save', 'Com suporte a salvamento'], ['issues', 'Com problemas conhecidos']]);

/** Listas com mais chips do que isto ganham "Ver mais" (gêneros/plataformas crescem com o catálogo). */
const COLLAPSE_AFTER = 10;

/**
 * Lê filtros e ordenação da URL para `state`. Retorna os parâmetros (a página lê os extras, ex.: `vista`, `pagina`).
 * `extended: false` (padrão) descarta os filtros que a barra horizontal não exibe, para não ficarem invisíveis.
 */
export function readFilterUrl(state, { sortOptions, defaultSort, extended = false }) {
    const params = new URLSearchParams(location.search);
    const f = queryToFilters(params);
    if (!extended) {
        f.types = [];
        f.statuses = [];
        f.single = f.multi = f.mobile = f.save = f.issues = f.inDevelopment = false;
        f.letter = '';
        f.controls.exclusive = false;
    }
    const genres = new Set(getGenres().map((g) => g.slug));
    const platforms = new Set(getPlatforms().map((p) => p.name));
    f.genres = f.genres.filter((slug) => genres.has(slug));
    f.platforms = f.platforms.filter((name) => platforms.has(name));
    state.filters = f;
    const sort = params.get('ordem');
    state.sort = sort && Object.hasOwn(sortOptions, sort) ? sort : defaultSort;
    return params;
}

/** Grava filtros e ordenação na URL (por padrão sem criar entradas no histórico; `push` cria uma). `extra` = parâmetros da página. */
export function writeFilterUrl(state, { defaultSort, push = false }, extra = {}) {
    const params = filtersToQuery(state.filters);
    if (state.sort !== defaultSort) params.set('ordem', state.sort);
    for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
    const qs = params.toString();
    history[push ? 'pushState' : 'replaceState'](null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}

const toggle = (list, value) => {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
    else list.push(value);
};

/** Quantos jogos do catálogo satisfazem sozinho um filtro (contagem exibida no chip). */
const countWith = (patch) => applyFilters(getAll(), { ...createEmptyFilters(), ...patch }).length;

/**
 * Peças de filtro ligadas a `state`. Cada método devolve um nó pronto para a página inserir.
 * Opções: `id` (prefixo dos ids), `sortOptions` ({ chave: rótulo }), `defaultSort`, `onChange`,
 * `blank()` (filtros "em branco" da página — ex.: com o gênero da página já marcado; usado por "Limpar filtros").
 * Chame `sync()` depois de mudar `state` por fora; `setScope(jogos)` restringe os chips de plataforma a esses jogos.
 */
export function createFilterKit(state, { id, sortOptions, defaultSort, onChange, blank = createEmptyFilters }) {
    const syncers = [];
    let applyScope = () => { };
    const changed = () => onChange?.();
    const pressed = (node, on) => node.setAttribute('aria-pressed', String(on));

    /* ---------- Busca ---------- */

    function search({ label = 'Pesquisar', placeholder, suggestions = false, onPick, onSubmit } = {}) {
        const qId = `${id}-q`;
        const input = el('input', { class: 'search-input__field', id: qId, type: 'search', name: 'q', placeholder, autocomplete: 'off', spellcheck: 'false', maxlength: '120' });
        const clearBtn = el('button', { class: 'search-input__clear', type: 'button', 'aria-label': 'Limpar pesquisa', hidden: true, dataset: { fb: 'clear-query' } }, icon('close', { size: 16 }));
        const panel = suggestions ? el('div', { class: 'suggest suggest--inline', hidden: true }) : null;
        const field = el('div', { class: 'field field--search' },
            el('label', { class: 'field__label', for: qId }, label),
            el('div', { class: 'search-input' }, icon('search', { size: 18 }), input, clearBtn),
            panel);

        const applyQuery = debounce(() => {
            state.filters.query = input.value.trim();
            changed();
        }, 220);
        input.addEventListener('input', () => {
            clearBtn.hidden = !input.value;
            applyQuery();
        });
        clearBtn.addEventListener('click', () => {
            applyQuery.cancel();
            input.value = '';
            clearBtn.hidden = true;
            state.filters.query = '';
            input.focus();
            changed();
        });

        const box = suggestions
            ? mountSearchBox({
                input,
                panel,
                clearBtn,
                getGames: getAll,
                onPick: (game) => onPick?.(game),
                onSubmit: (query) => {
                    applyQuery.cancel();
                    state.filters.query = query;
                    changed();
                    onSubmit?.(query);
                },
            })
            : null;

        syncers.push(() => {
            if (input.value.trim() !== state.filters.query) {
                input.value = state.filters.query;
                box?.close();
            }
            clearBtn.hidden = !input.value;
        });
        return field;
    }

    /* ---------- Ordenação ---------- */

    function sort({ label = 'Ordenar por' } = {}) {
        const sortId = `${id}-sort`;
        const select = el('select', { class: 'select', id: sortId, name: 'ordem' },
            Object.entries(sortOptions).map(([key, text]) => el('option', { value: key }, text)));
        select.addEventListener('change', () => {
            state.sort = Object.hasOwn(sortOptions, select.value) ? select.value : defaultSort;
            state.sortChosen = true;
            changed();
        });
        syncers.push(() => { select.value = state.sort; });
        return el('div', { class: 'field' }, el('label', { class: 'field__label', for: sortId }, label), select);
    }

    /* ---------- Grupos de filtro ---------- */

    /** `layout`: 'bar' (fieldsets lado a lado) ou 'accordion' (sidebar). `extended` liga os grupos do catálogo; `genres: false` omite o grupo de gêneros. */
    function groups({ layout = 'bar', extended = false, genres: withGenres = true } = {}) {
        const f = () => state.filters;
        const chip = (dataset, label, count, extra = '') =>
            el('button', { class: `chip${extra}`, type: 'button', 'aria-pressed': 'false', dataset },
                label, count === undefined ? null : el('span', { class: 'chip__count' }, String(count)));

        /** Chips com "Ver mais" quando a lista é longa. */
        function chipList(chips) {
            const box = el('div', { class: 'chips' }, chips);
            if (chips.length <= COLLAPSE_AFTER) return { node: box, expandIfHidden: () => { } };
            box.classList.add('chips--collapsible', 'is-collapsed');
            const more = el('button', { class: 'link-btn chips__more', type: 'button', 'aria-expanded': 'false' }, `Ver mais (${chips.length - COLLAPSE_AFTER})`);
            const setExpanded = (on) => {
                box.classList.toggle('is-collapsed', !on);
                more.setAttribute('aria-expanded', String(on));
                more.textContent = on ? 'Ver menos' : `Ver mais (${chips.length - COLLAPSE_AFTER})`;
            };
            more.addEventListener('click', () => setExpanded(box.classList.contains('is-collapsed')));
            const wrap = el('div', { class: 'chips-wrap' }, box, more);
            return {
                node: wrap,
                // Um chip marcado (vindo da URL) nunca fica escondido atrás do "Ver mais".
                expandIfHidden: () => {
                    if (box.classList.contains('is-collapsed') && chips.slice(COLLAPSE_AFTER).some((c) => c.getAttribute('aria-pressed') === 'true')) setExpanded(true);
                },
            };
        }

        const genres = chipList(getGenres().map((g) => chip({ genre: g.slug }, g.name, g.count)));

        // Plataformas: por padrão as do catálogo inteiro; com `setScope(jogos)` só as desses jogos, com a contagem deles
        // (o painel de um gênero não deve oferecer plataformas sem jogos naquele gênero nem somar o catálogo todo).
        const platformsHost = el('div', { class: 'chips-host' });
        let platforms = null;
        const platformCounts = (games) => {
            const counts = new Map();
            for (const game of games) counts.set(game.platform, (counts.get(game.platform) ?? 0) + 1);
            return [...counts.entries()]
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
        };
        const renderPlatforms = (games) => {
            const list = games ? platformCounts(games) : getPlatforms();
            platforms = chipList(list.map((p) => chip({ platform: p.name }, p.name, p.count)));
            platformsHost.replaceChildren(platforms.node);
        };
        renderPlatforms(null);
        applyScope = (games) => {
            renderPlatforms(games);
            syncers.forEach((fn) => fn());
        };
        const controlChips = el('div', { class: 'chips' }, CONTROL_CHIPS.map(([key, text]) =>
            el('button', { class: 'chip chip--icon', type: 'button', 'aria-pressed': 'false', dataset: { control: key } }, icon(key, { size: 16 }), text)));

        const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Como combinar os controles marcados' },
            el('button', { class: 'seg__btn', type: 'button', 'aria-pressed': 'true', dataset: { match: 'all' } }, 'Todos os marcados'),
            el('button', { class: 'seg__btn', type: 'button', 'aria-pressed': 'false', dataset: { match: 'any' } }, 'Qualquer um'));
        const requiredChip = el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', dataset: { level: 'required' } }, 'Só os obrigatórios');
        const exclusiveChip = extended
            ? el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', dataset: { exclusive: '1' } }, 'Somente os marcados')
            : null;
        const controlOptions = el('div', { class: 'filter-group__options', hidden: true }, seg, requiredChip, exclusiveChip);

        const section = (title, ...content) => {
            if (layout === 'accordion') {
                return el('details', { class: 'filter-acc', open: true },
                    el('summary', { class: 'filter-acc__title' }, title, icon('chevron-down', { size: 16 })),
                    el('div', { class: 'filter-acc__body' }, ...content));
            }
            return el('fieldset', { class: 'filter-group' }, el('legend', { class: 'filter-group__title' }, title), ...content);
        };

        const parts = [
            withGenres && section('Gêneros', genres.node),
            section('Plataformas de origem', platformsHost),
        ].filter(Boolean);

        if (extended) {
            const types = getProjectTypes().map((t) => chip({ type: t.key }, t.name, t.count));
            parts.push(section('Tipo de projeto', el('div', { class: 'chips' }, types)));
        }

        parts.push(section('Controles aceitos', controlChips, controlOptions,
            el('p', { class: 'filter-group__hint' }, 'Mostra apenas controles confirmados na ficha do jogo. “Não verificado” nunca é tratado como compatível.')));

        if (extended) {
            parts.push(
                section('Jogadores', el('div', { class: 'chips' }, PLAYER_FLAGS.map(([key, text]) => chip({ flag: key }, text, countWith({ [key]: true }))))),
                section('Características', el('div', { class: 'chips' }, OTHER_FLAGS.map(([key, text]) => chip({ flag: key }, text, countWith({ [key]: true }))))),
                section('Status de desenvolvimento', el('div', { class: 'chips' },
                    Object.entries(DEV_STATUS).map(([key, text]) => chip({ status: key }, text, countWith({ statuses: [key] }))))));
        }

        const root = el('div', { class: layout === 'accordion' ? 'filter-groups filter-groups--accordion' : 'filterbar__groups' }, parts);

        root.addEventListener('click', (event) => {
            const target = event.target.closest('button');
            if (!target || !root.contains(target)) return;
            const { genre, platform, control, match, level, exclusive, type, status, flag } = target.dataset;
            if (genre) toggle(f().genres, genre);
            else if (platform) toggle(f().platforms, platform);
            else if (type) toggle(f().types, type);
            else if (status) toggle(f().statuses, status);
            else if (flag) f()[flag] = !f()[flag];
            else if (control) toggle(f().controls.keys, control);
            else if (match) f().controls.match = match === 'any' ? 'any' : 'all';
            else if (level !== undefined) f().controls.level = f().controls.level === 'required' ? 'accepted' : 'required';
            else if (exclusive !== undefined) f().controls.exclusive = !f().controls.exclusive;
            else return; // botão "Ver mais" etc.
            changed();
        });

        syncers.push(() => {
            const cur = f();
            $$('[data-genre]', root).forEach((n) => pressed(n, cur.genres.includes(n.dataset.genre)));
            $$('[data-platform]', root).forEach((n) => pressed(n, cur.platforms.includes(n.dataset.platform)));
            $$('[data-type]', root).forEach((n) => pressed(n, cur.types.includes(n.dataset.type)));
            $$('[data-status]', root).forEach((n) => pressed(n, cur.statuses.includes(n.dataset.status)));
            $$('[data-flag]', root).forEach((n) => pressed(n, Boolean(cur[n.dataset.flag])));
            $$('[data-control]', root).forEach((n) => pressed(n, cur.controls.keys.includes(n.dataset.control)));
            $$('[data-match]', root).forEach((n) => pressed(n, n.dataset.match === cur.controls.match));
            pressed(requiredChip, cur.controls.level === 'required');
            if (exclusiveChip) pressed(exclusiveChip, cur.controls.exclusive);
            controlOptions.hidden = cur.controls.keys.length === 0;
            seg.hidden = cur.controls.keys.length < 2; // "todos × qualquer" só faz sentido com 2+ controles
            genres.expandIfHidden();
            platforms.expandIfHidden();
        });
        return root;
    }

    /* ---------- Rodapé: contagem + limpar ---------- */

    function foot({ countClass = 'result-count', live = true } = {}) {
        const count = el('p', { class: countClass, role: live ? 'status' : null, 'aria-live': live ? 'polite' : null });
        const clearBtn = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', hidden: true, dataset: { fb: 'clear-filters' } }, 'Limpar filtros');
        clearBtn.addEventListener('click', () => {
            state.filters = blank();
            changed();
        });
        syncers.push(() => { clearBtn.hidden = countActiveFilters(state.filters) <= countActiveFilters(blank()); });
        return { node: el('div', { class: 'filterbar__foot' }, count, clearBtn), setCount: (text) => { count.textContent = text; } };
    }

    return { search, sort, groups, foot, setScope: (games) => applyScope(games), sync: () => syncers.forEach((fn) => fn()), uid };
}

/**
 * Barra horizontal completa (busca + ordenação + gêneros/plataformas/controles + contagem).
 * Retorna `{ form, sync, setCount }` — chame `sync()` depois de mudar `state` por fora.
 */
export function mountFilterBar(host, state, { id, sortOptions, defaultSort, placeholder, ariaLabel, searchLabel = 'Pesquisar', onChange }) {
    const kit = createFilterKit(state, { id, sortOptions, defaultSort, onChange });
    const foot = kit.foot();
    const form = el('form', { class: 'filterbar', role: 'search', 'aria-label': ariaLabel, novalidate: true },
        el('div', { class: 'filterbar__row' }, kit.search({ label: searchLabel, placeholder }), kit.sort()),
        kit.groups({ layout: 'bar' }),
        foot.node);
    form.addEventListener('submit', (event) => event.preventDefault());
    host.replaceChildren(form);
    return { form, sync: kit.sync, setCount: foot.setCount };
}
