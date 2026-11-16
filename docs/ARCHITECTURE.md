# ARCHITECTURE — Projeto Fênix

## Fluxo de carregamento
```
<página>.html
  ├─ base.css + components.css + pages/<página>.css
  ├─ js/main.js          (módulo; roda em todas as páginas)
  │    └─ renderHeader / renderFooter / partículas / ícones / initGlobalActions
  └─ js/pages/<página>.js (módulo; lógica da página)
        └─ usa modules/* (catálogo, filtros, busca, componentes…)
```
`<body data-page="…">` identifica a página (menu ativo). Os HTMLs têm só o esqueleto (`#site-header`, `<main>` com `data-slot="…"`, `#site-footer`); **todo conteúdo dinâmico é montado por JS** com o helper `el()` (sem `innerHTML`).

## Diretórios
```text
assets/css/base.css          tokens (:root), fontes @font-face locais, reset, tipografia, layout, .title-hud, reduced-motion
assets/css/components.css    header, botões, chips, selos, cards, ficha/modais, rails, paginação, footer, toasts… e **blocos de filtro reutilizáveis** (`.chip[aria-pressed]`, `.filter-group`, `.seg`, `.search-input`, `.result-count`, `.filterbar*`, `.stat-pills`) usados por Tendências e Recentes e a reutilizar em Gêneros/Catálogo
assets/css/pages/*.css       estilos específicos (home, tendencias e recentes completos; os demais são iniciais)
assets/js/config.js          ÚNICA fonte de nome, navegação, caminhos de dados, regras de selos, métricas, contato
assets/js/main.js            bootstrap compartilhado
assets/js/modules/           ver tabela abaixo
assets/js/pages/*.js         home, tendencias, recentes, catalogo, generos e auth
assets/{fonts,icons,images}/ Inter + Oxanium (woff2), sprite.svg, favicon, logo
data/games.json              fonte única dos dados do catálogo
tools/serve.mjs · check.mjs  servidor local e verificador estático (sem dependências)
```

## Módulos (`assets/js/modules/`)
| Módulo | Responsabilidade |
|---|---|
| `utils.js` | `el()`, `icon()`, `$`/`$$`, `debounce`, `normalizeText`, `slugify`, `safeHttpUrl`, datas, `trapFocus`, aleatório |
| `storage.js` | `localStorage` seguro (try/catch), chaves `projeto-fenix:v1:<nome>` (`favorites`, `history`, `access`, `prefs`, `consent`), `pruneOldVersions`, `clearAll` |
| `auth.js` | cadastro local de demonstração, hash PBKDF2 de senha e sessão local; não substitui autenticação de servidor/OAuth |
| `favorites.js` | favoritos e histórico (máx. `config.history.max`) |
| `metrics.js` | serviço de métricas. `LocalMetrics` (padrão, `isGlobal=false`) e `RemoteMetrics` (gancho p/ API futura). Troca via `config.metrics.provider`. API: `recordAccess`, `getCount`, `getWindow(id, dias)` → `{recent, previous}` (acessos dos últimos N dias × N dias anteriores, a partir de contagem diária), `getTotals`, `hasData`, `reset` |
| `catalog.js` | carga + **validação/normalização** de `games.json` (`loadCatalog`), constantes (controles, tipos de projeto, rótulos), seletores (`getFeatured`, `getRecent`, `getPopular`, `getGenres`, `getPlatforms`, `getWithControl`, `getForMobile`, `getRandom`, `getStats`…) |
| `filters.js` | `createEmptyFilters` (inclui `statuses`), `applyFilters`, `sortGames` (`SORT_MODES`; pontuações pré-calculadas), `firstLetter`, `removeFilter`, **`rankScore(game, modo)` — fórmula única de pontuação local** (`accessed`, `trending`, `popular` = acessos + `FAVORITE_POINTS` por favorito; `RANKING_MODES`), estado⇄URL (`queryToFilters`/`filtersToQuery`), `describeActiveFilters(f, { genre })` |
| `filterbar.js` | **kit de filtros compartilhado.** `createFilterKit(state, { id, sortOptions, defaultSort, onChange, blank })` devolve as peças `search({ suggestions, onPick })`, `sort()`, `groups({ layout: 'bar'\|'accordion', extended, genres })`, `foot({ live })`, `setScope(jogos)` (plataformas só desses jogos) e `sync()`; `mountFilterBar(host, state, opções)` monta tudo numa barra horizontal (Tendências, Recentes). `readFilterUrl(state, { sortOptions, defaultSort, extended })` / `writeFilterUrl(state, { defaultSort, push }, extra)` espelham filtros + `ordem` na URL (descartam valores desconhecidos; `extended` mantém tipo/status/jogadores/letra). Ganchos de teste: `data-genre/platform/type/status/flag/control/match/level/exclusive`, `data-fb="clear-query\|clear-filters"`. A página é dona do `state` |
| `pagination.js` | `mountPagination(container)` → `render({ page, pages, onPage })`: paginação circular com janela/reticências (`pageWindow`), `aria-current`, delegação de eventos, janela menor em ≤ 480 px |
| `tabs.js` | `mountTabs(tablist, panel, { onSelect })` — abas WAI-ARIA com setas/Home/End (`data-tab`) |
| `periods.js` | cronologia por datas reais, funções puras: `periodOf`, `groupByPeriod`, `shouldSplit`, `describeDates`, `sortByDate`, `wasUpdated` |
| `search.js` | `parseQuery`, `scoreGame`, `searchGames`, `highlight`, `mountSearchBox` (sugestões acessíveis, debounce, limpar) |
| `cover.js` | **capas SVG geradas por código** (determinísticas por `cover.seed`; motivos tiles/hex/checks/cubes/peaks/circuit). Nunca usa arte de terceiros |
| `particles.js` | brasas ascendentes em Canvas 2D com brilhos pré-calculados, resolução limitada, pausa em segundo plano e suporte a `prefers-reduced-motion` |
| `fire-cursor.js` | rastro local de fogo e rajadas no cursor; usa brilho pré-calculado, não captura cliques e respeita movimento reduzido |
| `components.js` | header/footer, cards de jogos (`createGameCard` poster/wide/row), controles, selos, rails, estados vazio/erro/skeleton, **ficha do jogo** (`openGame`), busca (`openSearch`), biblioteca favoritos/histórico (`openLibrary`), privacidade (`openPrivacy`), entrada na conta, bloqueio de favoritos sem sessão e ações globais |

## Dados
- `data/games.json` é a fonte única do catálogo; páginas nunca embutem jogos. Contrato completo em `docs/DATA_SCHEMA.md`.
- `loadCatalog()` valida cada registro; inválidos são descartados com aviso (`getWarnings()`), nunca quebram a página. Falha de `fetch` → `CatalogError` → `renderError` com botão "tentar de novo".
- Quantidades (gêneros, plataformas, totais) são **derivadas** do catálogo — não há contadores fixos.
- Controles têm 4 estados: `required` · `supported` · `unverified` · `unsupported`. "Aceito" = `required` ou `supported`.

## Estado na URL
- Filtros: `?q=&genero=&plataforma=&tipo=&status=&controle=&modo=&nivel=&exclusivo=&singleplayer=&multiplayer=&mobile=&salvamento=&problemas=&desenvolvimento=&letra=` (`status` = `released|in-development|unverified`).
- Ordenação: `?ordem=` — cada página define suas opções (`sortOptions`): Tendências `popular|accessed|trending|recent|updated|az|za`; Recentes `recent|oldest|az|za`. Catálogo e painel de Gêneros (`CATALOG_SORTS` em `filters.js`): `recent|updated|popular|accessed|az|za|relevance` (`recent` é o padrão); `?pagina=N` (24 por página).
- Recentes: `?vista=atualizados` (padrão = adicionados).
- Ficha: `#jogo=<slug>` (abre como diálogo sobre a página atual).

## Convenções de implementação
1. Sem `rem`, sem `eval`, sem `innerHTML` com dados, sem `<style>`/`<script>` embutidos, sem recursos de terceiros. `node tools/check.mjs` impõe tudo isso.
2. Eventos por **delegação** (`data-action="open-game|toggle-fav|…"`); botões sempre com ação real.
3. Diálogos com o elemento nativo `<dialog>` (modal): foco, Esc e rolagem tratados pelo navegador; botões que abrem diálogo têm `aria-haspopup="dialog"`; `trapFocus` em `utils.js` complementa onde necessário.
4. Imagens com `width`/`height`, `loading="lazy"` (a 1ª do hero é `eager`), `decoding="async"`.
5. Animações respeitam `prefers-reduced-motion`; hover só em `@media (hover: hover)`.
6. Mobile-first; `container-type` nos cards poster para trocar selo completo/curto por largura.
7. Páginas futuras reutilizam `components.js`, `filters.js`, `search.js` — **não duplicar lógica**.

## Conta e favoritos
- `login.html` e `registro.html` compartilham `assets/js/pages/auth.js` e `assets/css/pages/auth.css`; o cabeçalho e rodapé vêm do mesmo `main.js` usado nas demais páginas.
- Para rodar só com Live Server, cadastro e sessão são locais ao navegador. Senhas são armazenadas como hash PBKDF2 com salt; esta demonstração não substitui autenticação de servidor.
- Os botões Google, Facebook e X são a interface de entrada para uma futura integração. O login OAuth precisa de credenciais de cliente e configuração dos provedores; não é simulado nem transmite credenciais para o site.
- Ações de favoritar redirecionam para `login.html` quando não há sessão e preservam a página de retorno.

## Página Tendências (Etapa 2) — como funciona
- `tendencias.js` monta tudo com `el()`; slots em `tendencias.html` (`summary`, `basis`, `toolbar`, `genres`, `platforms`, `controls`, `ranking`, `rising`, `featured`, `class-tabs`, `class-panel`).
- Fluxo: `update()` → lê filtros/ordem → `applyFilters` → `sortGames` → `rankScore` → pódio (Top 3) + linhas + "ainda sem acessos". Reage a `projeto-fenix:metrics-changed` e a mudanças de favoritos (re-renderiza e devolve o foco ao botão de favorito).
- **Empates dividem a posição** (1, 2, 2, 4). Sem acessos: pódio vazio ("Vaga livre") + estado explicativo; nenhuma posição é inventada. Ordenações que não medem popularidade (A–Z, recentes…) mostram grade **sem numeração**, com explicação.
- "Em alta": compara os últimos 7 dias com os 7 anteriores usando `metrics.getWindow`; só lista quem teve acessos datados. "Classificação por grupo": contagem real por gênero/plataforma, soma de acessos locais e líderes; botão aplica o grupo como filtro do ranking.

## Página Recentes (Etapa 3) — como funciona
- `recentes.js` usa `filterbar.js` + `tabs.js` + `periods.js`. Abas: **Adicionados** (campo `dateAdded`) e **Atualizados** (só `wasUpdated`: `dateUpdated` > `dateAdded`, campo `dateUpdated`). As contagens das abas respeitam os filtros.
- Ordenação por data (`recent`/`oldest`) agrupa em períodos: Hoje · Nos últimos 7 dias · Nos últimos 30 dias · mês/ano · Sem data informada (relativos ao dia de calendário local; `daysSince` conta dia de calendário para datas `AAAA-MM-DD`). Ordenação por nome (A–Z/Z–A) mostra grade simples.
- **A linha do tempo só aparece com ≥ `config.recent.minPeriodsToSplit` (2) períodos distintos**; senão a página escreve a data real ("Adicionados em 05 de novembro de 2026 — as datas caem em um único período") em vez de fingir uma cronologia.
- Cards: pílula com a data do campo da aba; selo pelas datas reais (`freshness`, com `preferUpdate` na aba Atualizados).

## Página Todos os jogos (Etapa 4) — como funciona
- `catalogo.js` usa `createFilterKit` (busca + ordenação no cabeçalho; grupos em acordeão no painel), `pagination.js` e o `state` `{ filters, sort, sortChosen, page }`. Slots em `todos-os-jogos.html`: `stats`, `panel`, `backdrop`, `toolbar`, `tags`, `az`, `summary`, `local-note`, `results`, `pagination`.
- Fluxo: `change(mutator)` → página 1 → `update()` → `compute()` (um `applyFilters` sem a letra → letras disponíveis → filtra a letra → `sortGames`; resultado em memória por `JSON.stringify([filtros, ordem])`, invalidado por `projeto-fenix:metrics-changed`/`favorites-changed`/`storage`) → só `PAGE_SIZE` cards viram DOM.
- **Painel:** `<aside id="filters-panel">`. Desktop (≥ 1024 px): sticky ao lado dos resultados. Celular: o mesmo aside vira gaveta (`role="dialog"`, `aria-modal`, resto `inert`, `trapFocus`, `html.is-scroll-locked`, `#main` com `z-index: 200` enquanto aberta).
- A–Z é montado uma vez e só tem `aria-pressed`/`disabled` atualizados (o foco não se perde). Tags removíveis por delegação; após remover, o foco vai para a tag seguinte.
- URL: `writeUrl(push)` — filtros e `ordem` com `replaceState`, mudança de página com `pushState`; `popstate` relê a URL.

## Página Gêneros (Etapa 5) — como funciona
- `generos.js` monta tudo com `el()`; slots em `generos.html`: `stats`, `tools`, `genres`, `panel`. `getGenres()` (nome, slug, contagem, descrição e motivo de `GENRE_INFO`) define os cards; `buildIndex()` agrupa os jogos por gênero (ordem editorial) uma vez.
- Cada card é um `<button class="genre-tile" data-genre aria-pressed aria-controls="genre-panel">`; a arte é `coverSrc` com motivo do gênero e semente `genero-<slug>` e a cor vem de `coverAccent` (`--g-accent`, usada também no painel).
- O painel (`<section id="genre-panel">`) é montado uma vez e reaproveitado: `renderPanel()` aplica `applyFilters` (sem o filtro de gênero — o universo já é o gênero) + `sortGames`, pagina e renderiza só 24 cards; `kit.setScope(universo)` troca os chips de plataforma ao mudar de gênero. Resultado em memória por `[gênero, filtros, ordem]`, invalidado por `projeto-fenix:metrics-changed`/`favorites-changed`/`storage`.
- `toggleGenre`/`closeGenre`/troca de página usam `pushState`; filtros do painel, `replaceState`; `popstate` relê a URL (`readUrl`). Rolagem: só `html { scroll-padding-top }` (não usar `scroll-margin-top` extra — D-35).

## Pontos de extensão
- Métricas globais: implementar `RemoteMetrics` em `metrics.js` (informar origem e data) e mudar `config.metrics.provider`.
- Capas licenciadas: `cover: { type: "image", src, ... }` + `coverCredit` obrigatório (o `check.mjs` reprova sem crédito).
- Importação de catálogo: `docs/CATALOG_IMPORT.md`.
