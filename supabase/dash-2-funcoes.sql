-- Dash Village, parte 2: as contas que o banco faz (aplicadas como as
-- migrações dash_2_funcoes, dash_3_totais_metas, dash_4_ranking_regras e
-- dash_5_icones). Só a chave de serviço (a API do site) pode chamar.

-- Quantos "bilhetes" cada pessoa tem numa live, pela fonte do sorteio.
-- Junto vem quantas mensagens e compras ela tem, para marcar conta suspeita.
create or replace function dash_bilhetes(p_show text, p_fonte text, p_icones text[], p_textos text[])
returns table(handle text, nome text, foto text, n bigint, mensagens bigint, compras bigint)
language sql stable set search_path = public as $$
  with base as (
    select e.handle, max(e.nome) as nome, max(e.foto) as foto,
      case
        when p_fonte = 'emocoes' then count(*)
        when p_fonte = 'gemas' then coalesce(sum(e.gemas), 0)
        when p_fonte like 'emocao:%' then count(*) filter (where e.icone = substr(p_fonte, 8))
        when p_fonte = 'carpas' then count(*) filter (where e.icone = any(p_icones))
        else 0
      end::bigint as n
    from dash_emocoes e
    where e.show_id = p_show and (p_fonte in ('emocoes', 'gemas', 'carpas') or p_fonte like 'emocao:%')
    group by e.handle
    union all
    select c.handle, max(c.nome), max(c.foto),
      case
        when p_fonte = 'chat' then count(*)
        when p_fonte = 'carpas' then count(*) filter (
          where exists (select 1 from unnest(coalesce(p_textos, '{}')) t where c.texto ilike '%' || t || '%'))
        else 0
      end::bigint
    from dash_chat c
    where c.show_id = p_show and p_fonte in ('chat', 'carpas')
    group by c.handle
    union all
    select v.comprador, null, max(v.foto), coalesce(sum(v.quantidade), 0)::bigint
    from dash_vendas v
    where v.show_id = p_show and not v.cancelado and p_fonte = 'compradores'
    group by v.comprador
  ),
  soma as (
    select b.handle, max(b.nome) as nome, max(b.foto) as foto, sum(b.n)::bigint as n
    from base b where b.handle is not null and b.handle <> ''
    group by b.handle
  )
  select s.handle, s.nome, s.foto, s.n,
    (select count(*) from dash_chat c where c.show_id = p_show and c.handle = s.handle)::bigint,
    (select count(*) from dash_vendas v where v.show_id = p_show and v.comprador = s.handle and not v.cancelado)::bigint
  from soma s where s.n > 0;
$$;

-- Lives da conta num período, com o que cada uma vendeu e recebeu.
create or replace function dash_lives_resumo(p_conta text, p_de timestamptz, p_ate timestamptz)
returns table(show_id text, titulo text, vendedor text, inicio timestamptz, ao_vivo boolean,
              total numeric, pago numeric, itens bigint, vendas bigint, compradores bigint,
              emocoes bigint, gemas bigint, ganhadores bigint)
language sql stable set search_path = public as $$
  select l.show_id, l.titulo, l.vendedor, coalesce(l.inicio, l.criado_em), l.ao_vivo,
    coalesce((select sum(v.total) from dash_vendas v where v.show_id = l.show_id and not v.cancelado), 0),
    coalesce((select sum(v.total) from dash_vendas v where v.show_id = l.show_id and not v.cancelado and v.pago is not false), 0),
    coalesce((select sum(v.quantidade) from dash_vendas v where v.show_id = l.show_id and not v.cancelado), 0)::bigint,
    (select count(*) from dash_vendas v where v.show_id = l.show_id and not v.cancelado)::bigint,
    (select count(distinct v.comprador) from dash_vendas v where v.show_id = l.show_id and not v.cancelado)::bigint,
    (select count(*) from dash_emocoes e where e.show_id = l.show_id)::bigint,
    coalesce((select sum(e.gemas) from dash_emocoes e where e.show_id = l.show_id), 0)::bigint,
    (select count(*) from dash_ganhadores g where g.show_id = l.show_id and g.status = 'valido')::bigint
  from dash_lives l
  where l.conta = p_conta and l.vendedor = p_conta
    and coalesce(l.inicio, l.criado_em) >= p_de and coalesce(l.inicio, l.criado_em) < p_ate
  order by coalesce(l.inicio, l.criado_em) desc;
$$;

-- Clientes da conta: quanto cada um comprou somando as lives do período.
create or replace function dash_clientes(p_conta text, p_de timestamptz, p_ate timestamptz)
returns table(comprador text, foto text, total numeric, pago numeric, pendente numeric,
              itens bigint, compras bigint, lives bigint, primeira timestamptz, ultima timestamptz)
language sql stable set search_path = public as $$
  select v.comprador, max(v.foto),
    coalesce(sum(v.total), 0),
    coalesce(sum(v.total) filter (where v.pago is not false), 0),
    coalesce(sum(v.total) filter (where v.pago is false), 0),
    coalesce(sum(v.quantidade), 0)::bigint,
    count(*)::bigint,
    count(distinct v.show_id)::bigint,
    min(v.ts), max(v.ts)
  from dash_vendas v
  where v.conta = p_conta and v.vendedor = p_conta and not v.cancelado
    and v.comprador is not null and v.comprador <> ''
    and v.ts >= p_de and v.ts < p_ate
  group by v.comprador
  order by 3 desc;
$$;

-- Meta da live inteira ("live") ou de cada pessoa ("pessoa": quem chegar a X ganha).
alter table dash_metas add column if not exists escopo text not null default 'live';
alter table dash_metas add column if not exists ordem int not null default 0;

-- Os números de uma live de uma vez, para a tela do OBS e as metas.
create or replace function dash_totais(p_show text, p_icones text[], p_textos text[])
returns table(emocoes bigint, gemas bigint, carpas bigint, mensagens bigint,
              vendas bigint, itens bigint, total numeric, pago numeric, compradores bigint)
language sql stable set search_path = public as $$
  select
    (select count(*) from dash_emocoes e where e.show_id = p_show)::bigint,
    coalesce((select sum(e.gemas) from dash_emocoes e where e.show_id = p_show), 0)::bigint,
    ((select count(*) from dash_emocoes e where e.show_id = p_show and e.icone = any(coalesce(p_icones, '{}')))
     + (select count(*) from dash_chat c where c.show_id = p_show
          and exists (select 1 from unnest(coalesce(p_textos, '{}')) t where c.texto ilike '%' || t || '%')))::bigint,
    (select count(*) from dash_chat c where c.show_id = p_show)::bigint,
    (select count(*) from dash_vendas v where v.show_id = p_show and not v.cancelado)::bigint,
    coalesce((select sum(v.quantidade) from dash_vendas v where v.show_id = p_show and not v.cancelado), 0)::bigint,
    coalesce((select sum(v.total) from dash_vendas v where v.show_id = p_show and not v.cancelado), 0),
    coalesce((select sum(v.total) from dash_vendas v where v.show_id = p_show and not v.cancelado and v.pago is not false), 0),
    (select count(distinct v.comprador) from dash_vendas v where v.show_id = p_show and not v.cancelado)::bigint;
$$;

-- As regras de pontos que vêm junto do ranking (+3 por real, +2 por gema hoje).
alter table dash_ranking add column if not exists regras jsonb;

-- As figurinhas das emotions da Jamble (id -> imagem, nome e preço em gemas).
create table if not exists dash_icones (
  id text primary key,
  url text,
  nome text,
  gemas int,
  atualizado_em timestamptz not null default now()
);
alter table dash_icones enable row level security;

revoke all on function dash_bilhetes(text, text, text[], text[]) from public, anon, authenticated;
revoke all on function dash_lives_resumo(text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function dash_clientes(text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function dash_totais(text, text[], text[]) from public, anon, authenticated;
grant execute on function dash_bilhetes(text, text, text[], text[]) to service_role;
grant execute on function dash_lives_resumo(text, timestamptz, timestamptz) to service_role;
grant execute on function dash_clientes(text, timestamptz, timestamptz) to service_role;
grant execute on function dash_totais(text, text[], text[]) to service_role;
