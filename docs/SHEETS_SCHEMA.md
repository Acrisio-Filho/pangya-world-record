# Schema das abas (Google Sheets)

Crie uma planilha privada com estas 6 abas. A linha 1 de cada aba deve ter exatamente estes cabeçalhos.

## 1. Users
`id | nickname | email | pass_hash | role | status | bio | youtube_url | points | created_at | google_sub`

- `id`: uuid (gerado pelo backend)
- `nickname`: único, máx 22 caracteres (unicode), exibido no ranking e no profile
- `email`: único, lowercase
- `pass_hash`: SHA256(salt + senha) — nunca expor via API
- `role`: `user` ou `admin` (primeiro admin criado manual na planilha)
- `status`: `blocked` (inicial do cadastro — não envia records) ou `active` (liberado pelo admin)
- `bio`: info/comentário do usuário (editável no perfil)
- `youtube_url`: link do canal — só YouTube (`youtube.com`/`youtu.be`), outros sites bloqueados no servidor
- `points`: bônus por eventos (+10 admin-ok, +25 comunidade-ok). Pontos efetivos = bônus +5/mês de conta (teto 60); peso do voto, mínimo 10 p/ votar
- `created_at`: ISO string
- `google_sub`: ID estável da conta Google (login Google; vazio quem nunca usou). Conta antiga vincula pelo email verificado no 1º login

## 2. Courses
`id | name | active`

- Ex: `blue_water | Blue Water | TRUE`
- Admin cadastra pelo `admin.html` (upsertCourse).

## 3. PowerBands
`id | label | min | max | active`

- Ex: `b230_240 | 230-240 | 230 | 240 | TRUE`
- Faixas configuráveis — admin edita sem mexer no código.
- Na submissão, o backend pode auto-detectar a faixa pelo `power_value`, mas permite correção manual/admin realocar.

## 4. Records
`id | user_id | course_id | powerband_id | power_value | score | pang | method | wind | screenshot_url | video_url | status | submitted_at | validated_by | validated_at | note | is_best | community | pts_admin | pts_com | edited | edit_of`

- `score`: menor = melhor (ex: -25). Ajuste a ordenação no frontend se for diferente.
- `pang`: valor em pang do record (ex: 12500).
- `method`: `sem_ajuda` (só o jogo aberto, vídeo de prova obrigatório) ou `com_ajuda` (com programas). Faz parte da identidade do record e da categoria do best.
- `wind`: `normal` ou `natural`. Faz parte da identidade do record e da categoria do best.
- `is_best`: `TRUE` no melhor approved da categoria (course+faixa) — menor score, empate maior pang. Calculado pelo backend a cada validação/edição; não editar à mão.
- `community`: inteiro do voto da comunidade — `0` não votado, `1` aprovado (volta p/ `pending` p/ final do admin), `-1` rejeitado (volta p/ `pending` p/ revisão do admin, fora do index/best). O admin define via edição (`validateRecord community`: reprovado/-1, não votado/0, aprovado/1) ou reabre a votação (`reopenVote`, apaga votos). Edição do dono em votado zera os votos e volta p/ `0` (vota a versão nova); apelação sem editar preserva os votos. Só com `1` o record entra no index e conta p/ `is_best`.
- `edited`: `TRUE` quando o record foi reenviado após edição (dono). Pendings mostram origem: novo pedido, edição ou decisão final da comunidade.
- `edit_of`: id do record original quando a linha é proposta de melhoria (edição de record live). Original segue valendo até a proposta passar admin + comunidade; na aprovação final os valores são copiados e a proposta apagada. Rejeitada entra no histórico. Melhoria paga metade dos pontos (+5/+12).
- `pts_admin` / `pts_com`: flags de pontos já pagos (+10 / +25); não editar à mão.

## 6. Votes
`id | record_id | user_id | vote | weight | created_at`

- `vote`: `approve` ou `reject` (1 por usuário/record; revotar atualiza).
- `weight`: pontos do votante no momento do voto. Quórum: peso 50+, 3+ votantes e >2x o lado contrário.
- `status`: `pending | approved | rejected`
- `power_value`: força informada (ex: 245) — deve cair dentro do `min/max` da faixa, senão admin realoca.
- `validated_by`: nickname/email do admin.

## 5. Sessions
`token | user_id | expires_at`

- `token`: uuid, guardado no `localStorage` do navegador.
- `expires_at`: +30 dias. Logout apaga a linha.
