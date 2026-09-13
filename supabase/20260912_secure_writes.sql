-- Proteções de integridade: comandos do navegador passam por RPCs validadas.
-- Execute após as migrations existentes.

alter table public.quests drop constraint if exists quests_tipo_valid_check;
alter table public.quests add constraint quests_tipo_valid_check check (tipo in ('side', 'principal', 'diaria')) not valid;
alter table public.quests drop constraint if exists quests_atributo_valid_check;
alter table public.quests add constraint quests_atributo_valid_check check (atributo in ('forca', 'magia', 'carisma', 'inteligencia')) not valid;
alter table public.quests drop constraint if exists quests_status_valid_check;
alter table public.quests add constraint quests_status_valid_check check (status in ('ativa', 'concluida')) not valid;
alter table public.quests drop constraint if exists quests_goal_progress_valid_check;
alter table public.quests add constraint quests_goal_progress_valid_check check (goal_total is null or goal_current <= goal_total) not valid;
alter table public.profiles drop constraint if exists profiles_gold_nonnegative_check;
alter table public.profiles add constraint profiles_gold_nonnegative_check check (gold >= 0) not valid;

create or replace function public.save_quest(
  p_quest_id uuid,
  p_nome text,
  p_tipo text,
  p_atributo text,
  p_weekly_target integer default 7,
  p_goal_type text default null,
  p_goal_target_name text default null,
  p_goal_unit text default null,
  p_goal_total numeric default null,
  p_goal_current numeric default 0
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
    p_goal_type := null; p_goal_target_name := null; p_goal_unit := null; p_goal_total := null; p_goal_current := 0;
  elsif p_goal_type is not null then
    if p_goal_type not in ('livro', 'curso', 'compra') then raise exception 'Tipo de meta inválido'; end if;
    if nullif(trim(p_goal_target_name), '') is null or char_length(trim(p_goal_target_name)) > 160 then raise exception 'Nome da meta inválido'; end if;
    if p_goal_total is null or p_goal_total <= 0 or p_goal_current < 0 or p_goal_current > p_goal_total then raise exception 'Valores de progresso inválidos'; end if;
    if (p_goal_type = 'livro' and p_goal_unit <> 'paginas')
      or (p_goal_type = 'curso' and p_goal_unit not in ('aulas', 'porcentagem', 'horas'))
      or (p_goal_type = 'compra' and p_goal_unit <> 'reais') then raise exception 'Unidade de meta inválida'; end if;
  else
    p_goal_target_name := null; p_goal_unit := null; p_goal_total := null; p_goal_current := 0;
  end if;

  if p_quest_id is null then
    insert into public.quests (user_id, nome, tipo, atributo, weekly_target, goal_type, goal_target_name, goal_unit, goal_total, goal_current)
    values (auth.uid(), trim(p_nome), p_tipo, p_atributo, case when p_tipo = 'diaria' then p_weekly_target else 7 end, p_goal_type, nullif(trim(p_goal_target_name), ''), p_goal_unit, p_goal_total, p_goal_current)
    returning * into v_quest;
  else
    select * into v_quest from public.quests where id = p_quest_id and user_id = auth.uid() for update;
    if not found then raise exception 'Quest não encontrada'; end if;
    update public.quests set nome = trim(p_nome), tipo = p_tipo, atributo = p_atributo,
      weekly_target = case when p_tipo = 'diaria' then p_weekly_target else 7 end,
      goal_type = p_goal_type, goal_target_name = nullif(trim(p_goal_target_name), ''), goal_unit = p_goal_unit,
      goal_total = p_goal_total, goal_current = p_goal_current
    where id = p_quest_id returning * into v_quest;
    if p_goal_type is not null then
      perform public.update_main_quest_progress(p_quest_id, p_goal_current);
      select * into v_quest from public.quests where id = p_quest_id;
    end if;
  end if;
  return v_quest;
end;
$$;

create or replace function public.delete_own_quest(p_quest_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.quests where id = p_quest_id and user_id = auth.uid();
  if not found then raise exception 'Quest não encontrada'; end if;
end;
$$;

create or replace function public.save_custom_reward(
  p_name text, p_description text, p_real_value numeric, p_gold_price integer, p_rarity text
)
returns public.custom_rewards language plpgsql security definer set search_path = public as $$
declare v_reward public.custom_rewards;
begin
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 80 then raise exception 'Nome da recompensa inválido'; end if;
  if char_length(coalesce(p_description, '')) > 240 then raise exception 'Descrição muito longa'; end if;
  if p_real_value is not null and p_real_value < 0 then raise exception 'Valor real inválido'; end if;
  if p_gold_price is null or p_gold_price <= 0 then raise exception 'Preço em GOLD inválido'; end if;
  if p_rarity not in ('Common', 'Rare', 'Epic', 'Legendary') then raise exception 'Raridade inválida'; end if;
  insert into public.custom_rewards (user_id, name, description, real_value, gold_price, rarity)
  values (auth.uid(), trim(p_name), nullif(trim(p_description), ''), p_real_value, p_gold_price, p_rarity)
  returning * into v_reward;
  return v_reward;
end;
$$;

create or replace function public.delete_own_custom_reward(p_reward_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.custom_rewards where id = p_reward_id and user_id = auth.uid();
  if not found then raise exception 'Custom Contract não encontrado'; end if;
end;
$$;

create or replace function public.get_hero_overview()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'completed_activity_count', (select count(*) from public.history where user_id = auth.uid()),
    'completed_quest_count', (select count(*) from public.quests where user_id = auth.uid() and status = 'concluida'),
    'books_read', (select count(*) from public.quests where user_id = auth.uid() and goal_type = 'livro' and goal_total > 0 and goal_current >= goal_total),
    'courses_completed', (select count(*) from public.quests where user_id = auth.uid() and goal_type = 'curso' and goal_total > 0 and goal_current >= goal_total),
    'purchase_goals_completed', (select count(*) from public.quests where user_id = auth.uid() and goal_type = 'compra' and goal_total > 0 and goal_current >= goal_total),
    'gold_earned', (select coalesce(sum(amount), 0) from public.gold_transactions where user_id = auth.uid() and transaction_type = 'credit')
  );
$$;

revoke insert, update, delete on public.profiles from authenticated, anon;
revoke insert, update, delete on public.quests from authenticated, anon;
revoke insert, update, delete on public.history from authenticated, anon;
revoke insert, update, delete on public.daily_completions from authenticated, anon;
revoke insert, update, delete on public.gold_transactions from authenticated, anon;
revoke insert, update, delete on public.main_quest_gold_milestones from authenticated, anon;
revoke insert, update, delete on public.custom_rewards from authenticated, anon;
grant select on public.profiles, public.quests, public.history, public.gold_transactions, public.custom_rewards to authenticated;
grant execute on function public.save_quest(uuid, text, text, text, integer, text, text, text, numeric, numeric) to authenticated;
grant execute on function public.delete_own_quest(uuid) to authenticated;
grant execute on function public.save_custom_reward(text, text, numeric, integer, text) to authenticated;
grant execute on function public.delete_own_custom_reward(uuid) to authenticated;
grant execute on function public.get_hero_overview() to authenticated;
