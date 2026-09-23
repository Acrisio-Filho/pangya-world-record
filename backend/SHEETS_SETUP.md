# Planilha (Google Sheets) — o que fazer e como fazer

O banco é uma planilha Google **Privada**. O `Code.gs` (nesta pasta) roda vinculado a ela.
Detalhe de cada coluna: `docs/SHEETS_SCHEMA.md`.

## O que criar: 6 abas, linha 1 = cabeçalho exato

1. `Users` → `id | nickname | email | pass_hash | role | status | bio | youtube_url | points | created_at | google_sub | avatar_url`
2. `Courses` → `id | name | active`
3. `PowerBands` → `id | label | min | max | active`
4. `Records` → `id | user_id | course_id | powerband_id | power_value | score | pang | method | wind | screenshot_url | video_url | status | submitted_at | validated_by | validated_at | note | is_best | community | pts_admin | pts_com | edited | edit_of`
5. `Sessions` → `token | user_id | expires_at | last_seen_at`
6. `Votes` → `id | record_id | user_id | vote | weight | created_at`

## Como fazer

1. Crie a planilha e as 6 abas acima (copie os cabeçalhos sem renomear).
2. Primeiro admin: cadastre-se pelo site (`#/register`) e depois edite sua linha na aba `Users`: `role=admin`, `status=active`.
3. Extensões > Apps Script > apague tudo > rode `npm run build:backend` e cole o `Code.gs` gerado nesta pasta. Edite as fontes em `backend/src`, não o bundle.
4. Troque `ORIGEM_TOKEN` (texto longo aleatório), `SALT` (outro texto longo) e `GOOGLE_CLIENT_ID` (ID do cliente OAuth) — guarde os três.
5. Implantar > Nova implantação > App da Web > Executar como: **Você** > Acesso: **Qualquer pessoa** > Implantar > autorize > copie a URL `/exec`.
6. Em `frontend/public/config.js`: `URL_API` = URL `/exec`, `ORIGEM_TOKEN` e `GOOGLE_CLIENT_ID` = os mesmos do passo 4.
7. Quando o esquema mudar (ver abaixo), adicione só as colunas/abas novas — nunca apague ou renomeie as existentes (o código antigo ignora colunas que não conhece, mas quebra se faltar).

## Modificações do esquema por commit

| Commit | Mudança no esquema |
|--------|--------------------|
| `4e4d544` | Esquema inicial: abas `Users`, `Courses`, `PowerBands`, `Records`, `Sessions`. |
| `7b4f42b` | `Users.status` (`blocked` inicial, `active` liberado). |
| `40ddd02` | `Records.pang`. |
| `77b8c2a` | `Records.is_best` (calculado pelo backend). |
| `f7c11d0` | `Users.bio`, `Users.youtube_url`. |
| `b1ce4a8` | `Users.points`; `Records.community_ok`, `Records.pts_admin`, `Records.pts_com`; nova aba `Votes`. |
| `6301f5d` | `Records.method` (`sem_ajuda` com vídeo obrigatório, `com_ajuda`). |
| `a7810e8` | `Records.wind` (`normal`, `natural`). |
| `ed48136` | `Records.community_ok` vira `Records.community` (inteiro: 0 não votado, 1 aprovado, -1 rejeitado). Migração: renomeie a coluna, `TRUE`→`1`, vazio→`0`. |
| `521af98` | `Records.edited` (`TRUE` em reenvio após edição). Rejeitado pela comunidade mantém `approved` com `community=-1` (não vira `rejected`). |
| `f3236bb` | `Records.edit_of` (proposta de melhoria ligada ao original; merge na aprovação final, metade dos pontos +5/+12). |
| `c3ffdb4` | `Users.google_sub` (ID da conta Google; vazio quem nunca usou). Migração: adicione a coluna no fim da aba `Users`. |
| Atual | `Users.avatar_url` (foto retornada e validada pelo Google). Migração: adicione a coluna no fim da aba `Users`. |
| Atual | `Sessions.last_seen_at` (controle de inatividade). Migração: adicione a coluna no fim da aba `Sessions`. |
| `8b078f2` | `reopenVote` (só código): admin reabre votação de `-1` (volta aprovado/0, apaga votos). `validateRecord` aceita `community` (`-1`/`0`/`1`). |
| `7f062e8` | Rejeitado pela comunidade volta p/ `pending` (pedido no admin), não fica `approved`. `reopenVote` aceita `pending`. |
| `3573239` | `appealVote` (só código): dono pede reavaliação de `approved/-1` sem editar. |
| `066ed28` | Edição do dono em record votado (`1`/`-1`) zera os votos e volta p/ `0` (só código). |
