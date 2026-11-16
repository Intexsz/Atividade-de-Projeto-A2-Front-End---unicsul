# CATALOG_IMPORT — como o acervo cresce (e o que NÃO fazer)

## Situação do Ported2Browser
Em 05/11/2026 o `robots.txt` do Ported2Browser **proíbe acesso automatizado** e o site usa proteção anti-bot. Conforme o brief, **não** contornamos Cloudflare/CAPTCHA/anti-scraping, **não** usamos endpoints privados e **não** copiamos o catálogo dele. Consequência: o catálogo-semente foi montado a partir de **fontes públicas dos próprios projetos** (repositórios oficiais, páginas dos jogos, Wikipedia).

O Ported2Browser continua sendo a **referência funcional** (como organizar e filtrar). Para trazer dados dele no futuro, só por um destes caminhos legítimos:
1. Permissão expressa do site/dos autores dos ports (e-mail), ou API/feed público documentado.
2. Cadastro manual por uma pessoa, jogo a jogo, a partir da ficha pública do **desenvolvedor** do port.

## Checklist para cadastrar um jogo (todos os itens)
1. **Legitimidade:** abra `playUrl` e confirme que é o projeto certo (e não um clone/espelho). Registre em `linkCheck` (`status`, `method`, `date`).
2. **Fontes (`sources`):** ≥ 1 URL verificável (repositório oficial, página do autor, documentação). Sem fonte, não cadastra.
3. **Plataforma × tipo:** `platform` = plataforma **original** do jogo; `projectType` = natureza do projeto (port, recriação, fangame…).
4. **Controles:** só marque `required`/`supported` com evidência (README, página do jogo, guia confiável). Sem evidência → `unverified`. Explique em `controlsSource`.
5. **Capa:** use `generated` (padrão) a menos que haja **autorização/licença**; nesse caso hospede em `assets/images/games/`, preencha `coverCredit` (autor + licença) — o `check.mjs` exige.
6. **Direitos:** não incluir ROMs, executáveis ou arquivos protegidos. Para fangames/ROM hacks/ports de franquias, adicione em `notices`: "Projeto independente, sem afiliação oficial com os titulares da franquia."
7. **Datas:** `dateAdded` = dia do cadastro; `dateUpdated` muda quando a ficha for revisada (isso alimenta os selos).
8. **Rode** `node tools/check.mjs` e abra o site para conferir card e ficha.

## Importação em lote (futuro)
Se houver uma fonte autorizada (CSV/JSON), crie um script em `tools/` (ex.: `tools/import-csv.mjs`) que **gere** entradas no formato de `DATA_SCHEMA.md`, marque `sources` com a origem e a data da importação, deixe tudo que não vier da fonte como `unverified` e **nunca** sobrescreva entradas revisadas manualmente. O script não deve fazer requisições a sites que proíbam automação.

## Escala
O catálogo é carregado inteiro em memória (adequado para centenas/milhares de registros). A Etapa 4 renderiza por **páginas/“carregar mais”** — nunca centenas de cards de uma vez. Se o JSON passar de alguns MB, dividir por letra ou por plataforma e carregar sob demanda.
