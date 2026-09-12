-- GOLD por marcos de progresso das missões principais.
-- 25% = 40 GOLD | 50% = 60 GOLD | 75% = 80 GOLD | 100% = 220 GOLD
-- Total máximo por missão: 400 GOLD.

-- Compatível com instalações que ainda não possuem o livro-caixa da loja.
create table if not exists public.gold_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('credit', 'debit')),
  origin text not null,
  description text not null,
  amount integer not null check (amount > 0),
  balance_after integer not null check (balance_after >= 0),
  reward_name text,
  reward_category text,
  created_at timestamptz not null default now()
);

create index if not exists gold_transactions_user_created_idx on public.gold_transactions (user_id, created_at desc);
alter table public.gold_transactions enable row level security;
drop policy if exists "Users read own GOLD ledger" on public.gold_transactions;
create policy "Users read own GOLD ledger" on public.gold_transactions for select using (auth.uid() = user_id);

create table if not exists public.main_quest_gold_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  milestone integer not null check (milestone in (25, 50, 75, 100)),
  gold_awarded integer not null check (gold_awarded > 0),
  created_at timestamptz not null default now(),
  unique (quest_id, milestone)
);

alter table public.main_quest_gold_milestones enable row level security;
drop policy if exists "Users read own main quest milestones" on public.main_quest_gold_milestones;
create policy "Users read own main quest milestones" on public.main_quest_gold_milestones for select using (auth.uid() = user_id);

create or replace function public.update_main_quest_progress(p_quest_id uuid, p_goal_current numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quest public.quests;
  v_profile public.profiles;
  v_milestone integer;
  v_reward integer;
  v_awarded integer := 0;
  v_new_current numeric;
begin
  select * into v_quest from public.quests
  where id = p_quest_id and user_id = auth.uid() and tipo = 'principal' and status = 'ativa'
  for update;
  if not found or v_quest.goal_type is null or v_quest.goal_total is null or v_quest.goal_total <= 0 then
    raise exception 'Meta principal não encontrada';
  end if;

  v_new_current := greatest(0, least(p_goal_current, v_quest.goal_total));
  select * into v_profile from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Perfil não encontrado'; end if;

  for v_milestone, v_reward in select * from (values (25, 40), (50, 60), (75, 80), (100, 220)) as rewards(milestone, reward)
  loop
    if (v_new_current / v_quest.goal_total) * 100 >= v_milestone
      and not exists (select 1 from public.main_quest_gold_milestones where quest_id = v_quest.id and milestone = v_milestone) then
      v_profile.gold := coalesce(v_profile.gold, 0) + v_reward;
      v_awarded := v_awarded + v_reward;
      insert into public.main_quest_gold_milestones (user_id, quest_id, milestone, gold_awarded)
      values (auth.uid(), v_quest.id, v_milestone, v_reward);
      insert into public.gold_transactions (user_id, transaction_type, origin, description, amount, balance_after)
      values (auth.uid(), 'credit', 'marco_missao_principal', format('Marco de %s%%: %s', v_milestone, v_quest.nome), v_reward, v_profile.gold);
    end if;
  end loop;

  update public.quests set goal_current = v_new_current where id = v_quest.id;
  if v_awarded > 0 then update public.profiles set gold = v_profile.gold, updated_at = now() where user_id = auth.uid(); end if;
  return jsonb_build_object('gold_awarded', v_awarded, 'gold', v_profile.gold, 'goal_current', v_new_current);
end;
$$;

grant execute on function public.update_main_quest_progress(uuid, numeric) to authenticated;
