/**
 * Abas acessíveis (padrão WAI-ARIA "tabs" com ativação automática).
 * Cada aba precisa de `id` e `data-tab="<chave>"`; o painel recebe `aria-labelledby` da aba ativa.
 * Setas ←/→, Home e End movem o foco e a seleção.
 */
import { $$ } from './utils.js';

export function mountTabs(tablist, panel, { onSelect } = {}) {
    const tabs = $$('[data-tab]', tablist);

    function select(key, { focus = false, silent = false } = {}) {
        tabs.forEach((tab) => {
            const on = tab.dataset.tab === key;
            tab.setAttribute('aria-selected', String(on));
            tab.tabIndex = on ? 0 : -1;
            if (on) {
                panel.setAttribute('aria-labelledby', tab.id);
                if (focus) tab.focus();
            }
        });
        if (!silent) onSelect?.(key);
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(tab.dataset.tab));
        tab.addEventListener('keydown', (event) => {
            const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
            if (step === undefined && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + step + tabs.length) % tabs.length;
            select(tabs[next].dataset.tab, { focus: true });
        });
    });

    return { select, tabs };
}
