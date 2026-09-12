-- Banco do leilão ao vivo da Village & Vault.
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
--
-- Regra geral de segurança: o site lê (com a chave pública) e NÃO escreve.
-- Toda escrita passa pela nossa API, que usa a chave service_role e confere as
-- regras de lance antes de gravar.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- participantes
create table if not exists participantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null unique,
  bloqueado boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------- leilões
create table if not exists leiloes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  estado text not null default 'rascunho' check (estado in ('rascunho', 'ao_vivo', 'encerrado')),
  inicia_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ------------------------------------------------------------------------ lotes
create table if not exists lotes (
  id uuid primary key default gen_random_uuid(),
  leilao_id uuid not null references leiloes(id) on delete cascade,
  ordem integer not null,
  titulo text not null,
  descricao text,
  imagem text,
  lance_inicial_centavos integer not null check (lance_inicial_centavos > 0),
  incremento_centavos integer not null check (incremento_centavos > 0),
  estado text not null default 'aguardando' check (estado in ('aguardando', 'aberto', 'encerrado', 'cancelado')),
  aberto_em timestamptz,
  fecha_em timestamptz,
  vencedor_id uuid references participantes(id),
  vencedor_nome text,
  vencedor_centavos integer,
  unique (leilao_id, ordem)
);

create index if not exists lotes_por_leilao on lotes (leilao_id, ordem);

-- ------------------------------------------------------------------------ lances
create table if not exists lances (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes(id) on delete cascade,
  participante_id uuid not null references participantes(id),
  nome text not null,
  centavos integer not null check (centavos > 0),
  em timestamptz not null default now(),
  cancelado boolean not null default false
);

create index if not exists lances_por_lote on lances (lote_id, centavos desc, em asc);

-- ----------------------------------------------------------------------- chat
create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  leilao_id uuid not null references leiloes(id) on delete cascade,
  participante_id uuid references participantes(id),
  nome text not null,
  texto text not null check (char_length(texto) between 1 and 400),
  em timestamptz not null default now(),
  oculta boolean not null default false
);

create index if not exists mensagens_por_leilao on mensagens (leilao_id, em desc);

-- ------------------------------------------------------------------- cobranças
-- Uma cobrança por pessoa por leilão: a "caixa" dela, com todos os arremates.
create table if not exists cobrancas (
  id uuid primary key default gen_random_uuid(),
  leilao_id uuid not null references leiloes(id) on delete cascade,
  participante_id uuid not null references participantes(id),
  centavos integer not null check (centavos > 0),
  estado text not null default 'aberta' check (estado in ('aberta', 'paga', 'cancelada')),
  link text,
  provedor text,
  provedor_id text,
  criada_em timestamptz not null default now(),
  paga_em timestamptz,
  unique (leilao_id, participante_id)
);

-- ------------------------------------------------------------------------- RLS
alter table participantes enable row level security;
alter table leiloes enable row level security;
alter table lotes enable row level security;
alter table lances enable row level security;
alter table mensagens enable row level security;
alter table cobrancas enable row level security;

-- Público pode LER o que aparece na tela do leilão. Nada mais.
drop policy if exists leiloes_leitura on leiloes;
create policy leiloes_leitura on leiloes for select to anon, authenticated using (true);

drop policy if exists lotes_leitura on lotes;
create policy lotes_leitura on lotes for select to anon, authenticated using (true);

drop policy if exists lances_leitura on lances;
create policy lances_leitura on lances for select to anon, authenticated using (not cancelado);

drop policy if exists mensagens_leitura on mensagens;
create policy mensagens_leitura on mensagens for select to anon, authenticated using (not oculta);

-- participantes e cobrancas ficam sem política de leitura pública de propósito:
-- guardam WhatsApp e valores, e só a nossa API (service_role) enxerga.

-- ------------------------------------------------------------- lance com trava
-- O lance é aceito aqui dentro, com a linha do lote travada: dois lances no
-- mesmo instante entram um de cada vez, e o segundo enxerga o primeiro.
-- As mesmas regras estão em lib/leilao.ts, que a tela usa para avisar antes de
-- mandar; quem manda na verdade é esta função.
create or replace function dar_lance(
  p_lote uuid,
  p_participante uuid,
  p_nome text,
  p_centavos integer,
  p_janela_ms integer default 15000,
  p_max_saltos integer default 50
)
returns json
language plpgsql
security definer
as $$
declare
  v_lote lotes%rowtype;
  v_maior lances%rowtype;
  v_minimo integer;
  v_bloqueado boolean;
  v_agora timestamptz := now();
  v_id uuid;
  v_fecha timestamptz;
begin
  select bloqueado into v_bloqueado from participantes where id = p_participante;
  if v_bloqueado is null then
    return json_build_object('ok', false, 'erro', 'participante-desconhecido');
  end if;
  if v_bloqueado then
    return json_build_object('ok', false, 'erro', 'participante-bloqueado');
  end if;

  select * into v_lote from lotes where id = p_lote for update;
  if not found then
    return json_build_object('ok', false, 'erro', 'lote-inexistente');
  end if;
  if v_lote.estado <> 'aberto' or (v_lote.fecha_em is not null and v_agora >= v_lote.fecha_em) then
    return json_build_object('ok', false, 'erro', 'lote-fechado');
  end if;

  select * into v_maior
  from lances
  where lote_id = p_lote and not cancelado
  order by centavos desc, em asc
  limit 1;

  if found then
    v_minimo := v_maior.centavos + v_lote.incremento_centavos;
    if v_maior.participante_id = p_participante then
      return json_build_object('ok', false, 'erro', 'ja-esta-ganhando', 'minimo', v_minimo);
    end if;
  else
    v_minimo := v_lote.lance_inicial_centavos;
  end if;

  if p_centavos < v_minimo then
    return json_build_object('ok', false, 'erro', 'valor-baixo', 'minimo', v_minimo);
  end if;
  if p_centavos > v_minimo + v_lote.incremento_centavos * p_max_saltos then
    return json_build_object('ok', false, 'erro', 'valor-alto-demais', 'minimo', v_minimo);
  end if;

  insert into lances (lote_id, participante_id, nome, centavos, em)
  values (p_lote, p_participante, p_nome, p_centavos, v_agora)
  returning id into v_id;

  -- Anti-sniper: lance perto do fim estica o relógio.
  v_fecha := v_lote.fecha_em;
  if v_fecha - v_agora <= (p_janela_ms || ' milliseconds')::interval then
    v_fecha := v_agora + (p_janela_ms || ' milliseconds')::interval;
    update lotes set fecha_em = v_fecha where id = p_lote;
  end if;

  return json_build_object(
    'ok', true,
    'lance_id', v_id,
    'centavos', p_centavos,
    'proximo_minimo', p_centavos + v_lote.incremento_centavos,
    'fecha_em', v_fecha
  );
end;
$$;

revoke all on function dar_lance(uuid, uuid, text, integer, integer, integer) from public, anon, authenticated;

-- -------------------------------------------------------------------- realtime
-- Faz o site receber lance, mudança de lote e mensagem na hora, por WebSocket.
alter publication supabase_realtime add table lotes;
alter publication supabase_realtime add table lances;
alter publication supabase_realtime add table mensagens;
