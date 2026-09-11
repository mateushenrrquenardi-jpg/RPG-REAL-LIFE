# Contexto de continuidade

## Arquitetura atual

O site e GitHub Pages; os dados estao no projeto Supabase `eddapoexxzlxicqkvxts` (PostgreSQL, Sao Paulo).

| Item | Papel |
| --- | --- |
| `db.js` | Cliente Supabase, autenticacao e operacoes do banco (CRUD quests, metas e progresso). |
| `app.js` | Interface assincrona, login, rotinas e metas de missoes principais. |
| `profiles`, `quests`, `history` | Tabelas do banco. |
| `complete_quest` | Transacao atomica para concluir quest, EXP, atributos e log. |
| `updateQuestProgress` | Atualizacao do progresso da meta mensuravel na tabela `quests`. |
| `reset_daily_quests`, `reset_rpg` | Operacoes atomicas de reset. |

RLS esta habilitado nas tres tabelas. Nunca use nem versione uma `secret key`; somente a publishable key pode estar no frontend.

## Migrations SQL (pasta `supabase/`)
- `20260906_daily_routines.sql`: Sistema de rotinas com ciclos semanais.
- `20260906_fix_routine_timezone.sql`: Ajuste de fuso para America/Manaus.
- `20260907_main_quest_goals.sql`: Colunas de meta mensuravel para missoes principais (`goal_type`, `goal_target_name`, `goal_unit`, `goal_total`, `goal_current`).
- `20260910_goal_compra.sql`: Tipo de meta 'compra' e unidade 'reais'.
- `20260910_gold_rewards.sql`: Sistema de recompensas financeiras em GOLD (+7 GOLD por diaria concluida).
- `20260910_gold_side_quests.sql`: Recompensa de +3 GOLD ao concluir side quests.
- `20260911_gold_on_levelup.sql`: Recompensa de GOLD no Level UP igual ao XP necessario para upar.

## Validacao

1. `node --check db.js` e `node --check app.js`.
2. Crie uma conta no site e entre.
3. Crie, conclua, remova e resete uma quest diaria.
4. Crie uma Missao Principal com meta de Livro ou Curso, atualize o progresso via modal e conclua.
5. Confira que outro usuario nao consegue ler os dados da primeira conta.

## Prompt de retomada

> Mantenha o RPG Real Life, um GitHub Pages com Supabase. Leia README.md e CONTINUIDADE.md. Preserve RLS e nao exponha chaves secretas. Antes de publicar, valide a sintaxe JavaScript e teste autenticacao e CRUD no Supabase.
