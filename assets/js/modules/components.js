/**
 * Componentes de interface compartilhados entre as páginas.
 * Tudo é construído com `el()` (createElement/textContent) — nenhum innerHTML com dados externos.
 *
 * Ações globais (event delegation, ver `initGlobalActions`) — atributo `data-action`:
 *   open-game · toggle-fav · play · open-search · open-library · open-privacy · random-game · close-dialog
 */
import { config } from '../config.js';
import { el, icon, $, $$, clear, formatDate, hostOf, daysSince, pluralize, prefersReducedMotion, trapFocus } from './utils.js';
import {
    loadCatalog, getAll, getById, getBySlug, getGenres, getRandom, CatalogError,
    CONTROL_KEYS, CONTROL_LABELS, CONTROL_STATE_LABELS, PROJECT_TYPES, DEV_STATUS, SAVE_LABELS,
    PLAYER_LABELS, DEVICE_LABELS, LINK_STATUS_LABELS, isAccepted,
} from './catalog.js';
import { coverSrc, coverSize } from './cover.js';
import {
    getFavorites, isFavorite, toggleFavorite, removeFavorite, clearFavorites,
    getHistory, addHistory, removeHistoryEntry, clearHistory,
} from './favorites.js';
import { metrics } from './metrics.js';
import { getPrefs, setPrefs, clearAll, isPersistent } from './storage.js';
import { mountSearchBox, highlight } from './search.js';
import { getCurrentUser } from './auth.js';

/* =========================================================================
   Pequenos utilitários de interface
   ========================================================================= */

/** Substitui <span data-icon="nome" data-size="16"> pelo ícone do sprite. */
export function hydrateIcons(root = document) {
    $$('[data-icon]', root).forEach((node) => {
        node.replaceWith(icon(node.dataset.icon, { size: Number(node.dataset.size) || 20, className: node.dataset.class || '' }));
    });
}

export function formatDots(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : '';
}

export function toast(message, { kind = 'info', timeout = 3800 } = {}) {
    let host = document.getElementById('toasts');
    if (!host) {
        host = el('div', { class: 'toasts', id: 'toasts' });
        document.body.appendChild(host);
    }
    const node = el(
        'div',
        { class: `toast toast--${kind}`, role: kind === 'error' ? 'alert' : 'status' },
        icon(kind === 'error' ? 'info' : 'check', { size: 18 }),
        el('span', { class: 'toast__text' }, message)
    );
    host.appendChild(node);
    const remove = () => {
        node.classList.add('is-leaving');
        setTimeout(() => node.remove(), prefersReducedMotion() ? 0 : 220);
    };
    const timer = setTimeout(remove, timeout);
    node.addEventListener('click', () => {
        clearTimeout(timer);
        remove();
    });
    while (host.children.length > 3) host.firstElementChild.remove();
}

/** Botão de confirmação em duas etapas (evita apagar dados sem querer). */
export function twoStepButton(button, { label, confirmLabel, onConfirm }) {
    let armed = false;
    let timer = 0;
    const textNode = () => $('.btn__text', button) ?? button;
    const reset = () => {
        armed = false;
        button.classList.remove('is-armed');
        textNode().textContent = label;
    };
    textNode().textContent = label;
    button.addEventListener('click', () => {
        if (!armed) {
            armed = true;
            button.classList.add('is-armed');
            textNode().textContent = confirmLabel;
            timer = setTimeout(reset, 4500);
            return;
        }
        clearTimeout(timer);
        reset();
        onConfirm();
    });
    button.addEventListener('blur', () => {
        clearTimeout(timer);
        reset();
    });
}

/* =========================================================================
   Selos, controles e cards
   ========================================================================= */

/** Selo de novidade calculado a partir das datas reais do catálogo. */
export function freshness(game, now = Date.now(), { preferUpdate = false } = {}) {
    const f = config.freshness;
    const added = daysSince(game.dateAdded, now);
    const updated = daysSince(game.dateUpdated, now);
    // `short` é a forma compacta usada em cards estreitos (ver container query em components.css).
    // `preferUpdate`: na visão "atualizados" (Recentes) a atualização real vem antes do selo de inclusão.
    if (preferUpdate && updated <= f.updatedDays && updated < added) return { key: 'updated', label: 'ATUALIZADO', short: 'ATUALIZADO' };
    if (added <= f.justAddedDays) return { key: 'just-added', label: 'RECÉM-ADICIONADO', short: 'RECENTE' };
    if (added <= f.newDays) return { key: 'new', label: 'NOVO', short: 'NOVO' };
    if (updated <= f.updatedDays && updated < added) return { key: 'updated', label: 'ATUALIZADO', short: 'ATUALIZADO' };
    return null;
}

/** Selo de novidade com texto completo e compacto; o CSS escolhe um conforme a largura do card. */
function freshBadge(fresh) {
    return el('span', { class: `badge badge--fresh fresh--${fresh.key}` },
        el('span', { class: 'badge__full' }, fresh.label),
        el('span', { class: 'badge__short' }, fresh.short)
    );
}

/** Indicadores de controles: obrigatório / compatível / não verificado / não suporta. */
export function controlIndicators(game, { labels = false } = {}) {
    const list = el('ul', { class: `ctrl${labels ? ' ctrl--labeled' : ''}`, 'aria-label': 'Controles' });
    for (const key of CONTROL_KEYS) {
        const state = game.controls[key];
        const text = `${CONTROL_LABELS[key]}: ${CONTROL_STATE_LABELS[state]}`;
        list.appendChild(
            el('li', { class: `ctrl__item ctrl__item--${state}`, dataset: { tip: text } },
                icon(key, { size: 16 }),
                el('span', { class: 'ctrl__label' }, CONTROL_LABELS[key]),
                el('span', { class: 'sr-only' }, `: ${CONTROL_STATE_LABELS[state]}`)
            )
        );
    }
    return list;
}

export function badge(text, kind = 'genre') {
    return el('span', { class: `badge badge--${kind}` }, text);
}

/**
 * Card de jogo. `variant`: poster (3:4) | wide (16:9) | row (lista com miniatura).
 * Toda a área abre a ficha; favoritar permanece independente.
 */
export function createGameCard(game, { variant = 'poster', rank = null, badge: showFresh = false, showDate = false, dateField = 'dateAdded', preferUpdate = false, now = Date.now(), eager = false, query = '' } = {}) {
    const coverVariant = variant === 'row' ? 'thumb' : variant === 'wide' ? 'wide' : 'poster';
    const [w, h] = coverSize(coverVariant);
    const fresh = showFresh ? freshness(game, now, { preferUpdate }) : null;
    const dots = showDate ? formatDots(game[dateField]) : '';

    const img = el('img', {
        class: 'card__img',
        src: coverSrc(game, coverVariant),
        alt: game.cover.type === 'image' ? `Capa de ${game.name}` : '',
        width: w,
        height: h,
        loading: eager ? 'eager' : 'lazy',
        decoding: 'async',
    });

    const top = el('div', { class: 'card__top' },
        el('div', { class: 'card__tags' },
            dots && el('span', { class: 'pill-date' }, dots),
            fresh && freshBadge(fresh)
        )
    );

    const title = el('h3', { class: 'card__title' },
        el('button', { class: 'card__open', type: 'button', 'aria-haspopup': 'dialog', dataset: { action: 'open-game', id: game.id } }, query ? highlight(game.name, query) : game.name)
    );

    const meta = el('p', { class: 'card__meta' }, game.genres.slice(0, 2).join(' · ') || 'Gênero não informado');
    const fav = favButton(game);

    // Pílula de plataforma sobre a capa (no UI kit de referência é a pílula de preço).
    const body = el('div', { class: 'card__body' }, el('span', { class: 'card__pill' }, game.platform), title, meta, controlIndicators(game));

    // Painel de hover/foco: o texto e o CTA também abrem a ficha.
    const reveal = variant === 'poster'
        ? el('div', { class: 'card__reveal' },
            el('p', { class: 'card__reveal-title' }, 'Sobre o jogo'),
            el('p', { class: 'card__reveal-text' }, game.shortDescription || 'Descrição não informada.'),
            el('button', {
                class: 'card__reveal-cta',
                type: 'button',
                'aria-haspopup': 'dialog',
                dataset: { action: 'open-game', id: game.id },
            }, 'Ver ficha'))
        : null;

    const card = el('article', { class: `card card--${variant}`, dataset: { id: game.id } },
        el('div', { class: 'card__media' }, img),
        variant !== 'row' && top,
        rank !== null && el('span', { class: 'card__rank', 'aria-label': `Posição ${rank}` }, String(rank).padStart(2, '0')),
        body,
        reveal,
        fav
    );
    card.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-action="toggle-fav"], [data-action="open-game"]')) return;
        const host = card.closest('dialog');
        if (host && host.id !== 'game-dialog') host.close();
        openGame(game.id);
    });
    return card;
}

export function favButton(game) {
    const active = isFavorite(game.id);
    return el('button', {
        class: 'fav', type: 'button', dataset: { action: 'toggle-fav', id: game.id },
        'aria-pressed': active, 'aria-label': `Favoritar ${game.name}`,
    }, icon('heart', { size: 18 }));
}

export function skeletonCards(count = 4, variant = 'poster') {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) frag.appendChild(el('div', { class: `card card--${variant} card--skeleton`, 'aria-hidden': 'true' }));
    return frag;
}

/**
 * Grade padrão de cards (`.grid-cards`). `options` vai para createGameCard; pode ser uma função (game, índice) => opções.
 * Retorna o elemento da grade, já inserido em `container` (que é esvaziado antes).
 */
export function renderGameGrid(container, games, options = {}) {
    const grid = el('div', { class: 'grid-cards' },
        games.map((game, index) => createGameCard(game, typeof options === 'function' ? options(game, index) : options))
    );
    clear(container).appendChild(grid);
    return grid;
}

export function sectionHead({ id, eyebrow, title, desc, href, hrefLabel }) {
    return el('header', { class: 'section-head' },
        el('div', { class: 'section-head__text' },
            eyebrow && el('p', { class: 'eyebrow' }, eyebrow),
            el('h2', { class: 'title-hud', id }, title),
            desc && el('p', { class: 'section-head__desc' }, desc)
        ),
        href && el('a', { class: 'btn btn--ghost btn--sm', href }, hrefLabel ?? 'Ver tudo', icon('arrow-right', { size: 16 }))
    );
}

export function renderEmpty(container, { title, text, actions = [], iconName = 'search' }) {
    clear(container);
    container.appendChild(
        el('div', { class: 'state state--empty', role: 'status' },
            el('span', { class: 'state__icon' }, icon(iconName, { size: 28 })),
            el('h3', { class: 'state__title' }, title),
            text && el('p', { class: 'state__text' }, text),
            actions.length > 0 && el('div', { class: 'state__actions' }, actions)
        )
    );
}

export function renderError(container, error, retry) {
    clear(container);
    const message = error instanceof CatalogError ? error.userMessage : 'Algo deu errado ao carregar esta seção.';
    if (!(error instanceof CatalogError)) console.error('[Projeto Fênix]', error);
    container.appendChild(
        el('div', { class: 'state state--error', role: 'alert' },
            el('span', { class: 'state__icon' }, icon('info', { size: 28 })),
            el('h3', { class: 'state__title' }, 'Não foi possível carregar o conteúdo'),
            el('p', { class: 'state__text' }, message),
            retry && el('div', { class: 'state__actions' }, el('button', { class: 'btn btn--secondary', type: 'button', onclick: retry }, 'Tentar novamente'))
        )
    );
}

/** Carrossel horizontal com rolagem por snap e botões (aparecem só quando há overflow). */
export function createRail(children, { label }) {
    const track = el('div', { class: 'rail__track', role: 'group', 'aria-label': label }, children);
    const prev = el('button', { class: 'rail__btn rail__btn--prev', type: 'button', 'aria-label': `${label}: anterior` }, icon('arrow-left', { size: 20 }));
    const next = el('button', { class: 'rail__btn rail__btn--next', type: 'button', 'aria-label': `${label}: próximo` }, icon('arrow-right', { size: 20 }));
    const wrap = el('div', { class: 'rail' }, prev, track, next);
    const update = () => {
        const overflow = track.scrollWidth - track.clientWidth > 6;
        wrap.classList.toggle('is-static', !overflow);
        prev.disabled = track.scrollLeft <= 4;
        next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    const go = (dir) => track.scrollBy({ left: dir * Math.max(240, track.clientWidth * 0.85), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', update, { passive: true });
    if (typeof ResizeObserver === 'function') new ResizeObserver(update).observe(track);
    requestAnimationFrame(update);
    return wrap;
}

/* =========================================================================
   Diálogos nativos (<dialog>) — foco, ESC e rolagem tratados pelo navegador
   ========================================================================= */

function ensureDialog(id, className, onClose) {
    let dialog = document.getElementById(id);
    if (dialog) return dialog;
    dialog = el('dialog', { id, class: `dialog ${className}` });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close(); // clique no fundo
    });
    dialog.addEventListener('keydown', (event) => trapFocus(dialog, event)); // Tab dá a volta dentro do diálogo
    if (onClose) dialog.addEventListener('close', onClose);
    document.body.appendChild(dialog);
    return dialog;
}

const closeButton = (label = 'Fechar') =>
    el('button', { class: 'icon-btn dialog__close', type: 'button', 'aria-label': label, dataset: { action: 'close-dialog' } }, icon('close', { size: 20 }));

/* =========================================================================
   Header e footer
   ========================================================================= */

let headerRoot = null;

function authTrigger() {
    const user = getCurrentUser();
    const safeAvatar = typeof user?.avatar === 'string' && /^https:\/\//i.test(user.avatar) ? user.avatar : '';
    const avatar = safeAvatar
        ? el('img', { class: 'auth-trigger__avatar', src: safeAvatar, alt: '', referrerpolicy: 'no-referrer' })
        : user
            ? el('span', { class: 'auth-trigger__initial', 'aria-hidden': 'true' }, (user.name || user.email || 'F').trim().charAt(0).toLocaleUpperCase('pt-BR'))
            : icon('user', { size: 19 });
    return el('a', {
        class: `auth-trigger${user ? ' auth-trigger--signed-in' : ''}`,
        href: 'login.html',
        'aria-label': user ? `Minha conta: ${user.name || user.email}` : 'Entrar',
        title: user ? `Minha conta: ${user.name || user.email}` : 'Entrar',
    }, avatar, !user && el('span', { class: 'auth-trigger__label' }, 'Entrar'));
}

function syncAuthTrigger() {
    const current = headerRoot && $('.auth-trigger', headerRoot);
    if (current) current.replaceWith(authTrigger());
}

export function renderHeader(root, page) {
    headerRoot = root;
    clear(root);

    const navItems = config.nav.map((item) =>
        el('li', null, el('a', { class: 'nav__link', href: item.href, 'aria-current': item.id === page ? 'page' : null }, item.label))
    );
    navItems.push(
        el('li', null,
            el('a', { class: 'nav__link dino-nav-link', href: 'dino.html', 'aria-label': 'Jogar Corrida Fênix', title: 'Jogar Corrida Fênix' },
                el('img', { src: 'assets/images/dino/trex-icon.png', alt: '', width: 32, height: 34 })
            )
        )
    );
    const mobileItems = config.nav.map((item) =>
        el('li', null, el('a', { class: 'mobile-nav__link', href: item.href, 'aria-current': item.id === page ? 'page' : null }, item.label))
    );
    mobileItems.push(
        el('li', null, el('a', { class: 'mobile-nav__link', href: 'dino.html' }, 'Jogo do dinossauro'))
    );

    const toggle = el('button', {
        class: 'icon-btn nav-toggle', type: 'button', 'aria-expanded': false, 'aria-controls': 'mobile-nav', 'aria-label': 'Abrir menu',
    }, icon('menu', { size: 22 }));

    const mobileNav = el('div', { class: 'mobile-nav', id: 'mobile-nav', hidden: true },
        el('nav', { 'aria-label': 'Principal (menu do celular)' }, el('ul', { class: 'mobile-nav__list' }, mobileItems)),
        el('div', { class: 'mobile-nav__extra' },
            el('button', { class: 'btn btn--secondary btn--sm', type: 'button', dataset: { action: 'random-game' } }, icon('shuffle', { size: 16 }), 'Jogo aleatório'),
            el('button', { class: 'btn btn--ghost btn--sm', type: 'button', dataset: { action: 'open-privacy' } }, icon('shield', { size: 16 }), 'Privacidade')
        )
    );

    const setMenu = (open) => {
        mobileNav.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
        clear(toggle).appendChild(icon(open ? 'close' : 'menu', { size: 22 }));
        root.classList.toggle('is-menu-open', open);
    };
    toggle.addEventListener('click', () => setMenu(mobileNav.hidden));
    mobileNav.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) setMenu(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !mobileNav.hidden) {
            setMenu(false);
            toggle.focus();
        }
    });
    matchMedia('(min-width: 1100px)').addEventListener?.('change', (e) => e.matches && setMenu(false));

    root.append(
        el('div', { class: 'site-header__inner container-wide' },
            el('a', { class: 'brand', href: 'index.html', 'aria-label': `${config.name} — página inicial` },
                el('img', { class: 'brand__logo', src: 'assets/icons/Projeto Fênix.svg', alt: '', width: 150, height: 58 })
            ),
            el('nav', { class: 'nav', 'aria-label': 'Principal' }, el('ul', { class: 'nav__list' }, navItems)),
            el('div', { class: 'site-header__actions' },
                el('button', { class: 'search-trigger', type: 'button', 'aria-label': 'Pesquisar jogos', 'aria-keyshortcuts': '/', dataset: { action: 'open-search' } },
                    icon('search', { size: 18 }),
                    el('span', { class: 'search-trigger__text' }, 'Pesquisar jogos…'),
                    el('kbd', { class: 'kbd', 'aria-hidden': 'true' }, '/')
                ),
                el('button', { class: 'icon-btn library-btn', type: 'button', 'aria-label': 'Meus jogos: favoritos e histórico', 'aria-haspopup': 'dialog', dataset: { action: 'open-library' } },
                    icon('heart', { size: 22 }),
                    el('span', { class: 'count', id: 'fav-count', hidden: true })
                ),
                authTrigger(),
                toggle
            )
        ),
        mobileNav
    );

    window.addEventListener('projeto-fenix:auth-changed', syncAuthTrigger);
    window.addEventListener('storage', syncAuthTrigger);

    const onScroll = () => root.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    updateFavCount();
}

export function updateFavCount() {
    const count = getFavorites().length;
    const node = document.getElementById('fav-count');
    if (node) {
        node.textContent = String(count);
        node.hidden = count === 0;
    }
    const btn = $('.library-btn');
    if (btn) btn.setAttribute('aria-label', count ? `Meus jogos: ${count} ${pluralize(count, 'favorito', 'favoritos')} e histórico` : 'Meus jogos: favoritos e histórico');
}

export function renderFooter(root) {
    clear(root);
    const col = (title, ...children) => el('div', { class: 'footer__col' }, el('h2', { class: 'footer__title' }, title), ...children);
    const contact = config.contact.email
        ? el('a', { href: `mailto:${config.contact.email}` }, config.contact.email)
        : null;
    const socialItems = [
        ['YouTube', 'youtube.svg'],
        ['Facebook', 'facebook.svg'],
        ['Instagram', 'instagram.svg'],
        ['TikTok', 'tiktok.svg'],
        ['X', 'x-social.svg'],
    ];

    root.append(
        el('div', { class: 'footer__inner container-wide' },
            el('div', { class: 'footer__grid' },
                el('div', { class: 'footer__col footer__col--brand' },
                    el('a', { class: 'brand', href: 'index.html', 'aria-label': `${config.name} — página inicial` },
                        el('img', { class: 'brand__logo', src: 'assets/icons/Projeto Fênix.svg', alt: '', width: 150, height: 58 })
                    ),
                    el('p', { class: 'footer__about' }, config.description)
                ),
                col('Navegar', el('ul', { class: 'footer__links' }, config.nav.map((item) => el('li', null, el('a', { href: item.href }, item.label))))),
                col('Projeto',
                    el('ul', { class: 'footer__links' },
                        el('li', null, el('button', { class: 'link-btn', type: 'button', dataset: { action: 'open-privacy' } }, 'Privacidade e preferências')),
                        el('li', null, el('button', { class: 'link-btn', type: 'button', dataset: { action: 'open-library' } }, 'Meus jogos')),
                        el('li', null, el('button', { class: 'link-btn', type: 'button', dataset: { action: 'random-game' } }, 'Jogo aleatório'))
                    )
                ),
                col('Nossas redes sociais',
                    el('ul', { class: 'footer__socials', 'aria-label': 'Redes sociais' }, socialItems.map(([name, file]) =>
                        el('li', null, el('span', { class: 'footer__social', role: 'img', 'aria-label': name, title: name },
                            el('img', { src: `assets/icons/${file}`, alt: '', width: 24, height: 24, loading: 'lazy' })
                        ))
                    )),
                    contact && el('p', { class: 'footer__text' }, contact)
                )
            ),
            el('div', { class: 'footer__legal' },
                el('p', null, `${config.name} é um diretório independente de jogos para navegador: não hospeda jogos nem arquivos, e leva você ao endereço do projeto original. Nomes e marcas pertencem aos seus respectivos titulares, sem afiliação oficial.`),
                el('p', null, `© ${new Date().getFullYear()} ${config.name}. Sem cookies, sem rastreadores, sem anúncios.`)
            )
        )
    );
}

/* =========================================================================
   Pesquisa (overlay)
   ========================================================================= */

let searchUi = null;

export async function openSearch() {
    const dialog = ensureDialog('search-dialog', 'dialog--search');
    if (!searchUi) {
        const input = el('input', {
            class: 'search-field__input', type: 'search', placeholder: 'Nome, gênero, plataforma ou controle…',
            'aria-label': 'Pesquisar jogos', maxlength: 80, enterkeyhint: 'search',
        });
        const clearBtn = el('button', { class: 'icon-btn icon-btn--sm', type: 'button', 'aria-label': 'Limpar pesquisa', hidden: true }, icon('close', { size: 16 }));
        const panel = el('div', { class: 'suggest', hidden: true });
        const chips = el('div', { class: 'chips', 'aria-label': 'Atalhos de pesquisa' });
        const hint = el('div', { class: 'search-hint' },
            el('p', { class: 'search-hint__text' }, 'Pesquise por nome, gênero, plataforma, tags ou características (ex.: teclado, multiplayer).'),
            chips
        );
        dialog.append(
            el('div', { class: 'search-dialog' },
                el('div', { class: 'search-field' }, icon('search', { size: 20 }), input, clearBtn, closeButton('Fechar pesquisa')),
                panel,
                hint
            )
        );
        const go = (q) => {
            location.href = `todos-os-jogos.html?q=${encodeURIComponent(q)}`;
        };
        searchUi = mountSearchBox({
            input, panel, clearBtn,
            getGames: getAll,
            onPick: (game) => {
                dialog.close();
                openGame(game.id);
            },
            onSubmit: go,
        });
        input.addEventListener('input', () => {
            hint.hidden = Boolean(input.value.trim());
        });
        searchUi.refs = { input, hint, chips };
    }
    const { input, hint, chips } = searchUi.refs;
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    try {
        await loadCatalog();
        if (!chips.childElementCount) {
            const words = getGenres().slice(0, 4).map((g) => g.name);
            if (getAll().some((g) => g.players.multi === 'yes')) words.push('multiplayer');
            words.forEach((word) =>
                chips.appendChild(el('button', {
                    class: 'chip', type: 'button', onclick: () => {
                        input.value = word;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.focus();
                    }
                }, word))
            );
        }
        if (input.value.trim()) searchUi.render();
    } catch (error) {
        hint.hidden = false;
        clear(hint).appendChild(el('p', { class: 'search-hint__text search-hint__text--error', role: 'alert' }, error instanceof CatalogError ? error.userMessage : 'Não foi possível carregar o catálogo.'));
    }
}

/* =========================================================================
   Ficha do jogo (modal)
   ========================================================================= */

const stateText = (map, key) => map[key] ?? 'Não informado';

function metaRow(label, value) {
    return el('div', { class: 'meta__row' }, el('dt', null, label), el('dd', null, value));
}

function controlsSummary(game) {
    const groups = { required: [], supported: [], unverified: [], unsupported: [] };
    for (const key of CONTROL_KEYS) groups[game.controls[key]].push(CONTROL_LABELS[key]);
    const section = el('div', { class: 'controls-box' },
        el('h3', { class: 'sheet__h' }, 'Controles'),
        controlIndicators(game, { labels: true })
    );
    const rows = el('dl', { class: 'controls-groups' });
    for (const [key, label] of [['required', 'Obrigatório'], ['supported', 'Compatível (opcional)'], ['unverified', 'Não verificado'], ['unsupported', 'Não suporta']]) {
        if (groups[key].length) rows.appendChild(el('div', { class: `controls-groups__row controls-groups__row--${key}` }, el('dt', null, label), el('dd', null, groups[key].join(', '))));
    }
    section.appendChild(rows);
    section.appendChild(el('p', { class: 'sheet__note' }, game.controlsSource || 'Fonte das informações de controles não informada.'));
    if (groups.unverified.length) {
        section.appendChild(el('p', { class: 'sheet__note' }, '“Não verificado” significa que ainda não encontramos fonte confiável — não indica incompatibilidade.'));
    }
    return section;
}

function buildSheet(game) {
    const favActive = isFavorite(game.id);
    const [pw, ph] = coverSize('poster');
    const [ww, wh] = coverSize('wide');
    const host = game.playUrl ? hostOf(game.playUrl) : '';

    const playLink = game.playUrl
        ? el('a', { class: 'btn btn--primary btn--lg', href: game.playUrl, target: '_blank', rel: 'noopener noreferrer', dataset: { action: 'play', id: game.id } }, 'JOGAR AGORA', icon('external', { size: 18 }))
        : el('span', { class: 'btn btn--disabled btn--lg', 'aria-disabled': 'true' }, 'Endereço indisponível');

    const favBtn = el('button', {
        class: 'btn btn--secondary btn--lg fav-btn', type: 'button', dataset: { action: 'toggle-fav', id: game.id }, 'aria-pressed': favActive,
    }, icon('heart', { size: 18 }), el('span', { class: 'fav-btn__text' }, favActive ? 'Nos favoritos' : 'Favoritar'));

    const description = game.description.split(/\n{2,}/).filter(Boolean).map((p) => el('p', null, p));
    const devices = [`Computador: ${stateText(DEVICE_LABELS, game.devices.desktop)}`, `Celular: ${stateText(DEVICE_LABELS, game.devices.mobile)}`].join(' · ');

    const sourcesList = game.sources.length
        ? el('ul', { class: 'sources' }, game.sources.map((s) => el('li', null, el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.label, icon('external', { size: 12 })))))
        : el('p', { class: 'sheet__note' }, 'Nenhuma fonte registrada.');

    return el('div', { class: 'sheet' },
        closeButton('Fechar ficha do jogo'),
        el('div', { class: 'sheet__media' },
            el('img', { class: 'sheet__img sheet__img--poster', src: coverSrc(game, 'poster'), alt: game.cover.type === 'image' ? `Capa de ${game.name}` : '', width: pw, height: ph, decoding: 'async' }),
            el('img', { class: 'sheet__img sheet__img--wide', src: coverSrc(game, 'wide'), alt: '', width: ww, height: wh, decoding: 'async' }),
            el('span', { class: 'sheet__media-glow', 'aria-hidden': 'true' })
        ),
        el('div', { class: 'sheet__content' },
            el('p', { class: 'eyebrow' }, `${PROJECT_TYPES[game.projectType]} · ${game.platform}`),
            el('h2', { class: 'sheet__title', id: 'game-dialog-title' }, game.name),
            el('div', { class: 'sheet__badges' }, game.genres.map((g) => badge(g, 'genre')), (() => { const f = freshness(game); return f ? badge(f.label, `fresh fresh--${f.key}`) : null; })()),
            el('div', { class: 'sheet__desc' }, description),
            game.notices.map((n) => el('p', { class: 'callout callout--info' }, icon('info', { size: 18 }), el('span', null, n))),
            controlsSummary(game),
            el('dl', { class: 'meta' },
                metaRow('Plataforma de origem', game.platform),
                metaRow('Tipo de projeto', PROJECT_TYPES[game.projectType]),
                metaRow('Autor / desenvolvedor', game.developer),
                metaRow('Lançamento', game.releaseYear ? String(game.releaseYear) : 'Não informado'),
                metaRow('Situação', game.developmentNote ? `${stateText(DEV_STATUS, game.developmentStatus)} — ${game.developmentNote}` : stateText(DEV_STATUS, game.developmentStatus)),
                metaRow('Salvamento', game.save.note ? `${stateText(SAVE_LABELS, game.save.status)} — ${game.save.note}` : stateText(SAVE_LABELS, game.save.status)),
                metaRow('Jogadores', `Individual: ${stateText(PLAYER_LABELS, game.players.single)} · Multiplayer: ${stateText(PLAYER_LABELS, game.players.multi)}${game.players.note ? ` (${game.players.note})` : ''}`),
                metaRow('Dispositivos', game.devices.note ? `${devices} — ${game.devices.note}` : devices),
                metaRow('Idiomas', game.languages.length ? game.languages.join(', ') : game.languagesNote || 'Não informado'),
                metaRow('Licença', game.license.name ? (game.license.url ? el('a', { href: game.license.url, target: '_blank', rel: 'noopener noreferrer' }, game.license.name) : game.license.name) : 'Não informada'),
                metaRow('Adicionado ao Projeto Fênix', formatDate(game.dateAdded)),
                metaRow('Última atualização da ficha', formatDate(game.dateUpdated))
            ),
            game.tags.length > 0 && el('div', { class: 'sheet__block' }, el('h3', { class: 'sheet__h' }, 'Tags'), el('ul', { class: 'tags' }, game.tags.map((t) => el('li', { class: 'tag' }, t)))),
            game.knownIssues.length > 0 && el('div', { class: 'callout callout--warn' }, icon('info', { size: 18 }),
                el('div', null, el('h3', { class: 'sheet__h' }, 'Problemas conhecidos'), el('ul', null, game.knownIssues.map((i) => el('li', null, i))))),
            el('div', { class: 'sheet__block' },
                el('h3', { class: 'sheet__h' }, 'Fontes e créditos'),
                sourcesList,
                el('p', { class: 'sheet__note' }, `${stateText(LINK_STATUS_LABELS, game.linkCheck.status)}${game.linkCheck.date ? ` em ${formatDate(game.linkCheck.date, true)}` : ''}${game.linkCheck.method ? `. ${game.linkCheck.method}` : '.'}`),
                game.coverCredit && el('p', { class: 'sheet__note' }, `Capa: ${game.coverCredit}`)
            ),
            el('div', { class: 'sheet__cta' },
                el('div', { class: 'sheet__cta-buttons' }, playLink, favBtn),
                host && el('p', { class: 'sheet__note sheet__note--cta' }, icon('external', { size: 14 }), `Abre ${host} em uma nova aba. É um site de terceiros, com política de privacidade e termos próprios.`)
            )
        )
    );
}

function clearGameHash() {
    if (location.hash.startsWith('#jogo=')) history.replaceState(null, '', `${location.pathname}${location.search}`);
}

export async function openGame(id, { updateHash = true } = {}) {
    try {
        await loadCatalog();
    } catch (error) {
        toast(error instanceof CatalogError ? error.userMessage : 'Não foi possível carregar o catálogo.', { kind: 'error' });
        return;
    }
    const game = getById(id);
    if (!game) {
        toast('Jogo não encontrado no catálogo.', { kind: 'error' });
        return;
    }
    const dialog = ensureDialog('game-dialog', 'dialog--sheet', clearGameHash);
    dialog.setAttribute('aria-labelledby', 'game-dialog-title');
    clear(dialog).appendChild(buildSheet(game));
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    if (updateHash) history.replaceState(null, '', `${location.pathname}${location.search}#jogo=${game.slug}`);
}

export async function openRandomGame() {
    try {
        await loadCatalog();
    } catch (error) {
        toast(error instanceof CatalogError ? error.userMessage : 'Não foi possível carregar o catálogo.', { kind: 'error' });
        return;
    }
    const current = $('#game-dialog[open] .sheet') ? location.hash.replace('#jogo=', '') : null;
    const currentGame = current ? getBySlug(current) : null;
    const game = getRandom(currentGame?.id);
    if (!game) {
        toast('O catálogo ainda está vazio.', { kind: 'error' });
        return;
    }
    openGame(game.id);
}

/* =========================================================================
   Meus jogos: favoritos e histórico
   ========================================================================= */

let libraryTab = 'favoritos';

function libraryItem(game, kind, at) {
    return el('li', { class: 'lib-item' },
        el('button', { class: 'lib-item__main', type: 'button', dataset: { action: 'open-game', id: game.id } },
            el('img', { class: 'lib-item__thumb', src: coverSrc(game, 'thumb'), alt: '', width: 96, height: 54, loading: 'lazy' }),
            el('span', { class: 'lib-item__text' },
                el('span', { class: 'lib-item__name' }, game.name),
                el('span', { class: 'lib-item__meta' }, kind === 'hist' && at ? `Acessado em ${formatDate(at, true)}` : [game.genres[0], game.platform].filter(Boolean).join(' · '))
            )
        ),
        el('button', { class: 'icon-btn icon-btn--sm', type: 'button', 'aria-label': `${kind === 'fav' ? 'Remover dos favoritos' : 'Remover do histórico'}: ${game.name}`, dataset: { action: 'lib-remove', kind, id: game.id } }, icon('trash', { size: 16 }))
    );
}

function renderLibrary() {
    const dialog = document.getElementById('library-dialog');
    if (!dialog) return;
    const favs = getFavorites().map(getById).filter(Boolean);
    const hist = getHistory().map((h) => ({ game: getById(h.id), at: h.at })).filter((h) => h.game);
    const tabs = [['favoritos', `Favoritos (${favs.length})`], ['historico', `Histórico (${hist.length})`]];

    const tablist = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Meus jogos' },
        tabs.map(([key, label]) => el('button', {
            class: 'tabs__tab', role: 'tab', type: 'button', id: `lib-tab-${key}`, 'aria-selected': libraryTab === key, 'aria-controls': 'lib-panel', tabindex: libraryTab === key ? 0 : -1,
            onclick: () => { libraryTab = key; renderLibrary(); $(`#lib-tab-${key}`)?.focus(); },
            onkeydown: (e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                libraryTab = key === 'favoritos' ? 'historico' : 'favoritos';
                renderLibrary();
                $(`#lib-tab-${libraryTab}`)?.focus();
            },
        }, label))
    );

    const panel = el('div', { class: 'lib-panel', id: 'lib-panel', role: 'tabpanel', 'aria-labelledby': `lib-tab-${libraryTab}` });
    const footer = el('div', { class: 'lib-footer' });

    if (libraryTab === 'favoritos') {
        if (!favs.length) {
            renderEmpty(panel, { title: 'Nenhum favorito ainda', text: 'Toque no coração de um card ou da ficha do jogo para guardá-lo aqui. Fica salvo somente neste navegador.', iconName: 'heart' });
        } else {
            panel.appendChild(el('ul', { class: 'lib-list' }, favs.map((g) => libraryItem(g, 'fav'))));
            const btn = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, icon('trash', { size: 16 }), el('span', { class: 'btn__text' }));
            twoStepButton(btn, { label: 'Limpar favoritos', confirmLabel: 'Confirmar limpeza', onConfirm: () => { clearFavorites(); toast('Favoritos removidos.'); } });
            footer.appendChild(btn);
        }
    } else if (!hist.length) {
        renderEmpty(panel, {
            title: 'Histórico vazio',
            text: getPrefs().recordHistory ? 'Os jogos que você abrir pelo botão JOGAR AGORA aparecem aqui, só neste dispositivo.' : 'O registro de histórico está desativado em Privacidade e preferências.',
            iconName: 'history',
        });
    } else {
        panel.appendChild(el('ul', { class: 'lib-list' }, hist.map((h) => libraryItem(h.game, 'hist', h.at))));
        const btn = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, icon('trash', { size: 16 }), el('span', { class: 'btn__text' }));
        twoStepButton(btn, { label: 'Limpar histórico', confirmLabel: 'Confirmar limpeza', onConfirm: () => { clearHistory(); toast('Histórico limpo.'); } });
        footer.appendChild(btn);
    }

    clear(dialog).appendChild(
        el('div', { class: 'drawer' },
            el('header', { class: 'drawer__head' }, el('h2', { class: 'drawer__title', id: 'library-dialog-title' }, 'Meus jogos'), closeButton('Fechar meus jogos')),
            tablist, panel, footer,
            el('p', { class: 'sheet__note drawer__note' }, 'Favoritos e histórico ficam apenas neste navegador. Nada é enviado a servidores.')
        )
    );
}

export async function openLibrary(tab) {
    if (tab) libraryTab = tab;
    const dialog = ensureDialog('library-dialog', 'dialog--drawer');
    dialog.setAttribute('aria-labelledby', 'library-dialog-title');
    try {
        await loadCatalog();
    } catch {
        /* mostra o que for possível; itens sem catálogo são omitidos */
    }
    renderLibrary();
    if (!dialog.open) dialog.showModal();
}

/* =========================================================================
   Privacidade e preferências
   ========================================================================= */

function policySection(title, paragraphs = [], items = []) {
    return el('section', { class: 'policy__section' },
        el('h3', { class: 'policy__h' }, title),
        paragraphs.map((p) => el('p', null, p)),
        items.length > 0 && el('ul', null, items.map((i) => el('li', null, i)))
    );
}

export function openPrivacy() {
    const dialog = ensureDialog('privacy-dialog', 'dialog--sheet dialog--policy');
    dialog.setAttribute('aria-labelledby', 'privacy-dialog-title');
    const prefs = getPrefs();
    const controller = config.legal.controllerName
        ? `${config.legal.controllerName}${config.legal.controllerContact ? ` — ${config.legal.controllerContact}` : ''}`
        : 'As informações do controlador e do canal de contato serão publicadas antes do lançamento oficial do site.';

    const recordToggle = el('input', { type: 'checkbox', class: 'switch__input', id: 'pref-history', checked: prefs.recordHistory });
    recordToggle.addEventListener('change', () => {
        setPrefs({ recordHistory: recordToggle.checked });
        toast(recordToggle.checked ? 'Registro de histórico ativado.' : 'Registro de histórico desativado.');
    });
    const motion = el('select', { class: 'select', id: 'pref-motion' },
        [['auto', 'Automático (seguir o sistema)'], ['on', 'Sempre ativados'], ['off', 'Desativados']].map(([v, t]) => el('option', { value: v, selected: prefs.motion === v }, t))
    );
    motion.addEventListener('change', () => setPrefs({ motion: motion.value }));

    const action = (label, onConfirm, doneMessage) => {
        const btn = el('button', { class: 'btn btn--secondary btn--sm', type: 'button' }, icon('trash', { size: 16 }), el('span', { class: 'btn__text' }));
        twoStepButton(btn, { label, confirmLabel: 'Confirmar', onConfirm: () => { onConfirm(); toast(doneMessage); } });
        return btn;
    };

    clear(dialog).appendChild(
        el('div', { class: 'sheet sheet--single' },
            closeButton('Fechar privacidade e preferências'),
            el('div', { class: 'sheet__content policy' },
                el('p', { class: 'eyebrow' }, 'Versão de demonstração · atualizada em 14/11/2026'),
                el('h2', { class: 'sheet__title', id: 'privacy-dialog-title' }, 'Privacidade e preferências'),
                el('p', { class: 'callout callout--info' }, icon('info', { size: 18 }), el('span', null, `O catálogo pode ser usado sem conta. O cadastro de demonstração é opcional e fica somente neste navegador.`)),

                el('section', { class: 'policy__section policy__prefs' },
                    el('h3', { class: 'policy__h' }, 'Suas preferências'),
                    el('label', { class: 'switch', for: 'pref-history' }, recordToggle, el('span', { class: 'switch__track', 'aria-hidden': 'true' }), el('span', { class: 'switch__label' }, 'Registrar histórico dos jogos que eu abrir')),
                    el('div', { class: 'field' }, el('label', { for: 'pref-motion', class: 'field__label' }, 'Animações e partículas de fundo'), motion),
                    el('div', { class: 'policy__actions' },
                        action('Limpar favoritos', clearFavorites, 'Favoritos removidos.'),
                        action('Limpar histórico', clearHistory, 'Histórico limpo.'),
                        action('Zerar acessos locais', () => metrics.reset(), 'Contagem de acessos zerada.'),
                        action('Apagar todos os dados do Projeto Fênix', () => { clearAll(); updateFavCount(); window.dispatchEvent(new CustomEvent('projeto-fenix:auth-changed')); window.dispatchEvent(new CustomEvent('projeto-fenix:favorites-changed', { detail: { id: null, active: false } })); window.dispatchEvent(new CustomEvent('projeto-fenix:history-changed')); window.dispatchEvent(new CustomEvent('projeto-fenix:prefs-changed')); dialog.close(); }, 'Todos os dados locais foram apagados.')
                    )
                ),

                policySection('O que guardamos e onde', [
                    'Favoritos, histórico, contagem de acessos, preferências e a conta de demonstração ficam no armazenamento local (localStorage) do navegador. Não são enviados para um servidor.',
                    isPersistent() ? 'O armazenamento local está disponível neste navegador.' : 'O armazenamento local está indisponível neste navegador (por exemplo, modo privado): seus dados duram apenas enquanto a aba estiver aberta.',
                ], [
                    'projeto-fenix:v1:favorites — jogos favoritados.',
                    'projeto-fenix:v1:history — jogos abertos recentemente (até 50, com data e hora).',
                    'projeto-fenix:v1:access — quantas vezes você abriu cada jogo, neste dispositivo (total, data do último acesso e contagem por dia dos últimos 60 dias, usada no comparativo “em alta”).',
                    'projeto-fenix:v1:prefs — suas preferências desta janela.',
                    'projeto-fenix:v1:auth:users — nome, e-mail e hash com salt da senha; não guarda a senha em texto puro.',
                    'projeto-fenix:v1:auth:session — sessão local da conta neste navegador.',
                ]),
                policySection('Popularidade local', ['As seções “mais populares” e “mais acessados” usam somente os acessos registrados neste dispositivo. Não são estatísticas globais.']),
                policySection('Cookies e serviços externos', [
                    `O ${config.name} não usa cookies, analytics, publicidade nem rastreadores. As fontes tipográficas são servidas pelo próprio site e nenhum serviço externo é incorporado às páginas.`,
                    'Se algum dia houver uma tecnologia não essencial, ela só será ativada com o seu consentimento prévio e a recusa será respeitada, sem prejuízo ao uso do portal.',
                ]),
                policySection('Jogos em sites de terceiros', [
                    'Ao escolher JOGAR AGORA, o projeto abre em outra aba, no endereço do autor. Esse site é de terceiros e pode usar cookies e coletar dados conforme a política dele. Antes do clique, a ficha do jogo mostra o endereço de destino.',
                    'O Projeto Fênix é independente e não possui afiliação oficial com os titulares dos jogos e franquias citados.',
                ]),
                policySection('Hospedagem', ['Quando o site for publicado, o serviço de hospedagem escolhido poderá registrar logs técnicos de acesso (como endereço IP). Esse serviço e sua política serão identificados aqui na publicação.']),
                policySection('Seus direitos (LGPD)', [
                    'Conforme a Lei nº 13.709/2018, você pode confirmar, acessar, corrigir e eliminar dados pessoais. Como os dados do Projeto Fênix ficam só no seu navegador, você exerce esse controle diretamente pelos botões acima ou pelas configurações do próprio navegador.',
                    controller,
                ])
            )
        )
    );
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
}

/* =========================================================================
   Ações globais, atalhos e deep links
   ========================================================================= */

export function syncFavButtons(root = document) {
    const favs = new Set(getFavorites());
    $$('[data-action="toggle-fav"]', root).forEach((btn) => {
        const active = favs.has(btn.dataset.id);
        btn.setAttribute('aria-pressed', String(active));
        const text = $('.fav-btn__text', btn);
        if (text) text.textContent = active ? 'Nos favoritos' : 'Favoritar';
    });
}

function handleHash() {
    const hash = decodeURIComponent(location.hash);
    if (hash.startsWith('#jogo=')) {
        loadCatalog().then(() => {
            const game = getBySlug(hash.slice(6));
            if (game) openGame(game.id, { updateHash: false });
        }).catch(() => { });
    }
}

export function initGlobalActions() {
    document.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;
        const { action, id } = target.dataset;
        switch (action) {
            case 'open-game': {
                const host = target.closest('dialog');
                if (host && host.id !== 'game-dialog') host.close();
                openGame(id);
                break;
            }
            case 'toggle-fav': {
                if (!getCurrentUser()) {
                    const returnTo = `${location.pathname}${location.search}${location.hash}`;
                    const login = new URL('login.html', location.href);
                    login.searchParams.set('return', returnTo);
                    login.searchParams.set('reason', 'favorite');
                    location.assign(login.href);
                    break;
                }
                event.preventDefault();
                const game = getById(id);
                const nowActive = toggleFavorite(id);
                toast(nowActive ? `${game?.name ?? 'Jogo'} adicionado aos favoritos.` : `${game?.name ?? 'Jogo'} removido dos favoritos.`);
                break;
            }
            case 'play':
                metrics.recordAccess(id);
                addHistory(id);
                break;
            case 'open-search': openSearch(); break;
            case 'open-library': openLibrary(); break;
            case 'open-privacy': {
                const host = target.closest('dialog');
                if (host) host.close();
                openPrivacy();
                break;
            }
            case 'random-game': openRandomGame(); break;
            case 'close-dialog': target.closest('dialog')?.close(); break;
            case 'lib-remove':
                if (target.dataset.kind === 'fav') removeFavorite(id);
                else removeHistoryEntry(id);
                break;
            default: break;
        }
    });

    // Clique com o botão do meio / ctrl+clique em JOGAR AGORA também conta como acesso.
    document.addEventListener('auxclick', (event) => {
        const target = event.target.closest('[data-action="play"]');
        if (target && event.button === 1) {
            metrics.recordAccess(target.dataset.id);
            addHistory(target.dataset.id);
        }
    });

    window.addEventListener('projeto-fenix:favorites-changed', () => {
        updateFavCount();
        syncFavButtons();
        if ($('#library-dialog[open]')) renderLibrary();
    });
    window.addEventListener('projeto-fenix:history-changed', () => $('#library-dialog[open]') && renderLibrary());
    window.addEventListener('storage', () => {
        updateFavCount();
        syncFavButtons();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
        const t = event.target;
        if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        // Com um diálogo aberto — ou com o painel de filtros do catálogo aberto como gaveta (resto da página inerte) — o atalho não age.
        if (document.querySelector('dialog[open]') || document.documentElement.classList.contains('is-scroll-locked')) return;
        event.preventDefault();
        openSearch();
    });

    window.addEventListener('hashchange', handleHash);
    handleHash();
}
