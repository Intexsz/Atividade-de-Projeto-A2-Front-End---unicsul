/**
 * Pesquisa: pontuação, destaque de termos e caixa de busca com sugestões (padrão combobox ARIA).
 * Pesquisa por nome, gêneros, tags, plataforma, autor, tipo de projeto e características
 * (controles aceitos, multiplayer, salvamento etc.).
 */
import { config } from '../config.js';
import { el, icon, normalizeText, debounce, clear, uid } from './utils.js';
import { PROJECT_TYPES, CONTROL_LABELS, CONTROL_KEYS, isAccepted } from './catalog.js';
import { coverSrc } from './cover.js';

/* ---------- Pontuação ---------- */

const cache = new WeakMap();

const CONTROL_ALIASES = { keyboard: 'teclado keyboard', mouse: 'mouse', gamepad: 'controle gamepad joystick', touch: 'toque touch celular mobile' };

function fieldsOf(game) {
    let f = cache.get(game);
    if (f) return f;
    const traits = [];
    for (const key of CONTROL_KEYS) if (isAccepted(game.controls[key])) traits.push(CONTROL_ALIASES[key], CONTROL_LABELS[key]);
    if (game.players.multi === 'yes') traits.push('multiplayer multijogador online');
    if (game.players.single === 'yes') traits.push('singleplayer individual solo');
    if (game.save.status === 'yes' || game.save.status === 'partial') traits.push('salvamento salvar');
    if (game.devices.mobile === 'yes') traits.push('mobile celular');
    const name = normalizeText(game.name);
    f = {
        name,
        nameWords: name.split(/[^a-z0-9]+/).filter(Boolean),
        genres: game.genres.map(normalizeText),
        tags: game.tags.map(normalizeText),
        platform: normalizeText(game.platform),
        developer: normalizeText(game.developer),
        type: normalizeText(PROJECT_TYPES[game.projectType]),
        traits: normalizeText(traits.join(' ')),
        description: normalizeText(game.shortDescription),
    };
    cache.set(game, f);
    return f;
}

export function parseQuery(query) {
    return [...new Set(normalizeText(query).split(/\s+/).filter(Boolean))];
}

function tokenScore(f, t) {
    let s = 0;
    if (f.name === t) s = 120;
    else if (f.name.startsWith(t)) s = 100;
    else if (f.nameWords.some((w) => w.startsWith(t))) s = 70;
    else if (f.name.includes(t)) s = 45;
    if (f.genres.includes(t)) s = Math.max(s, 40);
    else if (f.genres.some((g) => g.includes(t))) s = Math.max(s, 30);
    if (f.tags.includes(t)) s = Math.max(s, 35);
    else if (f.tags.some((g) => g.includes(t))) s = Math.max(s, 25);
    if (f.platform.includes(t)) s = Math.max(s, 20);
    if (f.traits.includes(t)) s = Math.max(s, 18);
    if (f.developer.includes(t)) s = Math.max(s, 12);
    if (f.type.includes(t)) s = Math.max(s, 10);
    if (f.description.includes(t)) s = Math.max(s, 5);
    return s;
}

/** 0 = sem correspondência. Todos os termos precisam casar (E). */
export function scoreGame(game, tokens) {
    if (!tokens.length) return 1;
    const f = fieldsOf(game);
    let total = 0;
    for (const token of tokens) {
        const s = tokenScore(f, token);
        if (!s) return 0;
        total += s;
    }
    return total;
}

export function searchGames(games, query, { limit = Infinity } = {}) {
    const tokens = parseQuery(query);
    if (!tokens.length) return [];
    return games
        .map((game) => ({ game, score: scoreGame(game, tokens) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.game.name.localeCompare(b.game.name, 'pt-BR'))
        .slice(0, limit);
}

/* ---------- Destaque dos termos (sem innerHTML) ---------- */

export function highlight(text, query) {
    const tokens = parseQuery(query);
    const frag = document.createDocumentFragment();
    if (!tokens.length) {
        frag.appendChild(document.createTextNode(text));
        return frag;
    }
    // Mapa normalizado -> índice original (a normalização remove acentos e pode mudar o tamanho).
    let normalized = '';
    const map = [];
    Array.from(text).forEach((ch, i) => {
        const n = normalizeText(ch);
        for (let k = 0; k < n.length; k++) map.push(i);
        normalized += n;
    });
    const chars = Array.from(text);
    const ranges = [];
    for (const token of tokens) {
        let from = 0;
        while (true) {
            const at = normalized.indexOf(token, from);
            if (at === -1) break;
            ranges.push([map[at], map[at + token.length - 1] + 1]);
            from = at + token.length;
        }
    }
    if (!ranges.length) {
        frag.appendChild(document.createTextNode(text));
        return frag;
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [ranges[0].slice()];
    for (const [s, e] of ranges.slice(1)) {
        const last = merged[merged.length - 1];
        if (s <= last[1]) last[1] = Math.max(last[1], e);
        else merged.push([s, e]);
    }
    let cursor = 0;
    for (const [s, e] of merged) {
        if (s > cursor) frag.appendChild(document.createTextNode(chars.slice(cursor, s).join('')));
        frag.appendChild(el('mark', { class: 'hl' }, chars.slice(s, e).join('')));
        cursor = e;
    }
    if (cursor < chars.length) frag.appendChild(document.createTextNode(chars.slice(cursor).join('')));
    return frag;
}

/* ---------- Caixa de busca com sugestões ---------- */

/**
 * @param {object} o
 * @param {HTMLInputElement} o.input
 * @param {HTMLElement} o.panel        contêiner das sugestões
 * @param {HTMLButtonElement} [o.clearBtn]
 * @param {() => Array} o.getGames
 * @param {(game) => void} o.onPick    usuário escolheu uma sugestão
 * @param {(query: string) => void} o.onSubmit  Enter sem sugestão ativa / "ver todos"
 */
export function mountSearchBox({ input, panel, clearBtn, getGames, onPick, onSubmit }) {
    const listId = uid('suggest');
    const list = el('ul', { class: 'suggest__list', role: 'listbox', id: listId, 'aria-label': 'Sugestões de jogos' });
    const status = el('p', { class: 'suggest__status', role: 'status' });
    panel.append(list, status);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', listId);
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');

    let results = [];
    let active = -1;
    let isOpen = false;

    const setOpen = (value) => {
        isOpen = value;
        panel.hidden = !value;
        input.setAttribute('aria-expanded', String(value));
        if (!value) {
            active = -1;
            input.removeAttribute('aria-activedescendant');
        }
    };

    const setActive = (index) => {
        const options = Array.from(list.children);
        options.forEach((o, i) => o.setAttribute('aria-selected', String(i === index)));
        active = index;
        if (index >= 0) {
            input.setAttribute('aria-activedescendant', options[index].id);
            options[index].scrollIntoView({ block: 'nearest' });
        } else input.removeAttribute('aria-activedescendant');
    };

    const render = () => {
        const query = input.value;
        clearBtn && (clearBtn.hidden = !query);
        clear(list);
        if (!normalizeText(query)) {
            status.textContent = '';
            setOpen(false);
            return;
        }
        const all = searchGames(getGames(), query);
        results = all.slice(0, config.search.maxSuggestions);
        if (!results.length) {
            status.textContent = `Nenhum jogo encontrado para “${query.trim()}”. Tente outro nome, gênero ou controle.`;
            status.hidden = false;
            setOpen(true);
            return;
        }
        status.hidden = true;
        status.textContent = `${all.length} ${all.length === 1 ? 'resultado' : 'resultados'}`;
        results.forEach(({ game }, i) => {
            const li = el(
                'li',
                { class: 'suggest__item', role: 'option', id: `${listId}-o${i}`, 'aria-selected': 'false', dataset: { index: i } },
                el('img', { class: 'suggest__thumb', src: coverSrc(game, 'thumb'), alt: '', width: 64, height: 36, loading: 'lazy' }),
                el('span', { class: 'suggest__text' },
                    el('span', { class: 'suggest__name' }, highlight(game.name, query)),
                    el('span', { class: 'suggest__meta' }, highlight([game.genres.join(' · '), game.platform].filter(Boolean).join(' · '), query))
                )
            );
            list.appendChild(li);
        });
        if (all.length > results.length) {
            list.appendChild(
                el('li', { class: 'suggest__item suggest__item--all', role: 'option', id: `${listId}-all`, 'aria-selected': 'false', dataset: { index: 'all' } },
                    el('span', { class: 'suggest__name' }, `Ver todos os ${all.length} resultados`),
                    icon('arrow-right', { size: 16 })
                )
            );
        }
        setOpen(true);
        setActive(-1);
    };

    const update = debounce(render, config.search.debounceMs);
    input.addEventListener('input', () => {
        clearBtn && (clearBtn.hidden = !input.value);
        update();
    });
    input.addEventListener('focus', () => input.value && render());
    input.addEventListener('keydown', (event) => {
        const count = list.children.length;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!isOpen) render();
            if (count) setActive((active + 1) % count);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (count) setActive(active <= 0 ? count - 1 : active - 1);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            update.cancel();
            const option = active >= 0 ? list.children[active] : null;
            if (option && option.dataset.index !== 'all') {
                pick(Number(option.dataset.index));
            } else if (input.value.trim()) {
                setOpen(false);
                onSubmit(input.value.trim());
            }
        } else if (event.key === 'Escape') {
            // 1º Esc fecha só as sugestões; o 2º fecha o <dialog> que contém o campo (se houver).
            // preventDefault evita o "limpar" nativo do <input type="search"> no Chrome, que consumiria a tecla;
            // limpar o texto é função do botão "limpar".
            event.preventDefault();
            if (isOpen) {
                event.stopPropagation();
                setOpen(false);
            } else {
                input.closest('dialog')?.close();
            }
        }
    });

    const pick = (index) => {
        const entry = results[index];
        if (!entry) return;
        setOpen(false);
        onPick(entry.game);
    };

    list.addEventListener('mousedown', (e) => e.preventDefault()); // mantém o foco no input
    list.addEventListener('click', (event) => {
        const item = event.target.closest('.suggest__item');
        if (!item) return;
        if (item.dataset.index === 'all') {
            setOpen(false);
            onSubmit(input.value.trim());
        } else pick(Number(item.dataset.index));
    });

    clearBtn?.addEventListener('click', () => {
        input.value = '';
        render();
        input.focus();
    });

    document.addEventListener('pointerdown', (event) => {
        if (isOpen && !panel.contains(event.target) && event.target !== input && !clearBtn?.contains(event.target)) setOpen(false);
    });

    setOpen(false);
    return { close: () => setOpen(false), render, focus: () => input.focus(), clear: () => { input.value = ''; render(); } };
}
