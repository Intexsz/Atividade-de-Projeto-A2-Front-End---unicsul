# PROGRESS — Projeto Fênix

## Estado atual

Projeto estático funcional com cinco páginas principais e telas adicionais de login/registro. O catálogo está em `data/games.json`; há busca, filtros, ficha de jogo, favoritos, histórico, privacidade e métricas por dispositivo. O cadastro por e-mail é local para demonstração no Live Server; autenticação social real depende de OAuth configurado.

## Efeitos visuais

- Brasas ascendentes em Canvas 2D, com pausa em segundo plano e respeito a `prefers-reduced-motion`.
- Ponteiros flamejantes personalizados: círculo de faíscas para o ponteiro normal, aro expansível ao passar sobre links e ponteiro de seleção de texto.

## Execução e continuidade

Inicie um servidor local com `node tools/serve.mjs`. Para regras e estrutura, consulte `PROJECT_BRIEF.md` e `ARCHITECTURE.md`. O backlog está em `TASKS.md`.
