/**
 * Inicialização compartilhada por todas as páginas (carregado antes do script da página).
 * Monta header/footer padronizados, brasas, cursor de fogo, ícones e ações globais.
 */
import { $ } from './modules/utils.js';
import { pruneOldVersions } from './modules/storage.js';
import { renderHeader, renderFooter, hydrateIcons, initGlobalActions } from './modules/components.js';
import { initParticles } from './modules/particles.js';
import { initFireCursor } from './modules/fire-cursor.js';

const page = document.body.dataset.page || 'home';

pruneOldVersions();
document.documentElement.classList.add('js');

const header = $('#site-header');
const footer = $('#site-footer');
if (header) renderHeader(header, page);
if (footer) renderFooter(footer);
hydrateIcons();

const canvas = $('#ember-canvas');
if (canvas) initParticles(canvas);
initFireCursor();

initGlobalActions();
