-- Propostas diárias de quests opcionais.
-- Execute após 20260913_clean_date_history.sql.

create table if not exists public.quest_suggestion_templates (
  id text primary key,
  name text not null check (char_length(name) between 1 and 160),
  description text not null check (char_length(description) between 1 and 300),
  quest_type text not null default 'side' check (quest_type in ('side', 'principal', 'diaria')),
  attribute text not null check (attribute in ('forca', 'magia', 'carisma', 'inteligencia')),
  weekly_target integer not null default 7 check (weekly_target between 1 and 7),
  active boolean not null default true
);

create table if not exists public.quest_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null references public.quest_suggestion_templates(id),
  suggested_on date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  quest_id uuid references public.quests(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (user_id, suggested_on)
);

create index if not exists quest_suggestions_user_date_idx on public.quest_suggestions (user_id, suggested_on desc);
alter table public.quest_suggestion_templates enable row level security;
alter table public.quest_suggestions enable row level security;
drop policy if exists "Users read own quest suggestions" on public.quest_suggestions;
create policy "Users read own quest suggestions" on public.quest_suggestions for select using (auth.uid() = user_id);
revoke all on public.quest_suggestion_templates from authenticated, anon;
revoke insert, update, delete on public.quest_suggestions from authenticated, anon;
grant select on public.quest_suggestions to authenticated;

insert into public.quest_suggestion_templates (id, name, description, quest_type, attribute, weekly_target) values
  ('briefing-do-dia', 'Briefing do Dia', 'Defina três prioridades reais para hoje e escolha a primeira ação.', 'side', 'inteligencia', 7),
  ('sprint-fisico', 'Sprint Físico', 'Faça pelo menos 20 minutos de movimento intencional: treino, caminhada ou bike.', 'side', 'forca', 7),
  ('leitura-tatica', 'Leitura Tática', 'Leia por 20 minutos algo que expanda sua visão ou uma habilidade.', 'side', 'inteligencia', 7),
  ('conexao-ativa', 'Conexão Ativa', 'Envie uma mensagem genuína ou tenha uma conversa presente com alguém importante.', 'side', 'carisma', 7),
  ('detox-de-feed', 'Detox de Feed', 'Passe duas horas sem feed infinito, vídeos curtos ou notificações não essenciais.', 'side', 'magia', 7),
  ('reset-do-ambiente', 'Reset do Ambiente', 'Organize por 15 minutos o espaço que mais afeta sua concentração.', 'side', 'magia', 7),
  ('respiracao-neural', 'Respiração Neural', 'Faça 10 minutos de respiração consciente, meditação ou silêncio sem tela.', 'side', 'magia', 7),
  ('caminhada-de-recon', 'Caminhada de Reconhecimento', 'Caminhe ao ar livre e observe o ambiente sem usar o celular.', 'side', 'forca', 7),
  ('check-financeiro', 'Check Financeiro', 'Revise gastos recentes e anote uma decisão financeira consciente.', 'side', 'inteligencia', 7),
  ('skill-shot', 'Skill Shot', 'Pratique por 20 minutos uma habilidade que você quer dominar.', 'side', 'inteligencia', 7),
  ('relatorio-de-gratidao', 'Relatório de Gratidão', 'Registre três coisas boas do dia e o motivo de elas importarem.', 'side', 'carisma', 7),
  ('night-protocol', 'Night Protocol', 'Prepare uma noite de recuperação: reduza telas e antecipe seu sono.', 'side', 'magia', 7),
  ('fuel-upgrade', 'Fuel Upgrade', 'Faça uma escolha alimentar deliberada que ajude seu corpo hoje.', 'side', 'forca', 7),
  ('limpeza-digital', 'Limpeza Digital', 'Remova, organize ou responda algo digital que está ocupando sua mente.', 'side', 'magia', 7),
  ('bloco-de-foco', 'Bloco de Foco', 'Execute 25 minutos de foco total em uma tarefa que você vem adiando.', 'side', 'inteligencia', 7),
  ('modo-criador', 'Modo Criador', 'Crie algo pequeno: escreva, desenhe, grave ou programe por 15 minutos.', 'side', 'carisma', 7),
  ('presenca-familiar', 'Presença Familiar', 'Dedique atenção sem distração a uma pessoa da sua família.', 'side', 'carisma', 7),
  ('zona-de-desconforto', 'Zona de Desconforto', 'Faça uma pequena ação que você evita por receio, preguiça ou insegurança.', 'side', 'carisma', 7),
  ('mobilidade-total', 'Mobilidade Total', 'Faça uma sessão breve de alongamento e mobilidade para recuperar o corpo.', 'side', 'forca', 7),
  ('review-de-batalha', 'Review de Batalha', 'Revise o dia, identifique uma vitória e ajuste uma rota para amanhã.', 'side', 'inteligencia', 7)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  quest_type = excluded.quest_type,
  attribute = excluded.attribute,
  weekly_target = excluded.weekly_target,
  active = true;

create or replace function public.get_daily_quest_suggestion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_suggestion public.quest_suggestions;
  v_template public.quest_suggestion_templates;
begin
  select * into v_suggestion from public.quest_suggestions
  where user_id = auth.uid() and suggested_on = current_date;

  if not found then
    insert into public.quest_suggestions (user_id, template_id, suggested_on)
    select auth.uid(), id, current_date
    from public.quest_suggestion_templates
    where active = true
    order by random()
    limit 1
    on conflict (user_id, suggested_on) do nothing
    returning * into v_suggestion;

    if not found then
      select * into v_suggestion from public.quest_suggestions
      where user_id = auth.uid() and suggested_on = current_date;
    end if;
  end if;

  select * into v_template from public.quest_suggestion_templates where id = v_suggestion.template_id;
  return jsonb_build_object(
    'id', v_suggestion.id,
    'status', v_suggestion.status,
    'suggested_on', v_suggestion.suggested_on,
    'name', v_template.name,
    'description', v_template.description,
    'quest_type', v_template.quest_type,
    'attribute', v_template.attribute,
    'weekly_target', v_template.weekly_target
  );
end;
$$;

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

  insert into public.quests (user_id, nome, tipo, atributo, weekly_target)
  values (auth.uid(), v_template.name, v_template.quest_type, v_template.attribute,
    case when v_template.quest_type = 'diaria' then v_template.weekly_target else 7 end)
  returning * into v_quest;

  update public.quest_suggestions
  set status = 'accepted', quest_id = v_quest.id, responded_at = now()
  where id = v_suggestion.id;
  return v_quest;
end;
$$;

create or replace function public.dismiss_quest_suggestion(p_suggestion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.quest_suggestions
  set status = 'dismissed', responded_at = now()
  where id = p_suggestion_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Proposta não está disponível'; end if;
end;
$$;

grant execute on function public.get_daily_quest_suggestion() to authenticated;
grant execute on function public.accept_quest_suggestion(uuid) to authenticated;
grant execute on function public.dismiss_quest_suggestion(uuid) to authenticated;
