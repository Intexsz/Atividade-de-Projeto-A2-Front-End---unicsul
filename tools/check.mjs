#!/usr/bin/env node
/**
 * Verificador estático do Projeto Fênix (sem dependências). Uso: `node tools/check.mjs` (ou `npm run check`).
 * Automatiza os critérios do brief: sete páginas, CSS/JS externos, sem `rem`, sem eval/innerHTML,
 * caminhos de arquivos válidos, links externos seguros, sem recursos de terceiros e JSON consistente.
 * Código de saída 1 se houver ERRO; avisos não reprovam.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rel = (file) => relative(root, file).split(sep).join('/');
const read = (file) => readFileSync(file, 'utf8');
const errors = [];
const warnings = [];
const fail = (file, message) => errors.push(`${typeof file === 'string' && file.startsWith(root) ? rel(file) : file}: ${message}`);
const warn = (file, message) => warnings.push(`${typeof file === 'string' && file.startsWith(root) ? rel(file) : file}: ${message}`);

function walk(dir, ext, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git'].includes(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, ext, out);
        else if (extname(entry.name) === ext) out.push(full);
    }
    return out;
}

/** Remove comentários de JS respeitando aspas e template strings (suficiente para checagens textuais). */
function stripJs(src) {
    let out = '';
    let i = 0;
    let quote = null;
    while (i < src.length) {
        const c = src[i];
        const n = src[i + 1];
        if (quote) {
            out += c;
            if (c === '\\') { out += n ?? ''; i += 2; continue; }
            if (c === quote) quote = null;
            i++;
        } else if (c === '/' && n === '/') {
            while (i < src.length && src[i] !== '\n') i++;
        } else if (c === '/' && n === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
        } else {
            if (c === '"' || c === "'" || c === '`') quote = c;
            out += c;
            i++;
        }
    }
    return out;
}
const stripCss = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '');

/* ---------- 1. Estrutura obrigatória ---------- */
const REQUIRED = [
    'index.html', 'tendencias.html', 'recentes.html', 'todos-os-jogos.html', 'generos.html', 'login.html', 'registro.html',
    'assets/css/base.css', 'assets/css/components.css',
    ...['home', 'tendencias', 'recentes', 'catalogo', 'generos', 'auth'].flatMap((p) => [`assets/css/pages/${p}.css`, `assets/js/pages/${p}.js`]),
    'assets/js/main.js', 'assets/js/config.js',
    ...['youtube.svg', 'facebook.svg', 'instagram.svg', 'tiktok.svg', 'x-social.svg'].map((file) => `assets/icons/${file}`),
    ...['catalog', 'filters', 'storage', 'favorites', 'search', 'components', 'utils', 'auth'].map((m) => `assets/js/modules/${m}.js`),
    'data/games.json', 'assets/images/backgrounds/Fundo.jpg',
    ...['PROJECT_BRIEF', 'ARCHITECTURE', 'PROGRESS', 'TASKS', 'DECISIONS', 'RESUME_PROMPT', 'DESIGN_REFERENCE', 'DATA_SCHEMA', 'CATALOG_IMPORT'].map((d) => `docs/${d}.md`),
    'README.md',
];
for (const file of REQUIRED) if (!existsSync(join(root, file))) fail(file, 'arquivo obrigatório ausente');

/* ---------- 2. Sete páginas ---------- */
const rootHtml = readdirSync(root).filter((f) => f.endsWith('.html')).sort();
if (rootHtml.length !== 7) fail('raiz', `esperadas 7 páginas HTML, encontradas ${rootHtml.length}: ${rootHtml.join(', ')}`);
const navHrefs = [...read(join(root, 'assets/js/config.js')).matchAll(/href:\s*'([^']+\.html)'/g)].map((m) => m[1]);
if (navHrefs.length !== 5) fail('assets/js/config.js', `a navegação deve ter 5 páginas (tem ${navHrefs.length})`);
navHrefs.forEach((h) => !existsSync(join(root, h)) && fail('assets/js/config.js', `a navegação aponta para ${h}, que não existe`));

/* ---------- 3. HTML ---------- */
for (const file of walk(root, '.html')) {
    const html = read(file);
    const dir = dirname(file);
    if (!/<html[^>]+lang="pt-BR"/.test(html)) fail(file, '<html lang="pt-BR"> ausente');
    if (/<style[\s>]/i.test(html)) fail(file, 'bloco <style> embutido (use arquivos CSS externos)');
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
        if (!/\bsrc=/.test(m[1])) fail(file, '<script> embutido sem src (use arquivos JS externos)');
    }
    if (!/assets\/css\/base\.css/.test(html) || !/assets\/css\/components\.css/.test(html)) fail(file, 'CSS global (base + components) não carregado');
    if (!/assets\/js\/main\.js/.test(html)) fail(file, 'assets/js/main.js não carregado');
    if (!/assets\/css\/pages\//.test(html) || !/assets\/js\/pages\//.test(html)) fail(file, 'CSS/JS específicos da página não carregados');
    for (const m of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
        const url = m[1];
        if (/^(https?:|mailto:|data:|javascript:)/.test(url)) continue;
        if (!existsSync(resolve(dir, url))) fail(file, `caminho inexistente: ${url}`);
    }
    for (const m of html.matchAll(/<(script|link|img|iframe)\b[^>]*(?:src|href)="(https?:\/\/[^"]+)"/gi)) {
        if (m[1].toLowerCase() === 'link' && /rel="(?:canonical|alternate)"/.test(m[0])) continue;
        fail(file, `recurso de terceiros carregado (${m[2]}) — sem CDNs/rastreadores`);
    }
    for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
        if (!/noopener/.test(m[0]) || !/noreferrer/.test(m[0])) fail(file, 'link target="_blank" sem rel="noopener noreferrer"');
    }
    if (rel(file) !== 'index.html' && (html.match(/<h1\b/g) ?? []).length !== 1) fail(file, 'deve haver exatamente um <h1>');
}

/* ---------- 4. CSS ---------- */
for (const file of walk(join(root, 'assets/css'), '.css')) {
    const css = stripCss(read(file));
    const bad = css.match(/(?<![\w-])-?\d*\.?\d+rem\b/);
    if (bad) fail(file, `unidade proibida "${bad[0]}" (o projeto não usa rem; use px, %, vw, vh, fr…)`);
    if (/@import/.test(css)) fail(file, '@import encontrado (carregue por <link>)');
    if (/url\(\s*['"]?https?:/.test(css)) fail(file, 'url() externo (sem recursos de terceiros)');
}
if (!/prefers-reduced-motion/.test(read(join(root, 'assets/css/base.css')))) fail('assets/css/base.css', 'falta o tratamento de prefers-reduced-motion');

/* ---------- 5. JavaScript ---------- */
const FORBIDDEN = [
    [/\beval\s*\(/, 'eval()'], [/\bnew\s+Function\s*\(/, 'new Function()'], [/\.innerHTML\b/, 'innerHTML'],
    [/\.outerHTML\b/, 'outerHTML'], [/insertAdjacentHTML/, 'insertAdjacentHTML'], [/document\.write\s*\(/, 'document.write()'],
];
for (const file of walk(join(root, 'assets/js'), '.js')) {
    const raw = read(file);
    const js = stripJs(raw);
    for (const [re, name] of FORBIDDEN) if (re.test(js)) fail(file, `uso proibido de ${name}`);
    if (/fetch\(\s*['"`]https?:/.test(js)) fail(file, 'fetch() para domínio externo');
    js.split('\n').forEach((line, i) => {
        if (/target:\s*'_blank'/.test(line) && !/noopener/.test(line)) fail(file, `linha ${i + 1}: target _blank sem rel noopener noreferrer`);
    });
    const specs = [
        ...js.matchAll(/(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/g),
        ...js.matchAll(/import\s*['"]([^'"]+)['"]/g),
        ...js.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]);
    for (const spec of specs) {
        if (spec.startsWith('.') && !existsSync(resolve(dirname(file), spec))) fail(file, `import inexistente: ${spec}`);
    }
}

/* ---------- 6. Dados (JSON) ---------- */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const httpUrl = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };
const STATES = ['required', 'supported', 'unverified', 'unsupported'];

function loadJson(path) {
    try { return JSON.parse(read(join(root, path))); } catch (e) { fail(path, `JSON inválido: ${e.message}`); return null; }
}
const gamesDoc = loadJson('data/games.json');
if (gamesDoc) {
    const ids = new Set();
    const slugs = new Set();
    for (const [i, g] of (gamesDoc.games ?? []).entries()) {
        const at = `data/games.json › ${g.id ?? `#${i}`}`;
        for (const key of ['id', 'slug', 'name', 'platform', 'projectType', 'dateAdded', 'controls', 'sources', 'linkCheck']) {
            if (g[key] === undefined || g[key] === '') fail(at, `campo obrigatório ausente: ${key}`);
        }
        if (ids.has(g.id)) fail(at, 'id duplicado'); ids.add(g.id);
        if (slugs.has(g.slug)) fail(at, 'slug duplicado'); slugs.add(g.slug);
        for (const f of ['dateAdded', 'dateUpdated', 'verifiedAt']) if (g[f] && !ISO.test(g[f])) fail(at, `${f} não está em AAAA-MM-DD`);
        for (const k of ['keyboard', 'mouse', 'gamepad', 'touch']) if (!STATES.includes(g.controls?.[k])) fail(at, `controls.${k} inválido (${g.controls?.[k]})`);
        for (const f of ['playUrl', 'officialUrl']) if (g[f] && !httpUrl(g[f])) fail(at, `${f} não é uma URL http(s) válida`);
        (g.sources ?? []).forEach((s) => !httpUrl(s.url) && fail(at, `fonte com URL inválida: ${s.url}`));
        if (!g.sources?.length) fail(at, 'sem fontes registradas (não se cadastra jogo sem origem verificável)');
        if (g.cover?.type === 'image' && !g.coverCredit) fail(at, 'capa de imagem sem coverCredit (crédito/licença obrigatórios)');
        if (g.cover?.type === 'image' && g.cover.src && !httpUrl(g.cover.src) && !existsSync(join(root, g.cover.src))) fail(at, `capa inexistente: ${g.cover.src}`);
        if (g.cover?.type === 'image' && httpUrl(g.cover.src ?? '')) warn(at, 'capa por hotlink externo — prefira hospedar localmente com permissão');
    }
}
/* ---------- Resultado ---------- */
const jsCount = walk(join(root, 'assets/js'), '.js').length;
const cssCount = walk(join(root, 'assets/css'), '.css').length;
console.log(`Projeto Fênix check — ${rootHtml.length} páginas, ${cssCount} CSS, ${jsCount} JS, ${gamesDoc?.games?.length ?? 0} jogos`);
warnings.forEach((w) => console.log(`  AVISO  ${w}`));
errors.forEach((e) => console.log(`  ERRO   ${e}`));
if (errors.length) {
    console.log(`\n✗ ${errors.length} erro(s), ${warnings.length} aviso(s)`);
    process.exit(1);
}
console.log(`\n✓ Tudo certo (${warnings.length} aviso(s))`);
