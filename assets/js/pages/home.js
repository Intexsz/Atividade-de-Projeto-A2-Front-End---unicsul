/**
 * Página inicial (index.html). O conteúdo é montado a partir do catálogo central (data/games.json).
 */
import { $, el, icon, clear, pluralize, hostOf } from '../modules/utils.js';
import {
    loadCatalog, getAll, getFeatured, getRecent, getPopular, getGenres, getPlatforms,
    getWithControl, getForMobile, getStats, getRandom, getById, PROJECT_TYPES,
} from '../modules/catalog.js';
import {
    createGameCard, createRail, renderEmpty, renderError, skeletonCards,
    controlIndicators, badge, freshness,
} from '../modules/components.js';
import { coverSrc, coverSize } from '../modules/cover.js';
import { getHistory } from '../modules/favorites.js';
import { motionEnabled } from '../modules/particles.js';
import { config } from '../config.js';

const slot = (name) => $(`[data-slot="${name}"]`);
const SLOTS_AFTER_HERO = ['explorer', 'popular', 'recent', 'genres', 'platforms', 'gamepad', 'mobile', 'spotlight'];

/* ---------- Auxiliares ---------- */

function playLink(game, className) {
    if (!game.playUrl) return el('span', { class: `${className} btn--disabled`, 'aria-disabled': 'true' }, 'Endereço indisponível');
    return el('a', {
        class: className, href: game.playUrl, target: '_blank', rel: 'noopener noreferrer', dataset: { action: 'play', id: game.id },
    }, 'JOGAR AGORA', icon('external', { size: 18 }));
}

const openButton = (game, className, label = 'Ver ficha') =>
    el('button', { class: className, type: 'button', 'aria-haspopup': 'dialog', dataset: { action: 'open-game', id: game.id } }, label);

function rowSkeleton(container) {
    clear(container).appendChild(el('div', { class: 'row-skeleton', 'aria-hidden': 'true' }, skeletonCards(6)));
}

function gameRail(container, games, label, cardOptions = () => ({})) {
    clear(container).appendChild(createRail(games.map((game, index) => createGameCard(game, cardOptions(game, index))), { label }));
}

/* ---------- Hero ---------- */

function renderHero(games) {
    const stage = slot('hero-stage');
    const hero = $('#hero');
    hero.querySelector('.hero-strip')?.remove();
    clear(stage);

    const slides = games.slice(0, config.hero.maxSlides);
    if (!slides.length) {
        renderEmpty(stage, { title: 'O catálogo ainda está vazio', text: 'Cadastre jogos em data/games.json para vê-los em destaque aqui.' });
        return;
    }
    const total = slides.length;
    const stats = getStats();
    let index = 0;
    let timer = 0;
    let userPaused = false;
    let hovering = false;

    const bgs = slides.map((game, i) => el('img', {
        class: `hero__bg${i === 0 ? ' is-active' : ''}`, src: coverSrc(game, 'banner'), alt: '', width: 1920, height: 820,
        loading: i === 0 ? 'eager' : 'lazy', decoding: 'async',
    }));
    const ghost = el('span', { class: 'hero__ghost', 'aria-hidden': 'true' });
    const info = el('div', { class: 'hero__info' });

    const pauseBtn = el('button', { class: 'circle-btn', type: 'button' });
    const prevBtn = el('button', { class: 'circle-btn', type: 'button', 'aria-label': 'Destaque anterior' }, icon('arrow-left', { size: 20 }));
    const nextBtn = el('button', { class: 'circle-btn', type: 'button', 'aria-label': 'Próximo destaque' }, icon('arrow-right', { size: 20 }));
    const dots = slides.map((game, i) => el('button', { class: 'hero__dot', type: 'button', 'aria-label': `Destaque ${i + 1} de ${total}: ${game.name}`, onclick: () => go(i) }));

    const controls = el('div', { class: 'hero__controls' }, prevBtn, el('div', { class: 'hero__dots' }, dots), nextBtn, pauseBtn);
    if (total < 2) controls.hidden = true;

    const content = el('div', { class: 'hero__content' },
        el('h1', { class: 'hero__kicker' }, 'Jogos para jogar no navegador'),
        info,
        controls
    );

    stage.append(
        ...bgs,
        el('div', { class: 'hero__bars', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4].map(() => el('span'))),
        ghost,
        el('div', { class: 'container-wide hero__layout' }, content),
        el('ul', { class: 'hero__stats', 'aria-label': 'Números do catálogo' },
            [[stats.total, pluralize(stats.total, 'jogo', 'jogos')], [stats.genres, pluralize(stats.genres, 'gênero', 'gêneros')], [stats.platforms, pluralize(stats.platforms, 'plataforma', 'plataformas')]]
                .map(([n, label]) => el('li', { class: 'hero__stat' }, el('b', null, String(n)), el('span', null, label)))
        )
    );
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-roledescription', 'carrossel');
    stage.setAttribute('aria-label', 'Jogos em destaque');

    const strip = el('div', { class: 'hero-strip', style: { '--n': String(total), '--hero-ms': `${config.hero.autoplayMs}ms` } });
    const stripItems = slides.map((game, i) => {
        const [w, h] = coverSize('thumb');
        return el('button', { class: 'strip__item', type: 'button', 'aria-label': `Destacar ${game.name}`, onclick: () => go(i) },
            el('img', { class: 'strip__img', src: coverSrc(game, 'thumb'), alt: '', width: w, height: h, loading: 'lazy', decoding: 'async' }),
            el('span', { class: 'strip__label' }, game.name),
            el('span', { class: 'strip__bar', 'aria-hidden': 'true' })
        );
    });
    strip.append(...stripItems);
    if (total > 1) hero.appendChild(strip);

    function fillInfo(game) {
        const fresh = freshness(game);
        ghost.textContent = game.name.split(/\s+/)[0];
        clear(info).append(
            el('p', { class: 'eyebrow hero__eyebrow' }, `${PROJECT_TYPES[game.projectType]} · ${game.platform}`),
            el('h2', { class: 'hero__title' }, game.name),
            el('p', { class: 'hero__desc' }, game.editorial.pitch || game.shortDescription),
            el('div', { class: 'hero__tags' },
                game.genres.map((g) => badge(g, 'genre')),
                fresh && badge(fresh.label, `fresh fresh--${fresh.key}`),
                game.tags.slice(0, 3).map((t) => el('span', { class: 'tag' }, t))
            ),
            el('div', { class: 'hero__actions' },
                playLink(game, 'btn btn--primary btn--lg'),
                el('a', { class: 'btn btn--secondary btn--lg', href: 'todos-os-jogos.html' }, 'EXPLORAR JOGOS'),
                openButton(game, 'link-btn')
            ),
            game.playUrl && el('p', { class: 'hero__note' }, icon('external', { size: 14 }), `Abre ${hostOf(game.playUrl)} em uma nova aba (site de terceiros).`)
        );
    }

    const canPlay = () => total > 1 && !userPaused && !hovering && motionEnabled() && !document.hidden;

    function syncPauseButton() {
        const motion = motionEnabled();
        pauseBtn.hidden = !motion || total < 2;
        const label = userPaused ? 'Retomar rotação automática' : 'Pausar rotação automática';
        pauseBtn.setAttribute('aria-label', label);
        clear(pauseBtn).appendChild(icon(userPaused ? 'play' : 'pause', { size: 18 }));
        // Durante a rotação automática o leitor de tela não é interrompido; fora dela, anuncia a troca.
        info.setAttribute('aria-live', motion && !userPaused && total > 1 ? 'off' : 'polite');
    }

    function schedule() {
        clearTimeout(timer);
        strip.classList.remove('is-playing');
        syncPauseButton();
        if (!canPlay()) return;
        void strip.offsetWidth; // reinicia a animação da barra de progresso
        strip.classList.add('is-playing');
        timer = setTimeout(() => go(index + 1), config.hero.autoplayMs);
    }

    function go(next) {
        const n = (next + total) % total;
        if (n !== index) {
            index = n;
            bgs.forEach((img, i) => img.classList.toggle('is-active', i === index));
            stripItems.forEach((item, i) => (i === index ? item.setAttribute('aria-current', 'true') : item.removeAttribute('aria-current')));
            dots.forEach((dot, i) => (i === index ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current')));
            info.classList.add('is-changing');
            setTimeout(() => {
                fillInfo(slides[index]);
                info.classList.remove('is-changing');
            }, motionEnabled() ? 220 : 0);
        }
        schedule(); // interação manual reinicia o temporizador, mas não altera a pausa escolhida
    }

    prevBtn.addEventListener('click', () => go(index - 1));
    nextBtn.addEventListener('click', () => go(index + 1));
    pauseBtn.addEventListener('click', () => {
        userPaused = !userPaused;
        schedule();
    });
    stage.addEventListener('mouseenter', () => { hovering = true; schedule(); });
    stage.addEventListener('mouseleave', () => { hovering = false; schedule(); });
    stage.addEventListener('focusin', () => { hovering = true; schedule(); });
    stage.addEventListener('focusout', (event) => { if (!stage.contains(event.relatedTarget)) { hovering = false; schedule(); } });
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('projeto-fenix:prefs-changed', schedule);

    stripItems[0].setAttribute('aria-current', 'true');
    dots[0].setAttribute('aria-current', 'true');
    fillInfo(slides[0]);
    schedule();
}

/* ---------- Jogos em destaque (Game Explorer) ---------- */

function renderExplorer(games) {
    const root = slot('explorer');
    const navSlot = slot('explorer-nav');
    clear(navSlot);
    if (!games.length) {
        renderEmpty(root, { title: 'Nenhum jogo em destaque', text: 'Marque jogos como destaque em data/games.json (editorial.featured).' });
        return;
    }
    const total = games.length;
    let index = 0;
    const counter = el('span', { class: 'explorer-nav__count', 'aria-live': 'polite' });

    const draw = () => {
        const game = games[index];
        const neighbours = [1, 2].map((offset) => games[(index + offset) % total]).filter((g, i, arr) => g.id !== game.id && arr.findIndex((x) => x.id === g.id) === i);
        const [pw, ph] = coverSize('wide');
        counter.textContent = `${index + 1} / ${total}`;
        clear(root).append(
            el('div', { class: 'explorer__poster' }, createGameCard(game, { variant: 'poster', badge: true, eager: true })),
            el('div', { class: 'explorer__panel' },
                el('img', { class: 'explorer__panel-bg', src: coverSrc(game, 'wide'), alt: '', width: pw, height: ph, loading: 'lazy', decoding: 'async' }),
                el('p', { class: 'explorer__year' }, [game.releaseYear, PROJECT_TYPES[game.projectType]].filter(Boolean).join(' · ')),
                el('h3', { class: 'explorer__title' }, game.name),
                el('p', { class: 'explorer__desc' }, game.shortDescription),
                el('div', { class: 'explorer__chips' }, [...game.genres, game.platform, ...game.tags.slice(0, 3)].map((t) => el('span', { class: 'chip' }, t))),
                controlIndicators(game, { labels: true }),
                el('div', { class: 'explorer__actions' }, openButton(game, 'btn btn--primary', 'Ver ficha'), playLink(game, 'btn btn--secondary'))
            ),
            neighbours.length > 0 && el('div', { class: 'explorer__side' }, neighbours.map((g) => el('div', { class: 'explorer__poster' }, createGameCard(g, { variant: 'wide', badge: true }))))
        );
    };

    if (total > 1) {
        const step = (dir) => { index = (index + dir + total) % total; draw(); };
        navSlot.append(
            el('button', { class: 'circle-btn', type: 'button', 'aria-label': 'Jogo em destaque anterior', onclick: () => step(-1) }, icon('arrow-left', { size: 20 })),
            counter,
            el('button', { class: 'circle-btn', type: 'button', 'aria-label': 'Próximo jogo em destaque', onclick: () => step(1) }, icon('arrow-right', { size: 20 }))
        );
    }
    draw();
}

/* ---------- Seções em carrossel ---------- */

function renderContinue() {
    const section = $('#continue');
    const games = getHistory().map((h) => getById(h.id)).filter(Boolean).slice(0, 10);
    section.hidden = games.length === 0;
    if (games.length) gameRail(slot('continue'), games, 'Continue jogando');
}

function renderPopular() {
    const { items, basis, rankedCount } = getPopular(8);
    const note = slot('popular-note');
    clear(note).append(
        icon('info', { size: 14 }),
        basis === 'local'
            ? 'Popularidade local: baseada nos acessos registrados neste dispositivo, não em estatísticas globais.'
            : 'Seleção editorial por enquanto: ainda não há acessos registrados neste dispositivo. Ao usar o botão JOGAR AGORA, seu ranking local passa a aparecer aqui.'
    );
    gameRail(slot('popular'), items, 'Mais populares', (game, i) => ({ rank: basis === 'local' && i < rankedCount ? i + 1 : null, badge: true }));
}

function renderRecent() {
    gameRail(slot('recent'), getRecent(8), 'Adicionados recentemente', () => ({ badge: true, showDate: true }));
}

function renderControlSections() {
    const pad = getWithControl('gamepad');
    const gamepadSlot = slot('gamepad');
    if (pad.length) {
        gameRail(gamepadSlot, pad, 'Jogos com suporte a controle', () => ({ badge: true }));
    } else {
        renderEmpty(gamepadSlot, {
            title: 'Nenhum jogo com suporte a controle confirmado ainda',
            text: 'O Projeto Fênix só lista aqui jogos cuja ficha ou fonte confiável confirma o suporte a controle (gamepad). “Não verificado” não é tratado como compatível, e o suporte da API Gamepad do navegador não conta como prova.',
            iconName: 'info',
        });
    }

    const mobile = getForMobile();
    const mobileSlot = slot('mobile');
    if (mobile.length) {
        gameRail(mobileSlot, mobile, 'Jogos para celular', () => ({ badge: true }));
    } else {
        renderEmpty(mobileSlot, { title: 'Nenhum jogo com compatibilidade para celular confirmada', text: 'Quando uma ficha confirmar toque ou suporte a celular, o jogo aparece aqui.', iconName: 'info' });
    }
}

/* ---------- Gêneros e plataformas ---------- */

function genreCard(genre) {
    const [w, h] = coverSize('wide');
    const src = coverSrc({ slug: genre.slug, cover: { type: 'image', src: `assets/images/genres/${genre.slug}.svg`, motif: genre.motif, seed: `genero-${genre.slug}` } }, 'wide');
    return el('a', { class: 'genre-card', href: `generos.html?genero=${encodeURIComponent(genre.slug)}` },
        el('img', { class: 'genre-card__img', src, alt: '', width: w, height: h, loading: 'lazy', decoding: 'async' }),
        el('span', { class: 'genre-card__count' }, `${genre.count} ${pluralize(genre.count, 'jogo', 'jogos')}`),
        el('span', { class: 'genre-card__arrow', 'aria-hidden': 'true' }, icon('arrow-right', { size: 18 })),
        el('h3', { class: 'genre-card__name' }, genre.name),
        el('p', { class: 'genre-card__desc' }, genre.description)
    );
}

function renderGenres() {
    const genres = getGenres();
    const container = slot('genres');
    if (!genres.length) return renderEmpty(container, { title: 'Nenhum gênero cadastrado', text: 'Os gêneros aparecem automaticamente conforme os jogos são cadastrados.' });
    clear(container).appendChild(el('div', { class: 'genre-grid' }, genres.map(genreCard)));
}

function renderPlatforms() {
    const platforms = getPlatforms();
    const container = slot('platforms');
    if (!platforms.length) return renderEmpty(container, { title: 'Nenhuma plataforma cadastrada' });
    clear(container).appendChild(
        el('div', { class: 'platform-grid' }, platforms.map((p) =>
            el('a', { class: 'platform-card', href: `todos-os-jogos.html?plataforma=${encodeURIComponent(p.name)}` },
                el('span', { class: 'platform-card__icon' }, icon('layers', { size: 22 })),
                el('span', { class: 'platform-card__text' },
                    el('span', { class: 'platform-card__name' }, p.name),
                    el('span', { class: 'platform-card__count' }, `${p.count} ${pluralize(p.count, 'jogo', 'jogos')}`)
                )
            )
        ))
    );
}

/* ---------- Spotlight (jogo aleatório) ---------- */

function renderSpotlight(excludeId = null, { focusShuffle = false } = {}) {
    const root = slot('spotlight');
    const game = getRandom(excludeId);
    if (!game) return renderEmpty(root, { title: 'O catálogo ainda está vazio' });
    const [w, h] = coverSize('wide');
    const shuffle = el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => renderSpotlight(game.id, { focusShuffle: true }) }, icon('shuffle', { size: 18 }), 'Sortear outro');
    if (getAll().length < 2) shuffle.hidden = true;

    clear(root).append(
        el('div', { class: 'spotlight' },
            el('div', { class: 'spotlight__media' },
                el('img', { class: 'spotlight__img', src: coverSrc(game, 'wide'), alt: '', width: w, height: h, loading: 'lazy', decoding: 'async' }),
                el('p', { class: 'spotlight__vertical', 'aria-hidden': 'true' }, el('span', null, 'Descubra'), ' um jogo'),
                el('button', { class: 'spotlight__play', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': `Abrir a ficha de ${game.name}`, dataset: { action: 'open-game', id: game.id } }, icon('play', { size: 30 }))
            ),
            el('div', { class: 'spotlight__body' },
                el('p', { class: 'eyebrow' }, 'Sorteio do catálogo'),
                el('h2', { class: 'title-hud', id: 'spotlight-title' }, 'Jogo aleatório'),
                el('p', { class: 'spotlight__name' }, game.name),
                el('hr', { class: 'spotlight__rule' }),
                el('p', { class: 'spotlight__desc' }, game.shortDescription),
                el('div', { class: 'explorer__chips' }, [...game.genres, game.platform].map((t) => el('span', { class: 'chip' }, t))),
                controlIndicators(game, { labels: true }),
                el('div', { class: 'spotlight__actions' }, playLink(game, 'btn btn--primary btn--lg'), openButton(game, 'btn btn--secondary btn--lg'), shuffle),
                el('p', { class: 'sr-only', role: 'status' }, `Jogo sorteado: ${game.name}`)
            )
        )
    );
    if (focusShuffle) $('.spotlight__actions .btn--ghost', root)?.focus();
}

/* ---------- Inicialização ---------- */

function showCatalogError(error) {
    SLOTS_AFTER_HERO.forEach((name) => slot(name)?.closest('section')?.setAttribute('hidden', ''));
    renderError(slot('hero-stage'), error, start);
}

async function start() {
    SLOTS_AFTER_HERO.forEach((name) => slot(name)?.closest('section')?.removeAttribute('hidden'));
    ['popular', 'recent', 'gamepad', 'mobile'].forEach((name) => rowSkeleton(slot(name)));

    try {
        await loadCatalog();
    } catch (error) {
        showCatalogError(error);
        return;
    }
    const featured = getFeatured(config.hero.maxSlides);
    renderHero(featured.length ? featured : getRecent(config.hero.maxSlides));
    renderContinue();
    renderExplorer(getFeatured());
    renderPopular();
    renderRecent();
    renderGenres();
    renderPlatforms();
    renderControlSections();
    renderSpotlight();
}

window.addEventListener('projeto-fenix:history-changed', () => getAll().length && renderContinue());
window.addEventListener('projeto-fenix:metrics-changed', () => getAll().length && renderPopular());

start();
