# HANDOFF — Projeto Fênix

Portal estático em pt-BR para descobrir jogos que rodam no navegador e acessar os projetos nos seus endereços originais. A navegação principal contém cinco páginas (`index.html`, `tendencias.html`, `recentes.html`, `todos-os-jogos.html` e `generos.html`) e há telas de acesso (`login.html` e `registro.html`).

## Tecnologias

HTML, CSS e JavaScript puro em módulos ES, sem etapa de build. Execute com `node tools/serve.mjs` ou Live Server. Os dados do catálogo ficam em `data/games.json`.

## Recursos centrais

- Busca, filtros, ordenação e paginação do catálogo.
- Ficha de jogo, favoritos, histórico, métricas locais e painel de privacidade.
- Artes de catálogo geradas por código quando não há arte licenciada.
- Brasas ascendentes em Canvas e ponteiros flamejantes com círculos de faíscas.
- Contas locais de demonstração para Live Server; redes sociais ainda precisam de OAuth configurado.

## Diretrizes

Consulte `PROJECT_BRIEF.md` e `ARCHITECTURE.md`. Não invente dados ou compatibilidade, não use `rem` nem `innerHTML` com dados, valide links e preserve suporte a movimento reduzido. O verificador estático está em `tools/check.mjs`.
