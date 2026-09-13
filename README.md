# RPG Real Life

Aplicação pessoal estática hospedada no GitHub Pages, com autenticação e dados no Supabase.

**Produção:** https://mateushenrrquenardi-jpg.github.io/RPG-REAL-LIFE/

## Fonte canônica

Este diretório (`_github_repo`) é a única fonte publicada. Trabalhe, teste, faça commit e publique a partir dele. A pasta pai é apenas o workspace local e não deve ser usada para deploy.

## Arquitetura

- GitHub Pages: interface estática.
- Supabase Auth: conta e sessão.
- Supabase Postgres: perfil, quests, histórico, GOLD e recompensas personalizadas.
- PostgreSQL RPCs: conclusão de quest, progresso de metas, resgate, criação/edição/exclusão de quests e contratos.
- RLS + permissões SQL: cada pessoa acessa apenas os próprios dados; operações críticas não aceitam escrita direta do navegador.

A chave no `db.js` é pública por definição. A proteção está nas políticas RLS, nos privilégios de tabela e nas funções do PostgreSQL; nunca adicione uma `service_role` ao front-end.

## Estrutura

```text
js/constants.js  Catálogo e constantes do jogo
js/rules.js      Regras puras e testáveis de progresso/marcos
db.js            Camada de acesso ao Supabase
app.js           Orquestração da interface
supabase/        Migrations SQL ordenadas
test/            Testes das regras puras
```

## Banco de dados

Execute as migrations na ordem definida em [supabase/MIGRATIONS.md](supabase/MIGRATIONS.md). Em instalações já existentes, execute os arquivos ainda não aplicados, principalmente:

1. `20260912_gold_ledger_store.sql`
2. `20260912_secure_writes.sql`

Esses arquivos são necessários antes de publicar uma interface que use loja, painel ou as novas operações seguras.

## Desenvolvimento e validação

Não há dependências de build. Com Node instalado:

```powershell
npm run check
npm test
npm run verify
```

Para testar a interface, sirva esta pasta por HTTP. O deploy acontece ao enviar commits para a branch `main`.

## Backup

A aba Config exporta perfil, quests, histórico, extrato de GOLD, contratos e preferências em JSON. O reset afeta somente a conta autenticada.
