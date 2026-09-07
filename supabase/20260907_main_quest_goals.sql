-- Metas mensuraveis opcionais para missoes principais
alter table public.quests
  add column if not exists goal_type text check (goal_type is null or goal_type in ('livro', 'curso')),
  add column if not exists goal_target_name text,
  add column if not exists goal_unit text check (goal_unit is null or goal_unit in ('paginas', 'aulas', 'porcentagem', 'horas')),
  add column if not exists goal_total numeric check (goal_total is null or goal_total > 0),
  add column if not exists goal_current numeric not null default 0 check (goal_current >= 0);
