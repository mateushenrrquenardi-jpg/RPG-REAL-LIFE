-- Migration: Sistema de recompensas em GOLD (dinheiro do RPG)
-- Execute no Supabase > SQL Editor

-- 1. Adicionar coluna gold na tabela profiles (caso nao exista)
alter table public.profiles
  add column if not exists gold integer not null default 0;

-- 2. Atualizar a funcao complete_quest para creditar 7 GOLD ao finalizar quest diaria
create or replace function public.complete_quest(p_quest_id uuid)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_quest public.quests;
  v_profile public.profiles;
  v_exp integer;
  v_pontos integer;
  v_gold integer := 0;
begin
  perform public.refresh_daily_routines();
  select * into v_quest from public.quests where id = p_quest_id and user_id = auth.uid() and status = 'ativa' for update;
  if not found then raise exception 'Quest nao encontrada ou ja concluida'; end if;
  
  if v_quest.tipo = 'diaria' then
    insert into public.daily_completions (quest_id, user_id, completed_on) values (v_quest.id, auth.uid(), current_date);
    v_gold := 7;
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
  
  while v_profile.exp_atual >= v_profile.exp_necessaria loop
    v_profile.exp_atual := v_profile.exp_atual - v_profile.exp_necessaria;
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

-- 3. Atualizar a funcao reset_rpg para zerar gold tambem
create or replace function public.reset_rpg()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.history where user_id = auth.uid();
  delete from public.daily_completions where user_id = auth.uid();
  delete from public.quests where user_id = auth.uid();
  update public.profiles set
    nivel = 1,
    exp_atual = 0,
    exp_necessaria = 100,
    forca = 0,
    magia = 0,
    carisma = 0,
    inteligencia = 0,
    gold = 0,
    updated_at = now()
  where user_id = auth.uid();
end;
$$;

grant execute on function public.complete_quest(uuid) to authenticated;
grant execute on function public.reset_rpg() to authenticated;
