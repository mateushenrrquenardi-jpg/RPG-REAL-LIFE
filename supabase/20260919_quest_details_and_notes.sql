-- Briefing persistente e dossiê detalhado para quests e diárias.
-- Execute após 20260913_daily_quest_suggestions.sql.

alter table public.quests add column if not exists descricao text;
alter table public.quests drop constraint if exists quests_descricao_length_check;
alter table public.quests add constraint quests_descricao_length_check
  check (descricao is null or char_length(descricao) <= 500);

-- Nova assinatura: inclui a observação/briefing da quest.
drop function if exists public.save_quest(uuid, text, text, text, integer, text, text, text, numeric, numeric, date);

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
  p_goal_period_month date default null,
  p_descricao text default null
)
returns public.quests language plpgsql security definer set search_path = public as $$
declare
  v_quest public.quests;
begin
  if nullif(trim(p_nome), '') is null or char_length(trim(p_nome)) > 160 then raise exception 'Nome da quest inválido'; end if;
  if char_length(coalesce(p_descricao, '')) > 500 then raise exception 'Observação muito longa'; end if;
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
    insert into public.quests (user_id, nome, descricao, tipo, atributo, weekly_target, goal_type, goal_target_name, goal_unit, goal_total, goal_current, goal_period_month)
    values (auth.uid(), trim(p_nome), nullif(trim(p_descricao), ''), p_tipo, p_atributo, case when p_tipo = 'diaria' then p_weekly_target else 7 end, p_goal_type, nullif(trim(p_goal_target_name), ''), p_goal_unit, p_goal_total, p_goal_current, p_goal_period_month)
    returning * into v_quest;
  else
    select * into v_quest from public.quests where id = p_quest_id and user_id = auth.uid() for update;
    if not found then raise exception 'Quest não encontrada'; end if;
    update public.quests set nome = trim(p_nome), descricao = nullif(trim(p_descricao), ''), tipo = p_tipo, atributo = p_atributo,
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

-- Propostas aceitas mantêm o briefing apresentado no sinal de quest.
create or replace function public.accept_quest_suggestion(p_suggestion_id uuid)
returns public.quests language plpgsql security definer set search_path = public as $$
declare
  v_suggestion public.quest_suggestions;
  v_template public.quest_suggestion_templates;
  v_quest public.quests;
begin
  select * into v_suggestion from public.quest_suggestions
  where id = p_suggestion_id and user_id = auth.uid() for update;
  if not found or v_suggestion.status <> 'pending' then raise exception 'Proposta não está disponível'; end if;

  select * into v_template from public.quest_suggestion_templates where id = v_suggestion.template_id and active = true;
  if not found then raise exception 'Modelo de quest não está disponível'; end if;

  insert into public.quests (user_id, nome, descricao, tipo, atributo, weekly_target)
  values (auth.uid(), v_template.name, v_template.description, v_template.quest_type, v_template.attribute,
    case when v_template.quest_type = 'diaria' then v_template.weekly_target else 7 end)
  returning * into v_quest;

  update public.quest_suggestions
  set status = 'accepted', quest_id = v_quest.id, responded_at = now()
  where id = v_suggestion.id;
  return v_quest;
end;
$$;

-- Completa as observações das propostas que já haviam sido aceitas.
update public.quests q
set descricao = t.description
from public.quest_suggestions s
join public.quest_suggestion_templates t on t.id = s.template_id
where q.id = s.quest_id
  and q.user_id = s.user_id
  and nullif(trim(q.descricao), '') is null;

grant execute on function public.save_quest(uuid, text, text, text, integer, text, text, text, numeric, numeric, date, text) to authenticated;
grant execute on function public.accept_quest_suggestion(uuid) to authenticated;
