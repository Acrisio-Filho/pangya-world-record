# Pangya World Record

Site estático (GitHub Pages) + API (Google Apps Script) + Banco (Google Sheets privada).

Escolhas do projeto:
- **Stack:** `Sheets + Apps Script`
- **Faixas de força:** configuráveis pelo admin (ex: 230-240, 241-250, 251-260, 261-270 — pode mudar sem mexer no código)

## Setup rápido

1. Crie a planilha Google com as abas do `docs/SHEETS_SCHEMA.md` (primeira linha = cabeçalho exato).
2. Execute `npm run build:backend`. Em Extensões > Apps Script, cole `backend/Code.gs` e ajuste `ORIGEM_TOKEN`, `SALT` e `GOOGLE_CLIENT_ID`. No cliente OAuth em `console.cloud.google.com`, autorize a origem `https://acrisio-filho.github.io`.
3. Implantar > Nova implantação > App da Web > Executar como: Você > Acesso: Qualquer pessoa > copie a URL `/exec`.
4. No GitHub: Settings → Secrets and variables → Actions → crie `PWR_URL_EXEC` (URL `/exec`), `PWR_ORIGEM_TOKEN` (igual ao `Code.gs`) e `PWR_GOOGLE_CLIENT_ID` (igual ao `Code.gs`).
5. Settings → Pages → Source: **GitHub Actions**. Uma alteração enviada à `main` publica `frontend/dist`, com `config.js` gerado dos secrets; o backend nunca vai para o Pages.

## Desenvolvimento local

Requer Node.js 22 e npm. Instale as dependências do frontend e inicie o ambiente local:

```sh
npm ci --prefix frontend
npm run dev
```

Abra [http://localhost:8080](http://localhost:8080). O comando restaura as fixtures locais, gera o backend, compila o frontend e serve a aplicação com API mock em `/exec`.

Credenciais da fixture:

| E-mail | Senha |
| --- | --- |
| `admin@test.com` | `admin123` |

As fixtures ficam em `tests/fixtures/`. `npm run demo:reset` ou `node tests/setup.js` recria esses dados locais.

Comandos disponíveis:

```sh
npm run dev            # build + servidor local com fixtures
npm run build          # gera backend/Code.gs e frontend/dist
npm run build:backend  # gera apenas backend/Code.gs
npm test               # contrato HTTP, domínio e verificações do frontend
npm start              # serve o build já gerado com a API mock
```

Para testar a API real sem criar outro script npm, copie `.env.example` para `.env`, preencha `URL_EXEC`, `ORIGEM_TOKEN` e `GOOGLE_CLIENT_ID`, gere o build e inicie explicitamente o servidor em modo real:

```sh
npm run build
node tests/server.js 8080 real
```

Esse modo grava na planilha real. `.env` e `.env.local` sozinhos continuam usando o mock; isso evita alterações acidentais durante o desenvolvimento.

## Funcionalidades

- Ranking público com filtros por campo, faixa, método, vento e nickname.
- BEST por categoria: campo + faixa + método + vento; menor score vence e Pang resolve empate.
- Cadastro, login por senha e Google, perfil, troca de senha, privacidade e exclusão de conta. Novas contas começam bloqueadas e são liberadas pelo admin em Gerenciar → Revisar pedidos.
- Records com vídeo e print; links de vídeo aceitam YouTube, Twitch, Vimeo, TikTok, Kick, Facebook e Instagram.
- Fluxo de moderação: envio, revisão administrativa, votação comunitária ponderada, reabertura e reavaliação.
- Usuários editam somente score, Pang, vídeo e print; toda alteração passa pelo admin. Em record publicado, score/Pang inicia nova votação comunitária, enquanto provas seguem apenas pela revisão administrativa.
- Painel administrativo para pedidos, records, usuários, redefinição de senha e catálogo.
- Tabelas responsivas, paginação, detalhes expansíveis e carregamento por demanda nas abas administrativas.
- Leituras das abas usam cache de até 60 segundos no Apps Script; cada gravação invalida a aba alterada imediatamente.
- Login por senha limita cinco tentativas falhas por e-mail a cada 15 minutos; sessões encerram após 30 minutos sem atividade.

## Regras de ranking e comunidade

Um record só integra o ranking público quando possui `status=approved` e `community=1`. A aprovação manual pelo administrador também recalcula o BEST da categoria.

A comunidade exige pelo menos três votantes, 50 pontos de peso e mais que o dobro do peso contrário. O dono não vota no próprio record. Administradores seguem as mesmas regras de participação: conta ativa e pelo menos 10 pontos.

## Arquitetura

```text
backend/src/
  modules/
    identity/          # contas, autenticação, sessão e pontos
    catalog/           # campos e faixas de força
    records/           # records, propostas, ranking e BEST
    community/         # votos, decisão e reavaliação
  infrastructure/      # adaptadores Google Apps Script e Sheets
  adapters/http.js     # entrada HTTP e proteção de origem
  composition.js       # composição das dependências
backend/Code.gs        # artefato gerado para Apps Script
frontend/src/
  modules/             # telas por contexto de domínio
  components/          # componentes de interface reutilizáveis
  stores/              # sessão, catálogo, confirmação e notificações
  lib/                 # cliente HTTP, validações e formatadores
tests/                 # fixtures, mock e testes automatizados
```

Leia [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para as portas, limites e decisões. Edite `backend/src`; `backend/Code.gs` é gerado por `npm run build:backend`. O `npm test` confirma que o artefato gerado está sincronizado.

## Publicação

1. Prepare a planilha conforme [docs/SHEETS_SCHEMA.md](docs/SHEETS_SCHEMA.md) e [backend/SHEETS_SETUP.md](backend/SHEETS_SETUP.md).
2. Execute `npm run build:backend` e publique o conteúdo de `backend/Code.gs` no Apps Script vinculado à planilha.
3. No Apps Script, defina `ORIGEM_TOKEN`, `SALT` e `GOOGLE_CLIENT_ID`. Preserve o `SALT` existente em atualizações para não invalidar senhas.
4. Implante como App da Web, executando como o proprietário da planilha, e guarde a URL terminada em `/exec`.
5. No GitHub, configure os secrets `PWR_URL_EXEC`, `PWR_ORIGEM_TOKEN` e `PWR_GOOGLE_CLIENT_ID`.
6. Configure GitHub Pages para usar GitHub Actions. O workflow executa testes, gera `frontend/public/config.js`, compila o frontend e publica `frontend/dist` ao enviar mudanças para `main` ou acioná-lo manualmente.

O workflow não publica o Apps Script. As rotas usam hash, como `#/community`, para funcionar no GitHub Pages. As configurações do navegador são públicas: nunca inclua `SALT`, planilhas ou dados privados nelas.

## Arte e licença

A marca fica em `frontend/src/components/BrandLogo.vue`, o favicon em `frontend/public/favicon.svg` e o hero em `frontend/public/images/pangya-hero.png`. Consulte [docs/VISUAL_ASSETS.md](docs/VISUAL_ASSETS.md) para a origem da ilustração. É uma interpretação visual de fã, sem vínculo oficial com o jogo.

Código sob licença [MIT](LICENSE), preservando a atribuição ao projeto original.

### 🌐 Github Pages

Para usar essa aplicação é só [clicar aqui](https://acrisio-filho.github.io/pangya-world-record/).
