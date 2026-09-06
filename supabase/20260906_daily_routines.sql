-- Sistema de rotinas diarias: ciclos iniciam no domingo.
alter table public.quests
  add column if not exists weekly_target integer not null default 7 check (weekly_target between 1 and 7),
  add column if not exists routine_level integer not null default 1 check (routine_level between 1 and 5),
  add column if not exists routine_started_on date not null default current_date,
  add column if not exists routine_fixed boolean not null default false;

create table if not exists public.daily_completions (
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (quest_id, completed_on)
);

create index if not exists daily_completions_user_date_idx on public.daily_completions (user_id, completed_on);
alter table public.daily_completions enable row level security;

-- As diarias existentes passam a exigir presenca todos os dias e iniciam ciclo novo.
update public.quests
set weekly_target = 7, routine_level = 1, routine_started_on = current_date, routine_fixed = false, status = 'ativa', completed_at = null
where tipo = 'diaria';

create or replace function public.routine_stage_days(p_level integer)
returns integer language sql immutable as $$
  select case p_level when 1 then 14 when 2 then 28 when 3 then 56 when 4 then 91 else 182 end;
$$;

create or replace function public.refresh_daily_routines()
returns void language plpgsql security definer set search_path = public as $$
declare
  q public.quests;
  week_start date := current_date - extract(dow from current_date)::integer;
  completed_last_week integer;
  stage_days integer;
begin
  for q in select * from public.quests where user_id = auth.uid() and tipo = 'diaria' loop
    if q.weekly_target = 7 then
      if q.routine_started_on < current_date and exists (
        select 1 from generate_series(q.routine_started_on, current_date - 1, interval '1 day') as required(day)
        where not exists (
          select 1 from public.daily_completions dc where dc.quest_id = q.id and dc.completed_on = required.day::date
        )
      ) then
        update public.quests set routine_started_on = current_date, routine_fixed = false where id = q.id;
        q.routine_started_on := current_date;
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
    if current_date - q.routine_started_on >= stage_days then
      if q.routine_level < 5 then
        update public.quests set routine_level = q.routine_level + 1, routine_started_on = current_date, routine_fixed = false where id = q.id;
      else
        update public.quests set routine_fixed = true where id = q.id;
      end if;
    end if;

    update public.quests set status = case when exists (
      select 1 from public.daily_completions dc where dc.quest_id = q.id and dc.completed_on = current_date
    ) then 'concluida' else 'ativa' end, completed_at = case when exists (
      select 1 from public.daily_completions dc where dc.quest_id = q.id and dc.completed_on = current_date
    ) then coalesce(completed_at, now()) else null end where id = q.id;
  end loop;
end;
$$;

create or replace function public.get_daily_routine_state()
returns table (quest_id uuid, weekly_completed integer, routine_days integer, routine_fixed boolean)
language sql security definer set search_path = public as $$
  select q.id,
    count(dc.completed_on) filter (where dc.completed_on >= current_date - extract(dow from current_date)::integer and dc.completed_on <= current_date)::integer,
    count(dc.completed_on) filter (where dc.completed_on >= q.routine_started_on and dc.completed_on <= current_date)::integer,
    q.routine_fixed
  from public.quests q
  left join public.daily_completions dc on dc.quest_id = q.id
  where q.user_id = auth.uid() and q.tipo = 'diaria'
  group by q.id, q.routine_started_on, q.routine_fixed;
$$;

create or replace function public.complete_quest(p_quest_id uuid)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_quest public.quests;
  v_profile public.profiles;
  v_exp integer;
  v_pontos integer;
begin
  perform public.refresh_daily_routines();
  select * into v_quest from public.quests where id = p_quest_id and user_id = auth.uid() and status = 'ativa' for update;
  if not found then raise exception 'Quest nao encontrada ou ja concluida'; end if;
  if v_quest.tipo = 'diaria' then
    insert into public.daily_completions (quest_id, user_id, completed_on) values (v_quest.id, auth.uid(), current_date);
  end if;
  v_exp := case when v_quest.tipo = 'principal' then 30 else 10 end;
  v_pontos := case when v_quest.tipo = 'principal' then 3 else 1 end;
  update public.quests set status = 'concluida', completed_at = now() where id = v_quest.id;
  select * into v_profile from public.profiles where user_id = auth.uid() for update;
  v_profile.exp_atual := v_profile.exp_atual + v_exp;
  case v_quest.atributo when 'forca' then v_profile.forca := v_profile.forca + v_pontos; when 'magia' then v_profile.magia := v_profile.magia + v_pontos; when 'carisma' then v_profile.carisma := v_profile.carisma + v_pontos; when 'inteligencia' then v_profile.inteligencia := v_profile.inteligencia + v_pontos; end case;
  while v_profile.exp_atual >= v_profile.exp_necessaria loop v_profile.exp_atual := v_profile.exp_atual - v_profile.exp_necessaria; v_profile.nivel := v_profile.nivel + 1; v_profile.exp_necessaria := round(v_profile.exp_necessaria * 1.2); end loop;
  update public.profiles set nivel = v_profile.nivel, exp_atual = v_profile.exp_atual, exp_necessaria = v_profile.exp_necessaria, forca = v_profile.forca, magia = v_profile.magia, carisma = v_profile.carisma, inteligencia = v_profile.inteligencia, updated_at = now() where user_id = auth.uid();
  insert into public.history (user_id, acao, exp_ganho, atributo, pontos, nivel_atual) values (auth.uid(), v_quest.nome, v_exp, v_quest.atributo, v_pontos, v_profile.nivel);
  return v_profile;
end;
$$;

create or replace function public.reset_daily_quests()
returns integer language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_daily_routines();
  return 0;
end;
$$;

grant execute on function public.refresh_daily_routines() to authenticated;
grant execute on function public.get_daily_routine_state() to authenticated;
grant execute on function public.complete_quest(uuid) to authenticated;
grant execute on function public.reset_daily_quests() to authenticated;
