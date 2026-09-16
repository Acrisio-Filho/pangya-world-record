# PangYa World Record

Site estático (GitHub Pages) + API (Google Apps Script) + Banco (Google Sheets privada).

Escolhas do projeto:
- **Stack:** `Sheets + Apps Script`
- **Faixas de força:** configuráveis pelo admin (ex: 230-240, 241-250, 251-260, 261-270 — pode mudar sem mexer no código)

## Estrutura

```
frontend/          # site estático p/ GitHub Pages
  index.html       # lista records + pesquisa (course + faixa + nickname)
  login.html       # login
  register.html    # cadastro de usuário
  submit-record.html # meus records: tabela + enviar/editar (volta p/ pending)
  profile.html     # página do usuário e seus records (?id= ou ?me=1)
  admin.html       # validar / editar records / gerenciar usuários, courses e faixas (só admin)
  community.html   # votação da comunidade (approved do admin)
  css/style.css
  js/config.js     # URL_API + ORIGEM_TOKEN
  js/api.js        # wrapper fetch GET/POST
  js/auth.js       # sessão localStorage
  js/records.js    # listagem + pesquisa
  js/admin.js      # painel admin
backend/
  Code.gs          # API do Apps Script (copiar p/ script vinculado à planilha)
docs/
  SHEETS_SCHEMA.md # colunas exatas de cada aba
```

## Setup rápido

1. Crie a planilha Google com as abas do `docs/SHEETS_SCHEMA.md` (primeira linha = cabeçalho exato).
2. Extensões > Apps Script > cole o `backend/Code.gs` > ajuste `ORIGEM_TOKEN`, `SALT` e `GOOGLE_CLIENT_ID` (console.cloud.google.com → Credenciais → ID do cliente OAuth; autorize a origem do Pages).
3. Implantar > Nova implantação > App da Web > Executar como: Você > Acesso: Qualquer pessoa > copie a URL `/exec`.
4. No GitHub: Settings → Secrets and variables → Actions → crie `PWR_URL_EXEC` (URL `/exec`), `PWR_ORIGEM_TOKEN` (igual ao `Code.gs`) e `PWR_GOOGLE_CLIENT_ID` (igual ao `Code.gs`).
5. Settings → Pages → Source: **GitHub Actions**. `git push` na `main` publica só `frontend/` com `config.js` gerado dos secrets (`backend/` nunca vai para o Pages).

Login: senha ou Google (conta nova pelo Google entra bloqueada até o admin liberar; conta com email vincula no 1º login).

Aviso honesto: secrets escondem os valores do **repo**, não dos **visitantes** (o navegador precisa deles — vão no JS publicado). Segurança real: `SALT` só no Apps Script + `role=admin` checado no servidor.

## Segurança (honesta)

- A planilha fica **Privada**. Só o Apps Script (rodando como você) lê/escreve.
- O `origem` token **não é segurança real** (visível no JS) — é só barreira contra curioso. A segurança real é:
  - senha nunca volta pro cliente (só `pass_hash` no servidor),
  - sessão via token opaco na aba `Sessions`,
  - checagem de `role=admin` **no servidor** em `validateRecord`, `upsertCourse`, `upsertBand`.
- Qualquer um com a URL pode chamar a API — por isso login/validação são verificados no `Code.gs`, nunca no frontend.

## Testes locais (Node + LibreOffice Calc)

Sem deploy: o `Code.gs` real roda em Node com mock do `SpreadsheetApp` sobre CSVs.

- `node tests/run.js` — reseta fixtures e roda as checagens (auth, submit, validação, comunidade, admin, logout).
- `node tests/setup.js` — só reseta os CSVs.
- `node tests/server.js` — frontend em `http://localhost:8080/` (mock se `.env` vazio, planilha real se `.env` tem `URL_EXEC`).
- `node tests/server.js mock` — força mock. `node tests/server.js real` — força real (`.env`). Pode passar porta e/ou URL: `node tests/server.js 8080 mock`.
- `.env` (gitignorado, ver `.env.example`): preencha `URL_EXEC` + `ORIGEM_TOKEN` reais e o `server.js` usa sozinho, sem editar `config.js` e sem precisar passar a URL.
- `libreoffice tests/fixtures/*.csv` — inspeciona/edita as "abas" como planilha. `tests/fixtures/` é gerado (gitignore).

## Fluxo

1. Usuário se cadastra (`register`) → `status=blocked` (não envia records).
2. Admin libera em Gerenciar → Usuários (`setUserStatus=active`).
3. Usuário liberado cadastra record → `pending`. Editar/melhorar um record live cria **proposta** ligada (`edit_of`) — o original segue no index até a proposta passar admin + comunidade, quando os valores são aplicados e a proposta apagada (metade dos pontos).
4. Admin valida (`listPending`), aprova/rejeita e pode **realocar** ou editar depois (`validateRecord`/`updateRecord`). Aprovar paga +10 pontos (1x).
5. Aprovado vai p/ Comunidade: usuários liberados com 10+ pontos votam (peso = pontos, inclusive admin). Quórum: peso 50+, 3+ votantes, >2x o contrário. Aprovado (`community=1`) volta p/ `pending` (+25 pontos) p/ final do admin → World Record (index só `community=1`); rejeitado (`community=-1`) continua aprovado pelo admin, fora do index.
