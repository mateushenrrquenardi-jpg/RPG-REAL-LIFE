-- Fonte canônica do livro-caixa e da loja de GOLD.
-- Execute após 20260912_main_quest_gold_milestones.sql e antes de 20260912_secure_writes.sql.

create table if not exists public.gold_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('credit', 'debit')), origin text not null,
  description text not null, amount integer not null check (amount > 0), balance_after integer not null check (balance_after >= 0),
  reward_name text, reward_category text, created_at timestamptz not null default now()
);
create index if not exists gold_transactions_user_created_idx on public.gold_transactions (user_id, created_at desc);

create table if not exists public.custom_rewards (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80), description text,
  real_value numeric(12,2) check (real_value is null or real_value >= 0), gold_price integer not null check (gold_price > 0),
  rarity text not null default 'Common' check (rarity in ('Common', 'Rare', 'Epic', 'Legendary')), created_at timestamptz not null default now()
);

alter table public.gold_transactions enable row level security;
alter table public.custom_rewards enable row level security;
drop policy if exists "Users read own GOLD ledger" on public.gold_transactions;
create policy "Users read own GOLD ledger" on public.gold_transactions for select using (auth.uid() = user_id);
drop policy if exists "Users read own custom rewards" on public.custom_rewards;
create policy "Users read own custom rewards" on public.custom_rewards for select using (auth.uid() = user_id);

insert into public.gold_transactions (user_id, transaction_type, origin, description, amount, balance_after)
select p.user_id, 'credit', 'saldo_inicial', 'Saldo GOLD existente antes do livro-caixa', p.gold, p.gold
from public.profiles p
where coalesce(p.gold, 0) > 0
  and not exists (select 1 from public.gold_transactions t where t.user_id = p.user_id);

create or replace function public.redeem_gold_reward(
  p_reward_name text, p_category text, p_gold_price integer, p_description text default null,
  p_real_value numeric default null, p_rarity text default 'Common', p_custom_reward_id uuid default null
)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles; v_custom public.custom_rewards;
begin
  if p_gold_price is null or p_gold_price <= 0 or nullif(trim(p_reward_name), '') is null then raise exception 'Recompensa inválida'; end if;
  if p_custom_reward_id is not null then
    select * into v_custom from public.custom_rewards where id = p_custom_reward_id and user_id = auth.uid();
    if not found or v_custom.gold_price <> p_gold_price or v_custom.name <> p_reward_name then raise exception 'Dados do contrato não conferem'; end if;
  end if;
  select * into v_profile from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Perfil não encontrado'; end if;
  if coalesce(v_profile.gold, 0) < p_gold_price then raise exception 'GOLD insuficiente para este resgate'; end if;
  v_profile.gold := v_profile.gold - p_gold_price;
  update public.profiles set gold = v_profile.gold, updated_at = now() where user_id = auth.uid();
  insert into public.gold_transactions (user_id, transaction_type, origin, description, amount, balance_after, reward_name, reward_category)
  values (auth.uid(), 'debit', case when p_custom_reward_id is null then 'loja' else 'custom_contract' end,
    coalesce(nullif(trim(p_description), ''), 'Resgate: ' || trim(p_reward_name)), p_gold_price, v_profile.gold, trim(p_reward_name), nullif(trim(p_category), ''));
  return v_profile;
end;
$$;

create or replace function public.complete_quest(p_quest_id uuid)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_quest public.quests; v_profile public.profiles; v_exp integer; v_pontos integer; v_gold integer := 0;
  v_routine_days integer := 0; v_stage_days integer := 0;
begin
  perform public.refresh_daily_routines();
  select * into v_quest from public.quests where id = p_quest_id and user_id = auth.uid() and status = 'ativa' for update;
  if not found then raise exception 'Quest nao encontrada ou ja concluida'; end if;
  if v_quest.tipo = 'diaria' then
    insert into public.daily_completions (quest_id, user_id, completed_on) values (v_quest.id, auth.uid(), current_date);
    v_gold := 7;
    select count(*) into v_routine_days from public.daily_completions where quest_id = v_quest.id and completed_on >= v_quest.routine_started_on and completed_on <= current_date;
    v_stage_days := public.routine_stage_days(v_quest.routine_level);
    if not coalesce(v_quest.routine_fixed, false) and v_routine_days >= v_stage_days then
      if v_quest.routine_level = 1 then v_gold := v_gold + 50; update public.quests set routine_level = 2, routine_started_on = current_date + 1 where id = v_quest.id;
      elsif v_quest.routine_level = 2 then v_gold := v_gold + 75; update public.quests set routine_level = 3, routine_started_on = current_date + 1 where id = v_quest.id;
      elsif v_quest.routine_level = 3 then v_gold := v_gold + 120; update public.quests set routine_level = 4, routine_started_on = current_date + 1 where id = v_quest.id;
      elsif v_quest.routine_level = 4 then v_gold := v_gold + 180; update public.quests set routine_level = 5, routine_started_on = current_date + 1 where id = v_quest.id;
      elsif v_quest.routine_level >= 5 then v_gold := v_gold + 800; update public.quests set routine_fixed = true where id = v_quest.id;
      end if;
    end if;
  elsif v_quest.tipo = 'side' then v_gold := 3;
  end if;
  v_exp := case when v_quest.tipo = 'principal' then 30 else 10 end;
  v_pontos := case when v_quest.tipo = 'principal' then 3 else 1 end;
  update public.quests set status = 'concluida', completed_at = now() where id = v_quest.id;
  select * into v_profile from public.profiles where user_id = auth.uid() for update;
  v_profile.exp_atual := v_profile.exp_atual + v_exp;
  v_profile.gold := coalesce(v_profile.gold, 0) + v_gold;
  case v_quest.atributo when 'forca' then v_profile.forca := v_profile.forca + v_pontos; when 'magia' then v_profile.magia := v_profile.magia + v_pontos; when 'carisma' then v_profile.carisma := v_profile.carisma + v_pontos; when 'inteligencia' then v_profile.inteligencia := v_profile.inteligencia + v_pontos; end case;
  while v_profile.exp_atual >= v_profile.exp_necessaria loop
    v_profile.exp_atual := v_profile.exp_atual - v_profile.exp_necessaria;
    v_gold := v_gold + v_profile.exp_necessaria; v_profile.gold := v_profile.gold + v_profile.exp_necessaria;
    v_profile.nivel := v_profile.nivel + 1; v_profile.exp_necessaria := round(v_profile.exp_necessaria * 1.2);
  end loop;
  update public.profiles set nivel = v_profile.nivel, exp_atual = v_profile.exp_atual, exp_necessaria = v_profile.exp_necessaria,
    forca = v_profile.forca, magia = v_profile.magia, carisma = v_profile.carisma, inteligencia = v_profile.inteligencia,
    gold = v_profile.gold, updated_at = now() where user_id = auth.uid();
  if v_gold > 0 then insert into public.gold_transactions (user_id, transaction_type, origin, description, amount, balance_after)
    values (auth.uid(), 'credit', 'quest_concluida', 'GOLD recebido ao concluir: ' || v_quest.nome, v_gold, v_profile.gold); end if;
  insert into public.history (user_id, acao, exp_ganho, atributo, pontos, nivel_atual)
  values (auth.uid(), v_quest.nome, v_exp, v_quest.atributo, v_pontos, v_profile.nivel);
  return v_profile;
end;
$$;

create or replace function public.reset_rpg()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.main_quest_gold_milestones where user_id = auth.uid();
  delete from public.gold_transactions where user_id = auth.uid();
  delete from public.custom_rewards where user_id = auth.uid();
  delete from public.history where user_id = auth.uid(); delete from public.daily_completions where user_id = auth.uid(); delete from public.quests where user_id = auth.uid();
  update public.profiles set nivel = 1, exp_atual = 0, exp_necessaria = 100, forca = 0, magia = 0, carisma = 0, inteligencia = 0, gold = 0, updated_at = now() where user_id = auth.uid();
end;
$$;

grant execute on function public.redeem_gold_reward(text, text, integer, text, numeric, text, uuid) to authenticated;
grant execute on function public.complete_quest(uuid) to authenticated;
grant execute on function public.reset_rpg() to authenticated;
