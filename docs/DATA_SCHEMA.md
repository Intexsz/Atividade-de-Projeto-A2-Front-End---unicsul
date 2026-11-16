# DATA_SCHEMA — contrato dos dados

`schemaVersion: 1`. Campos ausentes viram "Não informado"/"Não verificado" na interface — **nunca preencha com palpite**.

## `data/games.json`
```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "AAAA-MM-DD",
  "seed": true,                 // true enquanto for o catálogo-semente
  "note": "texto livre sobre a origem do arquivo",
  "games": [ /* Game[] */ ]
}
```

### Game
| Campo | Tipo | Obrig. | Observações |
|---|---|---|---|
| `id` | string | sim | único, estável (ex.: `g-2048`) |
| `slug` | string | sim | único; usado em `#jogo=<slug>` |
| `name` | string | sim | |
| `shortDescription` | string | não | 1 frase (cards, hero) |
| `description` | string | não | texto completo da ficha |
| `cover` | objeto | não | `{type:"generated", motif, seed}` ou `{type:"image", src, ...}` (ver abaixo). Motivos: `tiles`, `hex`, `checks`, `cubes`, `peaks`, `circuit` |
| `coverCredit` | string | **sim se `cover.type="image"`** | crédito + licença/autorização |
| `images` | string[] | não | imagens adicionais (mesma regra de crédito) |
| `genres` | string[] | não | rótulos em pt-BR; a lista de gêneros do site é derivada daqui |
| `platform` | string | não | **plataforma original** (Web, PC, DOS, NES…) — não confundir com `projectType` |
| `releaseYear` | number | não | |
| `dateAdded` / `dateUpdated` | `AAAA-MM-DD` | sim | alimentam selos NOVO/ATUALIZADO/RECÉM-ADICIONADO, a linha do tempo de Recentes e as ordenações. São datas do **cadastro no Projeto Fênix**, não do lançamento do jogo. Só conta como "atualizado" quando `dateUpdated` é **posterior** a `dateAdded`; atualizar o registro no mesmo dia da inclusão não gera selo nem entra na aba "Atualizados". Ao revisar uma ficha, altere `dateUpdated` |
| `projectType` | enum | sim | `web-native` · `port` · `recreation` · `emulator` · `fangame` · `rom-hack` · `in-development` (rótulos em `PROJECT_TYPES`) |
| `developer` | string | não | autor do jogo/port |
| `officialUrl` | URL http(s) | não | página oficial/repositório |
| `playUrl` | URL http(s) | sim p/ jogar | destino do botão JOGAR AGORA (abre em nova aba) |
| `controls` | objeto | sim | `{keyboard, mouse, gamepad, touch}` ∈ `required` · `supported` · `unverified` · `unsupported` |
| `controlsSource` | string | recomendado | de onde veio a informação de controles |
| `devices` | objeto | não | `{desktop, mobile, note}` ∈ `yes` · `limited` · `no` · `unverified` |
| `tags` | string[] | não | |
| `languages` / `languagesNote` | string[] / string | não | |
| `save` | objeto | não | `{status: yes\|partial\|no\|unverified, note}` |
| `players` | objeto | não | `{single, multi}` ∈ `yes\|no\|unverified` + `note` |
| `knownIssues` | string[] | não | |
| `developmentStatus` | enum | não | `released` · `in-development` · `unverified` |
| `license` | objeto | não | `{name, url}` do **código/jogo** (não da capa) |
| `sources` | `{label,url}[]` | **sim (≥1)** | origem verificável de cada registro |
| `editorial` | objeto | não | `{featured, featuredOrder, pitch}` — seleção editorial |
| `notices` | string[] | não | avisos (ex.: "projeto independente, sem afiliação oficial") |
| `linkCheck` | objeto | recomendado | `{status, method, date}` — verificação do `playUrl` |
| `verifiedAt` | `AAAA-MM-DD` | recomendado | |

**Regra dos controles:** `required` = o jogo exige; `supported` = compatível/opcional; `unverified` = ainda sem fonte confiável (**não** é incompatibilidade); `unsupported` = fonte confirma que não suporta. O suporte da API Gamepad do navegador **não** prova compatibilidade.

### `cover`
- `{ "type": "generated", "motif": "tiles|hex|checks|cubes|peaks|circuit", "seed": "texto" }` → arte SVG original (padrão; motivo desconhecido cai em `circuit`).
- `{ "type": "image", "src": "assets/images/games/arquivo.webp", "credit": "…" }` → só com permissão/licença; hospedar localmente; manter proporção 3:4 (poster) ou 16:9.

## `localStorage` (somente neste navegador)
Chaves `projeto-fenix:v1:favorites` (ids), `history` (`{id, at}`), `access` (`{id:{count,last,days}}` — `count` = total, `last` = ISO do último acesso, `days` = contagem por dia `{"AAAA-MM-DD": n}` com retenção de `config.metrics.retentionDays` = 60 dias; `days` é opcional: registros antigos só com total continuam válidos, mas não entram no comparativo "em alta"), `prefs`, `consent`. Ao mudar o formato, incremente `config.storage.version` — `pruneOldVersions()` remove as antigas.

O fluxo de conta para demonstração no Live Server grava `projeto-fenix:v1:auth:users` e `projeto-fenix:v1:auth:session`. Senhas não são salvas em texto puro: o verificador PBKDF2 e o salt ficam locais. Essa implementação não autentica usuários em um servidor nem protege recursos publicados.

## Campos usados pelos filtros do catálogo (Etapa 4)
| Filtro | Campo(s) | Regra |
|---|---|---|
| Gênero | `genres` (slug = `slugify(nome)`) | qualquer um dos marcados |
| Plataforma | `platform` | igualdade exata do nome |
| Tipo de projeto | `projectType` | `web-native`, `port`, `recreation`, `emulator`, `fangame`, `rom-hack`, `in-development` |
| Status | `developmentStatus` | `released`, `in-development`, `unverified` (URL `?status=`) |
| Controles | `controls.<chave>` | "aceito" = `required` ou `supported`; "só os obrigatórios" = `required`; "somente os marcados" exige `unsupported` (confirmado) nos demais — `unverified` **não** conta |
| Singleplayer / Multiplayer | `players.single` / `players.multi` | `yes` |
| Compatível com celular | `controls.touch` aceito **ou** `devices.mobile = yes` | |
| Suporte a salvamento | `save.status` | `yes` ou `partial` |
| Problemas conhecidos | `knownIssues` | lista não vazia |
| Letra A–Z | `name` | 1ª letra normalizada (sem acento); `#` = número/símbolo |
