-- Dash Village, parte 3: o robô que acompanha lives pelo link, sem a extensão.
-- Registro das migrações dash_10 a dash_13 (já aplicadas no village-vault).
-- O código do robô é a função supabase/functions/dash-robo (verify_jwt off:
-- quem chama não precisa de chave, e a vaga no banco limita as rodadas).

-- dash_10_robo
-- Entra como visitante (o mesmo acesso de quem abre a Jamble sem login), a cada minuto.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists dash_monitores (
  id uuid primary key default gen_random_uuid(),
  conta text not null,
  show_id text not null,
  seller_id text not null,
  codigo text,
  vendedor text,
  titulo text,
  ativo boolean not null default true,
  automatico boolean not null default false, -- a live da própria conta, ligada sozinha
  criado_em timestamptz not null default now(),
  ate timestamptz not null default now() + interval '14 hours',
  ultimo_ciclo timestamptz,
  ultimo_erro text,
  unique (conta, show_id)
);
create index if not exists dash_monitores_ativos on dash_monitores (ativo, ate);

-- Batimento do robô (para o "Robô online" do menu).
create table if not exists dash_robo (
  id int primary key default 1,
  ultimo_ciclo timestamptz,
  ultimo_erro text,
  monitores int,
  detalhes jsonb
);
insert into dash_robo (id) values (1) on conflict do nothing;

alter table dash_monitores enable row level security;
alter table dash_robo enable row level security;

-- dash_11_robo_vaga
alter table dash_robo add column if not exists ultimo_inicio timestamptz;

-- Pega a vez do robô: no máximo uma rodada a cada 50 s, quem quer que chame.
create or replace function dash_robo_vaga() returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update dash_robo set ultimo_inicio = now()
  where id = 1 and (ultimo_inicio is null or ultimo_inicio < now() - interval '50 seconds')
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

-- dash_12_robo_vaga_privada
revoke execute on function public.dash_robo_vaga() from public, anon, authenticated;
grant execute on function public.dash_robo_vaga() to service_role;

-- dash_13_robo_cron
select cron.unschedule('dash-robo') where exists (select 1 from cron.job where jobname = 'dash-robo');
select cron.schedule('dash-robo', '* * * * *', $$
  select net.http_post(
    url := 'https://iaklmoktayimunxvtsum.supabase.co/functions/v1/dash-robo',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  )
$$);
-- O sinal de vida da extensão (o robô também grava lives, então a hora da
-- última live vista não diz mais se a extensão está ligada).
alter table dash_config add column if not exists extensao_em timestamptz;

-- dash_14_emocoes_somadas (relatórios em PDF)
create or replace function dash_emocoes_somadas(p_shows text[])
returns table(handle text, icone text, qtd bigint, gemas bigint)
language sql stable security definer set search_path = public as $$
  select e.handle, e.icone, count(*)::bigint, coalesce(sum(e.gemas), 0)::bigint
  from dash_emocoes e
  where e.show_id = any(p_shows)
  group by e.handle, e.icone
$$;
revoke all on function dash_emocoes_somadas(text[]) from public, anon, authenticated;
grant execute on function dash_emocoes_somadas(text[]) to service_role;

-- dash_15_monitor_comeca_em
-- Live agendada colada no Dash: o robô só entra a partir de 10 min antes.
alter table dash_monitores add column if not exists comeca_em timestamptz;

-- dash_16_jamble_vendido_real e dash_17_jamble_cron
-- Vendido de verdade de cada vendedor da Jamble (função dash-jamble): tabelas
-- dash_jamble_lives (uma linha por live, com o vendido por mês em por_mes),
-- dash_jamble_vendedores (quando o perfil foi lido e até onde ele cobre),
-- dash_jamble_estado (a vaga de cada rodada), as funções dash_jamble_vaga()
-- e dash_jamble_vendido(mes), e o pg_cron 'dash-jamble' a cada minuto.
-- O SQL completo está nas migrações aplicadas no village-vault.
