-- Migration: Contador de semanas de sucesso para rotinas diárias
-- Cada ciclo semanal inicia no domingo (fuso America/Manaus).
-- Semanas passadas concluídas com sucesso (>= weekly_target) são contabilizadas sequencialmente.

-- 1. Função auxiliar para calcular semanas consecutivas de sucesso anteriores à semana atual
create or replace function public.calculate_successful_weeks(p_quest_id uuid, p_weekly_target integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := coalesce(public.rpg_today(), current_date);
  v_week_start date := v_today - extract(dow from v_today)::integer;
  v_weeks integer := 0;
  v_count integer;
  v_check_start date;
  v_check_end date;
begin
  if p_weekly_target is null or p_weekly_target < 1 then
    return 0;
  end if;

  loop
    v_weeks := v_weeks + 1;
    v_check_start := v_week_start - (v_weeks * 7);
    v_check_end := v_check_start + 6;

    select count(*) into v_count
    from public.daily_completions
    where quest_id = p_quest_id
      and completed_on >= v_check_start
      and completed_on <= v_check_end;

    if v_count < p_weekly_target then
      return v_weeks - 1;
    end if;

    -- Proteção contra loops excessivos (até 520 semanas = 10 anos)
    if v_weeks >= 520 then
      return v_weeks;
    end if;
  end loop;
end;
$$;

-- 2. Atualizar get_daily_routine_state para expor successful_weeks
-- É necessário dropar primeiro pois o tipo de retorno da tabela é alterado (adiciona successful_weeks).
drop function if exists public.get_daily_routine_state();

create or replace function public.get_daily_routine_state()
returns table (
  quest_id uuid,
  weekly_completed integer,
  routine_days integer,
  routine_fixed boolean,
  successful_weeks integer
)
language sql security definer set search_path = public as $$
  select q.id,
    count(dc.completed_on) filter (
      where dc.completed_on >= (coalesce(public.rpg_today(), current_date) - extract(dow from coalesce(public.rpg_today(), current_date))::integer)
        and dc.completed_on <= coalesce(public.rpg_today(), current_date)
    )::integer as weekly_completed,
    count(dc.completed_on) filter (
      where dc.completed_on >= q.routine_started_on
        and dc.completed_on <= coalesce(public.rpg_today(), current_date)
    )::integer as routine_days,
    q.routine_fixed,
    public.calculate_successful_weeks(q.id, q.weekly_target) as successful_weeks
  from public.quests q
  left join public.daily_completions dc on dc.quest_id = q.id
  where q.user_id = auth.uid() and q.tipo = 'diaria'
  group by q.id, q.routine_started_on, q.routine_fixed, q.weekly_target;
$$;

-- 3. Atualizar refresh_daily_routines para manter consistência de fuso horário
create or replace function public.refresh_daily_routines()
returns void language plpgsql security definer set search_path = public as $$
declare
  q public.quests;
  v_today date := coalesce(public.rpg_today(), current_date);
  week_start date := v_today - extract(dow from v_today)::integer;
  completed_last_week integer;
  stage_days integer;
begin
  for q in select * from public.quests where user_id = auth.uid() and tipo = 'diaria' loop
    if q.weekly_target = 7 then
      if q.routine_started_on < v_today and exists (
        select 1 from generate_series(q.routine_started_on, v_today - 1, interval '1 day') as required(day)
        where not exists (
          select 1 from public.daily_completions dc where dc.quest_id = q.id and dc.completed_on = required.day::date
        )
      ) then
        update public.quests set routine_started_on = v_today, routine_fixed = false where id = q.id;
        q.routine_started_on := v_today;
        q.routine_fixed := false;
      end if;
    elsif q.routine_started_on < week_start then
      select count(*) into completed_last_week from public.daily_completions
        where quest_id = q.id and completed_on >= week_start - 7 and completed_on < week_start;
      if completed_last_week < q.weekly_target then
        update public.quests set routine_started_on = week_start, routine_fixed = false where id = q.id;
        q.routine_started_on := week_start;
        q.routine_fixed := false;
      end if;
    end if;

    stage_days := public.routine_stage_days(q.routine_level);
    if v_today - q.routine_started_on >= stage_days then
      if q.routine_level < 5 then
        update public.quests set routine_level = q.routine_level + 1, routine_started_on = v_today, routine_fixed = false where id = q.id;
      else
        update public.quests set routine_fixed = true where id = q.id;
      end if;
    end if;

    update public.quests set status = case when exists (
      select 1 from public.daily_completions dc where dc.quest_id = q.id and dc.completed_on = v_today
    ) then 'concluida' else 'ativa' end, completed_at = case when exists (
      select 1 from public.daily_completions dc where dc.quest_id = q.id and dc.completed_on = v_today
    ) then coalesce(completed_at, now()) else null end where id = q.id;
  end loop;
end;
$$;

-- Permissões
grant execute on function public.calculate_successful_weeks(uuid, integer) to authenticated;
grant execute on function public.get_daily_routine_state() to authenticated;
grant execute on function public.refresh_daily_routines() to authenticated;
