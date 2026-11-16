#!/usr/bin/env node
/**
 * Servidor estático local, sem dependências. Uso: `node tools/serve.mjs [porta]` (padrão 5173).
 * Necessário porque o site carrega JSON via fetch() e usa módulos ES (não funcionam em file://).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] ?? process.env.PORT ?? 5173);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
};

// Pastas que não devem ser servidas (mesmo localmente).
const BLOCKED = new Set(['tools', 'node_modules', '.git']);

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        let path = decodeURIComponent(url.pathname);
        if (path.endsWith('/')) path += 'index.html';
        const file = normalize(join(root, path));
        if (file !== root && !file.startsWith(root + sep)) {
            res.writeHead(403).end('Acesso negado');
            return;
        }
        const first = file.slice(root.length + 1).split(sep)[0];
        if (BLOCKED.has(first)) {
            res.writeHead(404).end('Não encontrado');
            return;
        }
        const info = await stat(file);
        if (!info.isFile()) throw new Error('not a file');
        const body = await readFile(file);
        res.writeHead(200, {
            'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
            'Cache-Control': 'no-cache',
            'X-Content-Type-Options': 'nosniff',
        });
        res.end(body);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
    }
});

server.listen(port, () => {
    console.log(`Projeto Fênix em http://localhost:${port}  (Ctrl+C para encerrar)`);
});
