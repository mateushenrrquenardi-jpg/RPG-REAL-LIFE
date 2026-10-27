-- Módulo Life Design: arquitetura de longo prazo.
-- Execute após 20261026_goal_protocolo.sql.

-- 1. Tabela de metas de vida.
create table if not exists public.life_goals (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) > 0 and char_length(trim(nome)) <= 200),
  descricao text check (char_length(coalesce(descricao, '')) <= 2000),
  horizon text not null check (horizon in ('vida', '10_anos', '5_anos', '1_ano', 'submeta')),
  area text check (area in ('saude', 'carreira', 'financeiro', 'pessoal', 'relacionamento', 'espiritual', 'lazer', 'educacao') or area is null),
  parent_id uuid references public.life_goals(id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido')),
  linked_quest_id uuid references public.quests(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_goals_user_idx on public.life_goals (user_id);
create index if not exists life_goals_parent_idx on public.life_goals (parent_id);
create index if not exists life_goals_horizon_idx on public.life_goals (user_id, horizon);

alter table public.life_goals enable row level security;

create policy life_goals_select_own on public.life_goals
  for select using (user_id = auth.uid());

create policy life_goals_insert_own on public.life_goals
  for insert with check (user_id = auth.uid());

create policy life_goals_update_own on public.life_goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy life_goals_delete_own on public.life_goals
  for delete using (user_id = auth.uid());

-- 2. Trigger para updated_at automático.
create or replace function public.life_goals_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger life_goals_updated_at_trigger
  before update on public.life_goals
  for each row execute function public.life_goals_set_updated_at();

-- 3. RPC: listar metas de vida do usuário.
create or replace function public.get_life_goals()
returns setof public.life_goals language sql security definer set search_path = public as $$
  select * from public.life_goals
  where user_id = auth.uid()
  order by
    case horizon
      when 'vida' then 1
      when '10_anos' then 2
      when '5_anos' then 3
      when '1_ano' then 4
      when 'submeta' then 5
    end,
    sort_order,
    created_at;
$$;

grant execute on function public.get_life_goals() to authenticated;

-- 4. RPC: criar ou atualizar meta de vida.
create or replace function public.save_life_goal(
  p_goal_id uuid,
  p_nome text,
  p_descricao text,
  p_horizon text,
  p_area text,
  p_parent_id uuid,
  p_status text,
  p_linked_quest_id uuid,
  p_sort_order integer
)
returns public.life_goals language plpgsql security definer set search_path = public as $$
declare
  v_goal public.life_goals;
  v_parent public.life_goals;
begin
  if nullif(trim(p_nome), '') is null or char_length(trim(p_nome)) > 200 then
    raise exception 'Nome da meta inválido';
  end if;
  if char_length(coalesce(p_descricao, '')) > 2000 then
    raise exception 'Descrição muito longa';
  end if;
  if p_horizon not in ('vida', '10_anos', '5_anos', '1_ano', 'submeta') then
    raise exception 'Horizonte inválido';
  end if;
  if p_status is not null and p_status not in ('ativo', 'pausado', 'concluido') then
    raise exception 'Status inválido';
  end if;
  if p_area is not null and p_area not in ('saude', 'carreira', 'financeiro', 'pessoal', 'relacionamento', 'espiritual', 'lazer', 'educacao') then
    raise exception 'Área inválida';
  end if;

  -- Meta de vida: só pode existir 1 por usuário.
  if p_horizon = 'vida' then
    if p_goal_id is null then
      if exists (select 1 from public.life_goals where user_id = auth.uid() and horizon = 'vida') then
        raise exception 'Você já tem uma Meta de Vida definida. Edite a existente.';
      end if;
    else
      -- Se está mudando o horizonte de uma meta que era 'vida', permitir.
      null;
    end if;
  end if;

  -- Validar parent: deve pertencer ao mesmo usuário e ter horizonte superior.
  if p_parent_id is not null then
    select * into v_parent from public.life_goals where id = p_parent_id and user_id = auth.uid();
    if not found then raise exception 'Meta pai não encontrada'; end if;

    -- Hierarquia: vida > 10_anos > 5_anos > 1_ano > submeta
    if v_parent.horizon = 'vida' and p_horizon <> '10_anos' then
      raise exception 'Filhos da Meta de Vida devem ser horizonte 10 anos';
    end if;
    if v_parent.horizon = '10_anos' and p_horizon <> '5_anos' then
      raise exception 'Filhos de horizonte 10 anos devem ser horizonte 5 anos';
    end if;
    if v_parent.horizon = '5_anos' and p_horizon <> '1_ano' then
      raise exception 'Filhos de horizonte 5 anos devem ser horizonte 1 ano';
    end if;
    if v_parent.horizon = '1_ano' and p_horizon <> 'submeta' then
      raise exception 'Filhos de horizonte 1 ano devem ser submetas';
    end if;
    if v_parent.horizon = 'submeta' then
      raise exception 'Submetas não podem ter filhos';
    end if;
  end if;

  -- Validar linked_quest: deve pertencer ao mesmo usuário.
  if p_linked_quest_id is not null then
    if not exists (select 1 from public.quests where id = p_linked_quest_id and user_id = auth.uid()) then
      raise exception 'Quest vinculada não encontrada';
    end if;
  end if;

  if p_goal_id is null then
    insert into public.life_goals (user_id, nome, descricao, horizon, area, parent_id, status, linked_quest_id, sort_order)
    values (auth.uid(), trim(p_nome), nullif(trim(p_descricao), ''), p_horizon, p_area, p_parent_id, coalesce(p_status, 'ativo'), p_linked_quest_id, coalesce(p_sort_order, 0))
    returning * into v_goal;
  else
    select * into v_goal from public.life_goals where id = p_goal_id and user_id = auth.uid() for update;
    if not found then raise exception 'Meta não encontrada'; end if;

    -- Se está mudando para 'vida', verificar se já existe outra.
    if p_horizon = 'vida' and v_goal.horizon <> 'vida' then
      if exists (select 1 from public.life_goals where user_id = auth.uid() and horizon = 'vida' and id <> p_goal_id) then
        raise exception 'Você já tem uma Meta de Vida definida. Edite a existente.';
      end if;
    end if;

    update public.life_goals set
      nome = trim(p_nome),
      descricao = nullif(trim(p_descricao), ''),
      horizon = p_horizon,
      area = p_area,
      parent_id = p_parent_id,
      status = coalesce(p_status, status),
      linked_quest_id = p_linked_quest_id,
      sort_order = coalesce(p_sort_order, sort_order)
    where id = p_goal_id
    returning * into v_goal;
  end if;

  return v_goal;
end;
$$;

grant execute on function public.save_life_goal(uuid, text, text, text, text, uuid, text, uuid, integer) to authenticated;

-- 5. RPC: deletar meta de vida.
create or replace function public.delete_life_goal(p_goal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.life_goals where id = p_goal_id and user_id = auth.uid();
  if not found then raise exception 'Meta não encontrada'; end if;
end;
$$;

grant execute on function public.delete_life_goal(uuid) to authenticated;
