/**
 * Configuração central do Projeto Fênix.
 * Altere o nome do projeto, textos globais e parâmetros aqui — todo o site lê este arquivo.
 */
export const config = Object.freeze({
    name: 'Projeto Fênix',
    tagline: 'Descubra jogos que rodam direto no navegador',
    description:
        'Diretório de jogos para navegador: encontre, compare controles e acesse o projeto original sem baixar nada.',
    locale: 'pt-BR',
    version: '0.6.0',
    stage: 6,

    /** Caminhos dos dados (relativos à raiz do site). */
    dataPaths: Object.freeze({
        games: 'data/games.json',
    }),

    /** Armazenamento local: chaves seguem `${prefixo}:v${versão}:${nome}`. */
    storage: Object.freeze({ prefix: 'projeto-fenix', version: 1 }),

    /** Páginas principais. */
    nav: Object.freeze([
        { id: 'home', label: 'Início', href: 'index.html' },
        { id: 'tendencias', label: 'Tendências', href: 'tendencias.html' },
        { id: 'recentes', label: 'Recentes', href: 'recentes.html' },
        { id: 'catalogo', label: 'Todos os jogos', href: 'todos-os-jogos.html' },
        { id: 'generos', label: 'Gêneros', href: 'generos.html' },
    ]),

    /** Regras dos selos de novidade (calculadas a partir das datas reais do catálogo). */
    freshness: Object.freeze({ justAddedDays: 3, newDays: 14, updatedDays: 14 }),

    /** Página Recentes: só separa por períodos quando as datas reais caem em pelo menos N períodos distintos. */
    recent: Object.freeze({ minPeriodsToSplit: 2 }),

    /** Catálogo (Todos os jogos): quantos cards por página. */
    catalog: Object.freeze({ pageSize: 24 }),

    history: Object.freeze({ max: 50 }),
    hero: Object.freeze({ autoplayMs: 7000, maxSlides: 5 }),
    search: Object.freeze({ debounceMs: 150, maxSuggestions: 6 }),

    /**
     * Fonte das métricas de acesso. 'local' = somente este dispositivo.
     * Para integrar um serviço compartilhado no futuro, veja modules/metrics.js.
     */
    metrics: Object.freeze({
        provider: 'local',
        /** Janela do comparativo "em alta": últimos N dias × N dias anteriores. */
        trendWindowDays: 7,
        /** Quantos dias de contagem diária ficam guardados no navegador. */
        retentionDays: 60,
    }),

    /** Contato público. Deixe e-mail vazio até haver um canal definido. */
    contact: Object.freeze({ email: '', note: '' }),

    /** Dados do controlador, exibidos na política de privacidade quando preenchidos. */
    legal: Object.freeze({ controllerName: '', controllerContact: '' }),
});
