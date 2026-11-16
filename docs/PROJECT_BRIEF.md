# PROJECT_BRIEF — Projeto Fênix

## Objetivo

Portal em português para descobrir jogos que rodam no navegador, explorar o catálogo e acessar o endereço original de cada projeto. O site não hospeda jogos nem arquivos.

## Páginas

`index.html` · `tendencias.html` · `recentes.html` · `todos-os-jogos.html` · `generos.html` · `login.html` · `registro.html`.

Ficha do jogo, busca, favoritos, histórico e privacidade aparecem em diálogos ou painéis.

## Tecnologias e regras

- HTML5, CSS3 e JavaScript puro em módulos ES; site estático, sem frameworks ou etapa de build.
- Não usar `rem`, `eval()` nem `innerHTML` com dados. Montar DOM com o helper `el()`.
- Validar URLs e adicionar `rel="noopener noreferrer"` a links externos em nova aba.
- Idioma pt-BR. Nome, navegação e parâmetros globais em `assets/js/config.js`.
- Acessibilidade mobile-first e suporte a `prefers-reduced-motion`.

## Recursos

- Catálogo centralizado em `data/games.json`, com busca, filtros, ordenação e paginação.
- Favoritos, histórico e métricas de acesso armazenados localmente no navegador.
- Artes de catálogo geradas por código quando não há imagem licenciada.
- Brasas ascendentes em Canvas e ponteiros personalizados de fogo com círculos de faíscas.
- Cadastro e login locais de demonstração; a proteção de favoritos exige sessão ativa.

## Conteúdo e privacidade

Não inventar jogos, métricas, links, avaliações ou imagens. Cada jogo precisa de fontes verificáveis; capas externas precisam de autorização e crédito. Popularidade é local. A conta é opcional; não usar analytics ou rastreadores e oferecer opção para limpar os dados locais.
