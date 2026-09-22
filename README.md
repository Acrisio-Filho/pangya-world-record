# Pangya World Record

Ranking da comunidade de Pangya, com frontend Vue 3 e um backend modular implantado como uma única aplicação Google Apps Script. Os dados continuam em uma planilha privada Google Sheets, compatível com o projeto [original de Acrisio Filho](https://acrisio-filho.github.io/pangya-world-record/).

## Rodar localmente

Requer Node.js 22 e npm. Na raiz:

```sh
npm ci --prefix frontend
npm run dev
```

Abra **http://localhost:8080/pangya-world-record/**. O comando gera o backend, compila o frontend e inicia a API local com CSVs em `tests/fixtures/`, inclusive quando existe `.env` ou `.env.local`. Para apontar temporariamente para a planilha real, configure `.env` a partir de `.env.production.example` e execute `npm run dev:real`.

O administrador de desenvolvimento é `admin@test.com`, senha `admin123`. Esta conta existe apenas nas fixtures locais. Uma instalação limpa começa sem records; cadastre/envie records pelo fluxo normal. `node tests/setup.js` **reseta** todos os dados locais de teste.

Para trabalhar com atualização automática do frontend, mantenha a API local em execução e, em outro terminal, rode `npm --prefix frontend run dev`. O proxy do Vite encaminha `/exec` para a API local.

```sh
npm test               # contrato HTTP + fluxos completos + domínio + links seguros
npm run build          # gera Code.gs e frontend/dist
npm run build:backend  # somente bundle do Apps Script
npm start              # serve o build com mock; use PWR_DATA_MODE=real para API real
npm run dev:real       # desenvolvimento contra a API real (inclui Google OAuth)
```

O teste de integração usa um diretório temporário isolado e não altera `tests/fixtures/` nem acessa sua planilha Google. Dados de verificações antigas podem continuar em `tests/fixtures/`; eles só são apagados se você executar explicitamente `node tests/setup.js`. `.env` e `.env.local` mantêm o mock por padrão; `PWR_DATA_MODE=real` é a escolha explícita para a API real.

## Funcionalidades

- Ranking público por campo, faixa de força, método, vento e nickname; menor score primeiro e maior Pang como desempate.
- Layout responsivo, logo vetorial, hero ilustrado, navegação por teclado, filtros e estados de carregamento, erro e lista vazia.
- Cadastro, login por senha ou Google, perfil e sessão revalidada pelo servidor.
- Envio e edição de records com provas. Sem ajuda exige vídeo; contas novas precisam de liberação.
- Melhorias em records publicados viram propostas, preservando o original até a aprovação final.
- Votação ponderada, revisão administrativa, reabertura e pedidos de reavaliação.
- Gestão de usuários, campos, faixas e records.

## Estrutura e arquitetura

```text
backend/src/
  modules/
    identity/          # contas, autenticação e pontos
    catalog/           # campos e faixas de força
    records/           # record, proposta, ranking e moderação
    community/         # votos e reavaliação
  infrastructure/      # adaptadores Google e persistência
  adapters/http.js     # entrada HTTP, parsing, origem e lock
  composition.js       # composição e injeção das dependências
backend/Code.gs        # artefato GERADO para implantação
frontend/src/
  modules/             # apresentação agrupada por contexto
  components/          # componentes visuais compartilhados
  stores/              # sessão, categorias e notificações
  lib/                 # cliente HTTP e formatação
scripts/               # build e configuração de publicação
tests/                 # testes de domínio, contrato e mock de persistência
```

Leia [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para limites dos módulos, portas, regras e decisões da migração. Edite `backend/src`, nunca o bundle gerado. `npm test` verifica se `Code.gs` corresponde às fontes.

## Google Sheets e publicação

1. Prepare as abas descritas em [docs/SHEETS_SCHEMA.md](docs/SHEETS_SCHEMA.md) e siga [backend/SHEETS_SETUP.md](backend/SHEETS_SETUP.md).
2. Execute `npm run build:backend` e cole `backend/Code.gs` no Apps Script vinculado à planilha.
3. Configure `ORIGEM_TOKEN`, `SALT` e `GOOGLE_CLIENT_ID` na cópia implantada; preserve o SALT existente ao atualizar para não invalidar senhas. Guarde esses valores fora do repositório.
4. Implante como App da Web, executando como você, e copie a URL `/exec`.
5. Configure os secrets do GitHub: `PWR_URL_EXEC`, `PWR_ORIGEM_TOKEN` e, para login Google, `PWR_GOOGLE_CLIENT_ID`.
6. Em Settings → Pages, selecione GitHub Actions. O workflow testa, gera `frontend/public/config.js`, compila Vite e publica **apenas `frontend/dist`** quando você acionar a publicação ou enviar alterações à `main`.

O workflow não implanta o Apps Script: essa etapa é separada. As rotas usam hash (`#/community`) para funcionar ao recarregar no GitHub Pages. Configurações do navegador são públicas; a autorização é feita no backend. Não publique SALT, dados da planilha ou fixtures.

Para testar contra a API real, copie `.env.example` para `.env`, preencha os valores e execute `npm run build` seguido de `node tests/server.js 8080 real`. Esse modo grava na planilha real ao usar os formulários.

## Regras preservadas

Uma categoria é campo + faixa de força + método + vento. Os estados de moderação e comunidade são separados: a publicação exige `status=approved` e `community=1`.

A comunidade exige ao menos três votantes, peso de 50 e mais que o dobro do peso contrário. O proprietário não vota no próprio record. A aprovação comunitária volta à revisão final do administrador. Uma nova versão invalida votos da versão anterior. Os pontos e os valores pagos por propostas mantêm as regras do projeto original.

## Arte e autoria

A marca vetorial fica em `frontend/src/components/BrandLogo.vue` e `frontend/public/favicon.svg`. O hero fica em `frontend/public/images/pangya-hero.png`. Consulte [docs/VISUAL_ASSETS.md](docs/VISUAL_ASSETS.md) para o prompt e a origem da ilustração. É uma interpretação visual de fã, não material oficial do jogo.

Código sob licença [MIT](LICENSE), preservando a atribuição ao projeto original.
