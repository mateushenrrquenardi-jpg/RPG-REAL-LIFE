-- Migration: Recompensa em GOLD para os marcos de rotina diaria
-- 14 dias: +50 GOLD
-- 28 dias: +75 GOLD
-- 60 dias: +120 GOLD
-- 90 dias: +180 GOLD
-- 180 dias: +300 GOLD
-- Rotina fixada: +500 GOLD

-- 1. Atualizar definicao dos dias de cada estagio da rotina
create or replace function public.routine_stage_days(p_level integer)
returns integer language sql immutable as $$
  select case p_level
    when 1 then 14
    when 2 then 28
    when 3 then 60
    when 4 then 90
    else 180
  end;
$$;

-- 2. Atualizar complete_quest com bonus de rotina, level up e conclusao diaria/side
create or replace function public.complete_quest(p_quest_id uuid)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_quest public.quests;
  v_profile public.profiles;
  v_exp integer;
  v_pontos integer;
  v_gold integer := 0;
  v_routine_days integer := 0;
  v_stage_days integer := 0;
begin
  perform public.refresh_daily_routines();
  select * into v_quest from public.quests where id = p_quest_id and user_id = auth.uid() and status = 'ativa' for update;
  if not found then raise exception 'Quest nao encontrada ou ja concluida'; end if;
  
  if v_quest.tipo = 'diaria' then
    insert into public.daily_completions (quest_id, user_id, completed_on) values (v_quest.id, auth.uid(), current_date);
    v_gold := 7;
    
    -- Calcular dias concluidos na etapa atual da rotina
    select count(*) into v_routine_days
    from public.daily_completions
    where quest_id = v_quest.id
      and completed_on >= v_quest.routine_started_on
      and completed_on <= current_date;
      
    v_stage_days := public.routine_stage_days(v_quest.routine_level);
    
    if not coalesce(v_quest.routine_fixed, false) and v_routine_days >= v_stage_days then
      if v_quest.routine_level = 1 then
        v_gold := v_gold + 50;
        update public.quests set routine_level = 2, routine_started_on = current_date + 1 where id = v_quest.id;
      elsif v_quest.routine_level = 2 then
        v_gold := v_gold + 75;
        update public.quests set routine_level = 3, routine_started_on = current_date + 1 where id = v_quest.id;
      elsif v_quest.routine_level = 3 then
        v_gold := v_gold + 120;
        update public.quests set routine_level = 4, routine_started_on = current_date + 1 where id = v_quest.id;
      elsif v_quest.routine_level = 4 then
        v_gold := v_gold + 180;
        update public.quests set routine_level = 5, routine_started_on = current_date + 1 where id = v_quest.id;
      elsif v_quest.routine_level >= 5 then
        -- 180 dias atingidos (+300) e rotina fixada (+500)
        v_gold := v_gold + 300 + 500;
        update public.quests set routine_fixed = true where id = v_quest.id;
      end if;
    end if;
  elsif v_quest.tipo = 'side' then
    v_gold := 3;
  end if;
  
  v_exp := case when v_quest.tipo = 'principal' then 30 else 10 end;
  v_pontos := case when v_quest.tipo = 'principal' then 3 else 1 end;
  
  update public.quests set status = 'concluida', completed_at = now() where id = v_quest.id;
  
  select * into v_profile from public.profiles where user_id = auth.uid() for update;
  v_profile.exp_atual := v_profile.exp_atual + v_exp;
  v_profile.gold := coalesce(v_profile.gold, 0) + v_gold;
  
  case v_quest.atributo
    when 'forca' then v_profile.forca := v_profile.forca + v_pontos;
    when 'magia' then v_profile.magia := v_profile.magia + v_pontos;
    when 'carisma' then v_profile.carisma := v_profile.carisma + v_pontos;
    when 'inteligencia' then v_profile.inteligencia := v_profile.inteligencia + v_pontos;
  end case;
  
  -- Ao subir de nivel, recebe em GOLD o valor exato de XP necessario para o UP
  while v_profile.exp_atual >= v_profile.exp_necessaria loop
    v_profile.exp_atual := v_profile.exp_atual - v_profile.exp_necessaria;
    v_profile.gold := v_profile.gold + v_profile.exp_necessaria;
    v_profile.nivel := v_profile.nivel + 1;
    v_profile.exp_necessaria := round(v_profile.exp_necessaria * 1.2);
  end loop;
  
  update public.profiles
  set nivel = v_profile.nivel,
      exp_atual = v_profile.exp_atual,
      exp_necessaria = v_profile.exp_necessaria,
      forca = v_profile.forca,
      magia = v_profile.magia,
      carisma = v_profile.carisma,
      inteligencia = v_profile.inteligencia,
      gold = v_profile.gold,
      updated_at = now()
  where user_id = auth.uid();
  
  insert into public.history (user_id, acao, exp_ganho, atributo, pontos, nivel_atual)
  values (auth.uid(), v_quest.nome, v_exp, v_quest.atributo, v_pontos, v_profile.nivel);
  
  return v_profile;
end;
$$;

grant execute on function public.routine_stage_days(integer) to authenticated;
grant execute on function public.complete_quest(uuid) to authenticated;
