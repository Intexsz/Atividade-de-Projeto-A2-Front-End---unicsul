<div align="center">

# 🔥 PROJETO FÊNIX

### Descubra jogos que ganham vida direto no navegador.

**Explore. Encontre. Jogue.**

[![HTML5](https://img.shields.io/badge/HTML5-Estrutura-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/pt-BR/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-Estilo-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/pt-BR/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-Puro-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111111)](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Node.js-Servidor_local-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

[Visão geral](#-sobre-o-projeto) · [Recursos](#-recursos-em-destaque) · [Tecnologias](#-tecnologias) · [Executar](#-como-executar) · [Estrutura](#-estrutura-do-projeto) · [Documentação](#-documentação)

</div>

---

## 🚀 Sobre o projeto

O **Projeto Fênix** é um portal de descoberta e organização de jogos que podem ser acessados pelo navegador. A proposta é reunir informações úteis em um só lugar para que cada pessoa encontre sua próxima aventura com mais facilidade — pesquisando por título, explorando gêneros, comparando compatibilidade e consultando os detalhes de cada projeto.

Mais do que uma lista de links, o Fênix organiza o catálogo com informações como plataforma de origem, gênero, tipo de projeto, jogadores, controles aceitos, dispositivos compatíveis, disponibilidade de salvamento e fontes de referência.

> **Importante:** o Projeto Fênix funciona como um diretório. Ele não hospeda os jogos, ROMs ou arquivos dos projetos catalogados. Ao escolher um jogo, a pessoa é encaminhada para o endereço externo informado em sua ficha.

## ✨ Recursos em destaque

### 🕹️ Descoberta e navegação

- **Página inicial:** reúne jogos em destaque, histórico deste dispositivo, seleção editorial, novidades, gêneros, plataformas e áreas de compatibilidade.
- **Todos os jogos:** catálogo pesquisável com filtros combináveis, ordenação, navegação alfabética e paginação.
- **Tendências:** apresenta classificações e variações calculadas a partir dos acessos registrados localmente, sem fingir representar popularidade global.
- **Recentes:** separa jogos adicionados e fichas atualizadas, usando as datas registradas no catálogo.
- **Gêneros:** permite explorar as categorias e abrir os jogos correspondentes com filtros adicionais.
- **Pesquisa inteligente:** encontra jogos por nome e também por informações como gênero, plataforma, tags e características.
- **Ficha detalhada:** abre uma visão com descrição, dados do jogo, compatibilidade, controles, fontes e link para o projeto original.
- **Jogo aleatório:** ajuda a descobrir algo diferente quando a escolha está difícil.

### ❤️ Biblioteca pessoal

- **Favoritos:** guarde os jogos que deseja encontrar novamente.
- **Histórico:** consulte os jogos acessados neste navegador.
- **Preferências de privacidade:** controle os registros locais e consulte quais informações ficam armazenadas no dispositivo.
- **Cadastro e login demonstrativos:** permitem experimentar o fluxo de conta sem depender de um servidor de autenticação.

### 🔥 Identidade e experiência

- Interface em português do Brasil, com identidade visual própria do Projeto Fênix.
- Efeitos de brasas e partículas animadas em Canvas.
- Cursores personalizados com estética de fogo, incluindo rastros e efeitos ao clicar.
- Página **Corrida Fênix**, um jogo de corrida infinita inspirado no clássico desafio do dinossauro.
- Layout pensado para diferentes tamanhos de tela e respeito à preferência do sistema por movimento reduzido.
- Componentes de interface reutilizáveis, como cards, diálogos, filtros, abas, notificações e paginação.

## 🧭 Páginas do portal

| Página | Arquivo | O que você encontra |
|---|---|---|
| Início | `index.html` | Destaques, descoberta, pesquisa, novidades, gêneros e recomendações. |
| Tendências | `tendencias.html` | Rankings e indicadores de interesse calculados neste dispositivo. |
| Recentes | `recentes.html` | Jogos adicionados e fichas atualizadas. |
| Todos os jogos | `todos-os-jogos.html` | Catálogo completo, filtros avançados e paginação. |
| Gêneros | `generos.html` | Exploração do catálogo por categoria. |
| Entrar | `login.html` | Acesso à conta local demonstrativa. |
| Registro | `registro.html` | Criação de uma conta local demonstrativa. |
| Corrida Fênix | `dino.html` | Mini game de corrida infinita. |

## 🧩 Catálogo e informações dos jogos

O catálogo principal está em `data/games.json`. No conjunto de arquivos analisado, ele contém **6 registros iniciais**, que podem ser ampliados seguindo o formato documentado no projeto:

- Need for Speed: Underground 2
- Minecraft
- DOOM
- Super Mario 64
- Need for Speed: Most Wanted
- Grand Theft Auto V

Cada registro pode reunir descrição, capa, gêneros, plataforma, quantidade de jogadores, datas de inclusão e atualização, tipo de projeto, controles, dispositivos, suporte a salvamento, idiomas, desenvolvedor, links de acesso e fontes de verificação.

A interface distingue informações confirmadas de informações não verificadas. Compatibilidade não deve ser presumida: os dados precisam ser sustentados por fontes confiáveis e atualizados quando houver revisão.

### Como adicionar ou revisar jogos

1. Consulte `docs/DATA_SCHEMA.md` para conhecer os campos e os formatos aceitos.
2. Siga o checklist de legitimidade, fontes, controles, imagens e datas em `docs/CATALOG_IMPORT.md`.
3. Atualize `data/games.json` sem inventar links, métricas, avaliações ou compatibilidade.
4. Registre fontes verificáveis e confira o endereço externo antes de disponibilizar o jogo.
5. Execute o verificador do projeto e revise os resultados.

## 🛠️ Tecnologias

| Tecnologia | Utilização |
|---|---|
| **HTML5** | Estrutura semântica das páginas e componentes. |
| **CSS3** | Layout, identidade visual, animações e adaptação a diferentes telas. |
| **JavaScript (ES Modules)** | Lógica do catálogo, filtros, pesquisa, estado da interface e interações. |
| **Canvas API** | Efeitos visuais de partículas e renderização do mini game. |
| **Web Storage (`localStorage`)** | Persistência local de favoritos, histórico, preferências, métricas e conta demonstrativa. |
| **JSON** | Base estruturada de dados dos jogos. |
| **Node.js** | Servidor HTTP local e ferramenta de verificação, sem dependências externas. |

**Não utiliza frameworks ou etapa de build.** O projeto é desenvolvido com HTML, CSS e JavaScript puros, organizados em módulos ES. As fontes Inter e Oxanium estão incluídas localmente em `assets/fonts/`.

## 💻 Como executar

Como o site carrega o catálogo com `fetch()` e utiliza módulos JavaScript, ele precisa ser aberto por um servidor HTTP local. Abrir `index.html` diretamente pelo endereço `file://` não é o modo recomendado.

### Pré-requisitos

- [Node.js](https://nodejs.org/) instalado; ou
- Visual Studio Code com a extensão **Live Server**.

### Opção 1 — Servidor incluído no projeto

1. Baixe ou clone este repositório.
2. Abra a pasta raiz do Projeto Fênix no terminal.
3. Execute:

```bash
npm start
```

O servidor será iniciado, por padrão, em:

```text
http://localhost:5173
```

4. Abra esse endereço no navegador.

Também é possível iniciar diretamente, sem usar o script do npm:

```bash
node tools/serve.mjs
```

Para escolher outra porta:

```bash
node tools/serve.mjs 8080
```

### Opção 2 — Visual Studio Code

1. Abra a pasta do projeto no VS Code.
2. Instale a extensão **Live Server**, caso ainda não esteja instalada.
3. Clique com o botão direito em `index.html`.
4. Selecione **Open with Live Server**.

## 🧪 Verificação do projeto

O repositório inclui um verificador estático para conferir páginas, caminhos de recursos e regras do catálogo. Para executá-lo:

```bash
npm run check
```

O comando não substitui testes manuais no navegador. Revise os apontamentos apresentados pelo verificador e confira as páginas, os links externos e os comportamentos interativos antes de publicar uma versão.

## 🗂️ Estrutura do projeto

```text
Projeto Fênix/
│
├── index.html                  # Página inicial
├── tendencias.html             # Rankings e tendências locais
├── recentes.html                # Adições e atualizações recentes
├── todos-os-jogos.html          # Catálogo completo e filtros
├── generos.html                 # Exploração por gênero
├── login.html                   # Login demonstrativo
├── registro.html                # Cadastro demonstrativo
├── dino.html                    # Mini game Corrida Fênix
│
├── assets/
│   ├── css/
│   │   ├── base.css              # Estilos fundamentais
│   │   ├── components.css        # Componentes compartilhados
│   │   └── pages/                # Estilos específicos de cada página
│   │
│   ├── fonts/                    # Fontes Inter e Oxanium + licenças
│   ├── icons/                    # Logotipos, emblemas e ícones
│   ├── images/
│   │   ├── backgrounds/          # Planos de fundo
│   │   ├── dino/                 # Sprites e recursos da Corrida Fênix
│   │   ├── games/                # Artes utilizadas no catálogo
│   │   ├── genres/               # Artes dos gêneros
│   │   └── logo/                 # Identidade visual
│   │
│   └── js/
│       ├── config.js             # Configurações globais
│       ├── main.js               # Inicialização compartilhada
│       ├── modules/              # Lógica e componentes reutilizáveis
│       └── pages/                # Código específico de cada página
│
├── data/
│   └── games.json                # Base de dados do catálogo
│
├── docs/                         # Arquitetura, decisões e guias técnicos
│
├── tools/
│   ├── serve.mjs                 # Servidor HTTP local
│   └── check.mjs                 # Verificador estático
│
├── package.json                  # Scripts do projeto
└── README.md                     # Apresentação e instruções
```

## 🔐 Privacidade e funcionamento local

O Projeto Fênix foi estruturado para funcionar sem um backend obrigatório. Por isso, é importante entender o alcance dos recursos locais:

- Favoritos, histórico, preferências e métricas são armazenados no `localStorage` do navegador utilizado.
- Esses dados não são sincronizados automaticamente entre dispositivos ou navegadores.
- A área de tendências usa os acessos registrados localmente. Portanto, seus números **não representam estatísticas globais nem atividade de toda a comunidade**.
- O cadastro e o login são demonstrativos e ficam restritos ao navegador. Não equivalem a um serviço de autenticação em produção, não sincronizam usuários e não devem ser usados como sistema de contas real.
- O projeto não depende de uma plataforma de analytics para contabilizar o uso.

## 📸 Capturas de tela

O arquivo ZIP analisado contém artes, ícones, sprites e imagens do catálogo, mas **não contém capturas da interface em execução**. Para não apresentar mockups ou imagens ilustrativas como se fossem screenshots reais, esta versão do README não inclui capturas fictícias.

Para completar esta seção depois de executar o portal, recomenda-se adicionar imagens reais em `docs/screenshots/`, por exemplo:

| Captura sugerida | Arquivo recomendado |
|---|---|
| Página inicial | `docs/screenshots/inicio.png` |
| Catálogo e filtros | `docs/screenshots/catalogo.png` |
| Exploração por gêneros | `docs/screenshots/generos.png` |
| Página de tendências | `docs/screenshots/tendencias.png` |
| Corrida Fênix | `docs/screenshots/corrida-fenix.png` |

Depois, as imagens podem ser incorporadas aqui com a sintaxe `![Descrição](docs/screenshots/nome-da-imagem.png)`.

## 📚 Documentação adicional

A pasta `docs/` contém materiais para compreender e continuar o desenvolvimento:

- `PROJECT_BRIEF.md` — objetivo, escopo e diretrizes do projeto.
- `ARCHITECTURE.md` — fluxo de carregamento, diretórios, módulos e arquitetura.
- `DATA_SCHEMA.md` — estrutura dos registros do catálogo e dados locais.
- `CATALOG_IMPORT.md` — processo responsável para cadastrar e revisar jogos.
- `DESIGN_REFERENCE.md` — referências e decisões de interface.
- `DECISIONS.md` — histórico de decisões técnicas e de produto.
- `TASKS.md`, `PROGRESS.md` e `HANDOFF.md` — acompanhamento e continuidade do desenvolvimento.

## 🧭 Princípios do projeto

- **Descoberta sem complicação:** facilitar a busca e a exploração de jogos.
- **Informação responsável:** não inventar dados, compatibilidade, avaliações ou popularidade.
- **Transparência:** deixar claro quando uma informação ou métrica é local ou não verificada.
- **Privacidade:** manter os dados pessoais de demonstração no próprio navegador.
- **Organização:** separar páginas, estilos, módulos e dados para facilitar a manutenção.
- **Acessibilidade:** considerar navegação por teclado, semântica e preferências de movimento.

## 🤝 Contribuição

Contribuições são bem-vindas! Para propor melhorias:

1. Crie uma branch para sua alteração.
2. Faça mudanças pequenas e com objetivo claro.
3. Confira se os novos caminhos e recursos estão corretos.
4. Execute `npm run check` e revise os resultados.
5. Teste as páginas afetadas no navegador.
6. Abra um Pull Request explicando o que mudou e por quê.

Ao adicionar conteúdo ao catálogo, siga obrigatoriamente as orientações de `docs/CATALOG_IMPORT.md` e `docs/DATA_SCHEMA.md`.

## 📄 Créditos e licenças

As fontes incluídas no projeto possuem seus respectivos arquivos de licença em `assets/fonts/`. Os recursos gráficos da Corrida Fênix também possuem informações de crédito em `assets/images/dino/CREDITS.md`.

Os jogos, marcas, personagens e propriedades intelectuais mencionados nas fichas pertencem aos seus respectivos titulares. O Projeto Fênix é um diretório independente e não declara afiliação oficial com os desenvolvedores ou detentores dessas propriedades. Consulte as fontes e os avisos de cada registro antes de reutilizar materiais.

---

<div align="center">

**PROJETO FÊNIX**

*Uma nova aventura começa com uma descoberta.* 🔥

<sub>Desenvolvido com HTML5, CSS3 e JavaScript puro.</sub>

</div>