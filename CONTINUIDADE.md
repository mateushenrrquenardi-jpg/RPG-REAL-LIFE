# Contexto de continuidade

## Arquitetura atual

O site e GitHub Pages; os dados estao no projeto Supabase `eddapoexxzlxicqkvxts` (PostgreSQL, Sao Paulo).

| Item | Papel |
| --- | --- |
| `db.js` | Cliente Supabase, autenticacao e operacoes do banco. |
| `app.js` | Interface assincrona e login. |
| `profiles`, `quests`, `history` | Tabelas do banco. |
| `complete_quest` | Transacao atomica para concluir quest, EXP, atributos e log. |
| `reset_daily_quests`, `reset_rpg` | Operacoes atomicas de reset. |

RLS esta habilitado nas tres tabelas. Nunca use nem versione uma `secret key`; somente a publishable key pode estar no frontend.

## Validacao

1. `node --check db.js` e `node --check app.js`.
2. Crie uma conta no site e entre.
3. Crie, conclua, remova e resete uma quest diaria.
4. Confira que outro usuario nao consegue ler os dados da primeira conta.

## Prompt de retomada

> Mantenha o RPG Real Life, um GitHub Pages com Supabase. Leia README.md e CONTINUIDADE.md. Preserve RLS e nao exponha chaves secretas. Antes de publicar, valide a sintaxe JavaScript e teste autenticacao e CRUD no Supabase.
