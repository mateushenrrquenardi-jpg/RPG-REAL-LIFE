# Ordem de migrations

Execute no SQL Editor do Supabase, uma única vez e exatamente nesta ordem. Não execute arquivos antigos depois dos mais recentes: alguns deles redefinem funções como `complete_quest`.

1. `20260906_daily_routines.sql`
2. `20260906_fix_routine_timezone.sql`
3. `20260907_main_quest_goals.sql`
4. `20260910_goal_compra.sql`
5. `20260910_gold_rewards.sql`
6. `20260910_gold_side_quests.sql`
7. `20260911_gold_on_levelup.sql`
8. `20260911_gold_routine_milestones.sql`
9. `20260912_main_quest_gold_milestones.sql`
10. `20260912_gold_ledger_store.sql`
11. `20260912_secure_writes.sql`

## Convenções

- Migrations são aditivas e não devem ser editadas após entrar em produção.
- Toda mudança futura de banco deve receber um novo arquivo datado nesta pasta.
- Faça backup antes de executar migrations em um banco com dados reais.
- O código do site deve ser publicado somente depois das migrations necessárias estarem aplicadas.

## Conferência pós-migration

Depois da etapa 11, valide: criar/editar/remover uma quest, registrar progresso, concluir uma quest, criar/remover um Custom Contract e resgatar uma recompensa. Também confirme que GOLD, EXP e atributos continuam sendo atualizados apenas pelas funções do banco.
