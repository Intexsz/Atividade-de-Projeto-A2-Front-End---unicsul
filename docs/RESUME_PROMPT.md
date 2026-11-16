# Como retomar o Projeto Fênix

O projeto é um portal estático em pt-BR para descobrir jogos que rodam no navegador. A navegação principal tem cinco páginas e há telas adicionais de entrar e registro. O cadastro local é apenas uma demonstração para Live Server; a autenticação social exige OAuth configurado. Os efeitos visuais incluem brasas em Canvas e ponteiros flamejantes com círculos de faíscas.

## Regras de trabalho

- Leia `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md` e os arquivos relevantes antes de editar.
- Faça o que o usuário pedir e preserve a estrutura atual; use JavaScript puro em módulos ES.
- Não invente jogos, métricas, links, avaliações, imagens ou compatibilidade de controles.
- Não use `rem`, `eval()` ou `innerHTML` com dados. Respeite acessibilidade e movimento reduzido.
- O usuário não pediu novas funcionalidades de conteúdo editorial. O site é dedicado ao catálogo de jogos.

## Dados e configuração

- Catálogo: `data/games.json`; contrato em `docs/DATA_SCHEMA.md` e importação em `docs/CATALOG_IMPORT.md`.
- Configuração central: `assets/js/config.js`.
- Preferências, favoritos, histórico e métricas são locais ao navegador.

## Execução

Use `node tools/serve.mjs` ou a extensão Live Server do VS Code. Os módulos e JSON precisam ser servidos por HTTP; abrir o HTML diretamente via `file://` não funciona.
