-- Histórico de marcos do contador Dias Limpo.
-- Execute após 20260913_levelup_half_gold.sql.

create table if not exists public.clean_date_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clean_date date not null,
  previous_clean_date date,
  created_at timestamptz not null default now()
);

create index if not exists clean_date_logs_user_created_idx on public.clean_date_logs (user_id, created_at desc);
alter table public.clean_date_logs enable row level security;
drop policy if exists "Users read own clean date logs" on public.clean_date_logs;
create policy "Users read own clean date logs" on public.clean_date_logs for select using (auth.uid() = user_id);
revoke insert, update, delete on public.clean_date_logs from authenticated, anon;
grant select on public.clean_date_logs to authenticated;

-- Migra o marco atual salvo no perfil de autenticação, quando existir.
insert into public.clean_date_logs (user_id, clean_date)
select u.id, (u.raw_user_meta_data ->> 'clean_date')::date
from auth.users u
where coalesce(u.raw_user_meta_data ->> 'clean_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  and not exists (select 1 from public.clean_date_logs l where l.user_id = u.id);

create or replace function public.record_clean_date_change(p_clean_date date, p_previous_clean_date date default null)
returns public.clean_date_logs language plpgsql security definer set search_path = public as $$
declare v_log public.clean_date_logs;
begin
  if p_clean_date is null or p_clean_date > current_date then raise exception 'Data de dias limpo inválida'; end if;
  insert into public.clean_date_logs (user_id, clean_date, previous_clean_date)
  values (auth.uid(), p_clean_date, p_previous_clean_date)
  returning * into v_log;
  return v_log;
end;
$$;

grant execute on function public.record_clean_date_change(date, date) to authenticated;
