/**
 * Paginação em círculos (UI kit de referência).
 *
 * `mountPagination(container)` devolve `render({ page, pages, onPage })`, que desenha
 * anterior · 1 … p-1 p p+1 … N · próxima. Em telas estreitas a janela encolhe (sem vizinhos)
 * e é redesenhada sozinha quando a largura cruza o limite. Eventos por delegação; a página
 * atual usa `aria-current="page"`. Com uma página só, o contêiner fica vazio.
 */
import { clear, el, icon } from './utils.js';

const narrow = matchMedia('(max-width: 480px)');

/** Números (e `null` = reticências) mostrados para `page` de `pages`, com `siblings` vizinhos de cada lado. */
export function pageWindow(page, pages, siblings = 1) {
    const wanted = new Set([1, pages]);
    for (let n = page - siblings; n <= page + siblings; n++) if (n >= 1 && n <= pages) wanted.add(n);
    const sorted = [...wanted].sort((a, b) => a - b);
    const out = [];
    sorted.forEach((n, i) => {
        const prev = sorted[i - 1];
        if (prev !== undefined && n - prev === 2) out.push(prev + 1); // buraco de um número: mostra o número em vez de "…"
        else if (prev !== undefined && n - prev > 2) out.push(null);
        out.push(n);
    });
    return out;
}

export function mountPagination(container) {
    let current = null;

    const draw = () => {
        clear(container);
        if (!current || current.pages <= 1) return;
        const { page, pages } = current;
        const btn = (label, target, content, extra = {}) =>
            el('button', { class: 'pagination__btn', type: 'button', 'aria-label': label, dataset: { page: target }, ...extra }, content);

        const items = [btn('Página anterior', page - 1, icon('arrow-left', { size: 18 }), { disabled: page <= 1 })];
        for (const n of pageWindow(page, pages, narrow.matches ? 0 : 1)) {
            if (n === null) items.push(el('span', { class: 'pagination__gap', 'aria-hidden': 'true' }, '…'));
            else items.push(btn(`Página ${n} de ${pages}`, n, String(n), n === page ? { 'aria-current': 'page' } : {}));
        }
        items.push(btn('Próxima página', page + 1, icon('arrow-right', { size: 18 }), { disabled: page >= pages }));
        container.appendChild(el('nav', { class: 'pagination', 'aria-label': 'Paginação dos resultados' }, items));
    };

    container.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]');
        if (!button || button.disabled || !current) return;
        const target = Number(button.dataset.page);
        if (target >= 1 && target <= current.pages && target !== current.page) current.onPage(target);
    });
    narrow.addEventListener('change', draw);

    return (options) => {
        current = options;
        draw();
    };
}
