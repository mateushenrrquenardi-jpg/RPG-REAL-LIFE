-- Meta mensal de treino em missões principais.
-- Execute após 20260912_secure_writes.sql.

alter table public.quests add column if not exists goal_period_month date;

alter table public.quests drop constraint if exists quests_goal_type_check;
alter table public.quests add constraint quests_goal_type_check
  check (goal_type is null or goal_type in ('livro', 'curso', 'compra', 'treino'));

alter table public.quests drop constraint if exists quests_goal_unit_check;
alter table public.quests add constraint quests_goal_unit_check
  check (goal_unit is null or goal_unit in ('paginas', 'aulas', 'porcentagem', 'horas', 'reais', 'treinos'));

-- A assinatura muda para receber o mês de referência da meta de treino.
drop function if exists public.save_quest(uuid, text, text, text, integer, text, text, text, numeric, numeric);

create function public.save_quest(
  p_quest_id uuid,
  p_nome text,
  p_tipo text,
  p_atributo text,
  p_weekly_target integer default 7,
  p_goal_type text default null,
  p_goal_target_name text default null,
  p_goal_unit text default null,
  p_goal_total numeric default null,
  p_goal_current numeric default 0,
  p_goal_period_month date default null
)
returns public.quests language plpgsql security definer set search_path = public as $$
declare
  v_quest public.quests;
begin
  if nullif(trim(p_nome), '') is null or char_length(trim(p_nome)) > 160 then raise exception 'Nome da quest inválido'; end if;
  if p_tipo not in ('side', 'principal', 'diaria') then raise exception 'Tipo de quest inválido'; end if;
  if p_atributo not in ('forca', 'magia', 'carisma', 'inteligencia') then raise exception 'Atributo inválido'; end if;
  if p_weekly_target not between 1 and 7 then raise exception 'Meta semanal inválida'; end if;

  if p_tipo <> 'principal' then
    p_goal_type := null; p_goal_target_name := null; p_goal_unit := null; p_goal_total := null; p_goal_current := 0; p_goal_period_month := null;
  elsif p_goal_type is not null then
    if p_goal_type not in ('livro', 'curso', 'compra', 'treino') then raise exception 'Tipo de meta inválido'; end if;
    if nullif(trim(p_goal_target_name), '') is null or char_length(trim(p_goal_target_name)) > 160 then raise exception 'Nome da meta inválido'; end if;
    if p_goal_total is null or p_goal_total <= 0 or p_goal_current < 0 or p_goal_current > p_goal_total then raise exception 'Valores de progresso inválidos'; end if;
    if (p_goal_type = 'livro' and p_goal_unit <> 'paginas')
      or (p_goal_type = 'curso' and p_goal_unit not in ('aulas', 'porcentagem', 'horas'))
      or (p_goal_type = 'compra' and p_goal_unit <> 'reais')
      or (p_goal_type = 'treino' and p_goal_unit <> 'treinos') then raise exception 'Unidade de meta inválida'; end if;
    if p_goal_type = 'treino' then
      if p_goal_period_month is null then raise exception 'Mês de referência do treino inválido'; end if;
      p_goal_period_month := date_trunc('month', p_goal_period_month)::date;
    else
      p_goal_period_month := null;
    end if;
  else
    p_goal_target_name := null; p_goal_unit := null; p_goal_total := null; p_goal_current := 0; p_goal_period_month := null;
  end if;

  if p_quest_id is null then
    insert into public.quests (user_id, nome, tipo, atributo, weekly_target, goal_type, goal_target_name, goal_unit, goal_total, goal_current, goal_period_month)
    values (auth.uid(), trim(p_nome), p_tipo, p_atributo, case when p_tipo = 'diaria' then p_weekly_target else 7 end, p_goal_type, nullif(trim(p_goal_target_name), ''), p_goal_unit, p_goal_total, p_goal_current, p_goal_period_month)
    returning * into v_quest;
  else
    select * into v_quest from public.quests where id = p_quest_id and user_id = auth.uid() for update;
    if not found then raise exception 'Quest não encontrada'; end if;
    update public.quests set nome = trim(p_nome), tipo = p_tipo, atributo = p_atributo,
      weekly_target = case when p_tipo = 'diaria' then p_weekly_target else 7 end,
      goal_type = p_goal_type, goal_target_name = nullif(trim(p_goal_target_name), ''), goal_unit = p_goal_unit,
      goal_total = p_goal_total, goal_current = p_goal_current, goal_period_month = p_goal_period_month
    where id = p_quest_id returning * into v_quest;
    if p_goal_type is not null then
      perform public.update_main_quest_progress(p_quest_id, p_goal_current);
      select * into v_quest from public.quests where id = p_quest_id;
    end if;
  end if;
  return v_quest;
end;
$$;

create or replace function public.get_hero_overview()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'completed_activity_count', (select count(*) from public.history where user_id = auth.uid()),
    'completed_quest_count', (select count(*) from public.quests where user_id = auth.uid() and status = 'concluida'),
    'books_read', (select count(*) from public.quests where user_id = auth.uid() and goal_type = 'livro' and goal_total > 0 and goal_current >= goal_total),
    'courses_completed', (select count(*) from public.quests where user_id = auth.uid() and goal_type = 'curso' and goal_total > 0 and goal_current >= goal_total),
    'workout_goals_completed', (select count(*) from public.quests where user_id = auth.uid() and goal_type = 'treino' and goal_total > 0 and goal_current >= goal_total),
    'purchase_goals_completed', (select count(*) from public.quests where user_id = auth.uid() and goal_type = 'compra' and goal_total > 0 and goal_current >= goal_total),
    'gold_earned', (select coalesce(sum(amount), 0) from public.gold_transactions where user_id = auth.uid() and transaction_type = 'credit')
  );
$$;

grant execute on function public.save_quest(uuid, text, text, text, integer, text, text, text, numeric, numeric, date) to authenticated;
grant execute on function public.get_hero_overview() to authenticated;
