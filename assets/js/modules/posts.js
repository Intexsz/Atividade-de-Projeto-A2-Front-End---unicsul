/**
 * Artigos do blog (data/posts.json). Mesma política do catálogo: validar, nunca confiar.
 * Corpo do artigo = lista de blocos: { type: 'p' | 'h' | 'ul' | 'links', ... } — renderizados sem innerHTML.
 */
import { config } from '../config.js';
import { parseDate, safeHttpUrl, normalizeText, slugify } from './utils.js';
import { loadJson, CatalogError, normalizeCover } from './catalog.js';
import { parseQuery } from './search.js';

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const strList = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function normalizeBlocks(raw) {
    if (!Array.isArray(raw)) return [];
    const blocks = [];
    for (const block of raw) {
        if (!isObj(block)) continue;
        if ((block.type === 'p' || block.type === 'h') && str(block.text)) blocks.push({ type: block.type, text: str(block.text) });
        else if (block.type === 'ul' && strList(block.items).length) blocks.push({ type: 'ul', items: strList(block.items) });
        else if (block.type === 'links') {
            const items = (Array.isArray(block.items) ? block.items : [])
                .map((i) => ({ label: str(i?.label), url: safeHttpUrl(i?.url) }))
                .filter((i) => i.label && i.url);
            if (items.length) blocks.push({ type: 'links', items });
        }
    }
    return blocks;
}

export function normalizePost(raw) {
    if (!isObj(raw) || !str(raw.id) || !str(raw.slug) || !str(raw.title)) return null;
    const category = str(raw.category) || 'Geral';
    const tags = [...new Set(strList(raw.tags))];
    return {
        id: str(raw.id),
        slug: str(raw.slug),
        title: str(raw.title),
        excerpt: str(raw.excerpt),
        category,
        categorySlug: slugify(category),
        tags,
        tagSlugs: tags.map(slugify),
        publishedAt: parseDate(raw.publishedAt) !== null ? raw.publishedAt : null,
        updatedAt: parseDate(raw.updatedAt) !== null ? raw.updatedAt : null,
        author: str(raw.author) || 'Equipe Projeto Fênix',
        readingMinutes: Number.isFinite(raw.readingMinutes) ? raw.readingMinutes : null,
        cover: normalizeCover(raw.cover, str(raw.slug), 'circuit'),
        featured: raw.featured === true,
        demo: raw.demo === true,
        body: normalizeBlocks(raw.body),
        sources: (Array.isArray(raw.sources) ? raw.sources : [])
            .map((s) => ({ label: str(s?.label), url: safeHttpUrl(s?.url) }))
            .filter((s) => s.label && s.url),
    };
}

const state = { posts: [], promise: null };
const byDateDesc = (a, b) => (parseDate(b.publishedAt) ?? 0) - (parseDate(a.publishedAt) ?? 0) || a.title.localeCompare(b.title, 'pt-BR');

export function loadPosts({ force = false } = {}) {
    if (state.promise && !force) return state.promise;
    state.promise = (async () => {
        const data = await loadJson(config.dataPaths.posts);
        if (!isObj(data) || !Array.isArray(data.posts)) throw new CatalogError('schema', 'campo "posts" ausente');
        const ids = new Set();
        state.posts = data.posts
            .map(normalizePost)
            .filter((p) => {
                if (!p || ids.has(p.id)) return false;
                ids.add(p.id);
                return true;
            })
            .sort(byDateDesc);
        return state.posts;
    })();
    state.promise.catch(() => {
        state.promise = null;
    });
    return state.promise;
}

export const getPosts = () => state.posts;
export const getPostById = (id) => state.posts.find((p) => p.id === id) ?? null;
export const getFeaturedPost = () => state.posts.find((p) => p.featured) ?? state.posts[0] ?? null;
export const getLatestPosts = (limit = 3, excludeId = null) => state.posts.filter((p) => p.id !== excludeId).slice(0, limit);
export const getRelatedPosts = (post, limit = 3) =>
    state.posts
        .filter((p) => p.id !== post.id)
        .map((p) => ({ p, score: (p.category === post.category ? 2 : 0) + p.tags.filter((t) => post.tags.includes(t)).length }))
        .sort((a, b) => b.score - a.score)
        .map((e) => e.p)
        .slice(0, limit);

export function getPostCategories() {
    const map = new Map();
    state.posts.forEach((p) => map.set(p.category, (map.get(p.category) ?? 0) + 1));
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}

/* =========================================================================
   Pesquisa, filtros, ordenação e facetas (página Blog)
   ========================================================================= */

export const BLOG_SORTS = Object.freeze({ recent: 'Mais recentes', oldest: 'Mais antigos', az: 'Título (A–Z)' });

const collator = new Intl.Collator('pt-BR');
const timeOf = (post) => parseDate(post.publishedAt) ?? 0;

const fieldCache = new WeakMap();
/** Campos pesquisáveis já normalizados (sem acento, minúsculos), calculados uma vez por artigo. */
function fieldsOf(post) {
    let fields = fieldCache.get(post);
    if (!fields) {
        const body = post.body.map((b) => (b.type === 'ul' ? b.items.join(' ') : b.type === 'links' ? b.items.map((i) => i.label).join(' ') : b.text)).join(' ');
        fields = {
            title: normalizeText(post.title),
            tags: normalizeText(post.tags.join(' ')),
            category: normalizeText(post.category),
            excerpt: normalizeText(post.excerpt),
            body: normalizeText(body),
        };
        fieldCache.set(post, fields);
    }
    return fields;
}

const WEIGHTS = Object.freeze({ title: 8, tags: 5, category: 4, excerpt: 3, body: 1 });

/** 0 = não corresponde. Todos os termos precisam aparecer em algum campo (AND); título e tags pesam mais. */
export function scorePost(post, tokens) {
    if (!tokens.length) return 1;
    const fields = fieldsOf(post);
    let total = 0;
    for (const token of tokens) {
        let best = 0;
        for (const [name, weight] of Object.entries(WEIGHTS)) if (fields[name].includes(token)) best = Math.max(best, weight);
        if (!best) return 0;
        total += best;
    }
    return total;
}

/** Filtros combináveis: `query` (todos os termos), `category` (slug) e `tag` (slug). */
export function filterPosts(posts, { query = '', category = '', tag = '' } = {}) {
    const tokens = parseQuery(query);
    return posts.filter((p) => (!category || p.categorySlug === category) && (!tag || p.tagSlugs.includes(tag)) && scorePost(p, tokens) > 0);
}

/** `relevance` só faz sentido com texto de busca; sem ele cai em "mais recentes". */
export function sortPosts(posts, sort, query = '') {
    const tokens = parseQuery(query);
    const list = [...posts];
    const byDate = (a, b) => timeOf(b) - timeOf(a) || collator.compare(a.title, b.title);
    if (sort === 'relevance' && tokens.length) return list.sort((a, b) => scorePost(b, tokens) - scorePost(a, tokens) || byDate(a, b));
    if (sort === 'oldest') return list.sort((a, b) => timeOf(a) - timeOf(b) || collator.compare(a.title, b.title));
    if (sort === 'az') return list.sort((a, b) => collator.compare(a.title, b.title));
    return list.sort(byDate);
}

/**
 * Categorias e tags de TODO o acervo (ordem estável: mais artigos primeiro), com a contagem calculada sobre
 * `scoped` — assim os chips mostram quantos artigos sobrariam se fossem marcados (contagem facetada).
 */
export function listFacets(all, scoped = all) {
    const build = (nameOf, slugOf) => {
        const meta = new Map();
        for (const post of all) for (const [name, slug] of nameOf(post)) if (!meta.has(slug)) meta.set(slug, { slug, name, total: 0, count: 0 });
        for (const post of all) for (const [, slug] of nameOf(post)) meta.get(slug).total += 1;
        for (const post of scoped) for (const [, slug] of nameOf(post)) meta.get(slug).count += 1;
        return [...meta.values()].sort((a, b) => b.total - a.total || collator.compare(a.name, b.name));
    };
    return {
        categories: build((p) => [[p.category, p.categorySlug]]),
        tags: build((p) => p.tags.map((t, i) => [t, p.tagSlugs[i]])),
    };
}

/** Artigo principal (1º destaque editorial ou o mais recente) e destaques (demais marcados, completando com os mais recentes). */
export function pickLead(posts, highlights = 2) {
    const main = posts.find((p) => p.featured) ?? posts[0] ?? null;
    if (!main) return { main: null, highlights: [] };
    const rest = posts.filter((p) => p.id !== main.id);
    const ordered = [...rest.filter((p) => p.featured), ...rest.filter((p) => !p.featured)];
    return { main, highlights: ordered.slice(0, highlights) };
}
