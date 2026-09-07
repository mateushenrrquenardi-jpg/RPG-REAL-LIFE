-- Correcao de fuso horario das rotinas: o projeto opera no horario de Manaus.
-- Execute depois de 20260906_daily_routines.sql em projetos ja existentes.
alter database postgres set timezone = 'America/Manaus';

create or replace function public.rpg_today()
returns date language sql stable as $fn$
  select (now() at time zone 'America/Manaus')::date;
$fn$;

-- As funcoes de rotina em producao devem usar public.rpg_today(). O fuso do
-- banco tambem fica definido para proteger defaults legados baseados em current_date.

-- Reprocessa as rotinas ja concluidas no dia local. Esta parte e segura para repetir.
update public.quests q
set status = 'concluida', completed_at = coalesce(q.completed_at, now())
where q.tipo = 'diaria'
  and exists (
    select 1
    from public.daily_completions dc
    where dc.quest_id = q.id
      and dc.completed_on = public.rpg_today()
  );
