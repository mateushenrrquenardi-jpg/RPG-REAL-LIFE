-- Recompensa de level up: metade do XP exigido para aquele nível, arredondada ao GOLD inteiro mais próximo.
-- Execute após 20260913_training_monthly_goal.sql.

create or replace function public.complete_quest(p_quest_id uuid)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_quest public.quests; v_profile public.profiles; v_exp integer; v_pontos integer; v_gold integer := 0;
  v_routine_days integer := 0; v_stage_days integer := 0; v_level_gold integer := 0;
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
    v_level_gold := round(v_profile.exp_necessaria / 2.0)::integer;
    v_gold := v_gold + v_level_gold;
    v_profile.gold := v_profile.gold + v_level_gold;
    v_profile.nivel := v_profile.nivel + 1;
    v_profile.exp_necessaria := round(v_profile.exp_necessaria * 1.2);
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

grant execute on function public.complete_quest(uuid) to authenticated;
