-- Parte 6: lance automático com limite secreto.
--
-- A pessoa diz até quanto quer pagar e o sistema disputa por ela, subindo de
-- incremento em incremento, só até onde precisar. Quem não pode ficar com o
-- celular na mão continua no páreo, e o preço chega no valor real de quem mais
-- quer a carta — sem ninguém precisar de dedo rápido no último segundo.

create table if not exists limites (
  lote_id uuid not null references lotes(id) on delete cascade,
  participante_id uuid not null references participantes(id),
  nome text not null,
  maximo_centavos integer not null check (maximo_centavos > 0),
  criado_em timestamptz not null default now(),
  primary key (lote_id, participante_id)
);

alter table limites enable row level security;
-- Sem leitura pública: o limite é secreto. Se vazasse, o leilão acabava.

create index if not exists limites_por_lote on limites (lote_id, maximo_centavos desc, criado_em asc);

-- Registra um lance sem passar pelas regras de novo (uso interno das funções
-- abaixo, que já travaram a linha do lote e já conferiram tudo).
create or replace function registrar_lance(
  p_lote uuid,
  p_participante uuid,
  p_nome text,
  p_centavos integer,
  p_janela_ms integer
)
returns timestamptz
language plpgsql
as $$
declare
  v_fecha timestamptz;
  v_agora timestamptz := now();
begin
  insert into lances (lote_id, participante_id, nome, centavos, em)
  values (p_lote, p_participante, p_nome, p_centavos, v_agora);

  select fecha_em into v_fecha from lotes where id = p_lote;
  if v_fecha is not null and v_fecha - v_agora <= (p_janela_ms || ' milliseconds')::interval then
    v_fecha := v_agora + (p_janela_ms || ' milliseconds')::interval;
    update lotes set fecha_em = v_fecha where id = p_lote;
  end if;
  return v_fecha;
end;
$$;

-- Coração do automático: olha o maior lance de gente e os limites guardados,
-- e deixa na frente quem tem o maior limite, pagando só o necessário para
-- superar o segundo colocado.
create or replace function resolver_automatico(p_lote uuid, p_janela_ms integer)
returns void
language plpgsql
as $$
declare
  v_lote lotes%rowtype;
  v_maior lances%rowtype;
  v_primeiro limites%rowtype;
  v_segundo limites%rowtype;
  v_alvo integer;
begin
  select * into v_lote from lotes where id = p_lote;

  select * into v_maior
  from lances
  where lote_id = p_lote and not cancelado
  order by centavos desc, em asc
  limit 1;

  select * into v_primeiro
  from limites
  where lote_id = p_lote
  order by maximo_centavos desc, criado_em asc
  limit 1;

  if v_primeiro.participante_id is null then
    return;
  end if;

  select * into v_segundo
  from limites
  where lote_id = p_lote and participante_id <> v_primeiro.participante_id
  order by maximo_centavos desc, criado_em asc
  limit 1;

  -- Quanto o líder precisa pagar: um incremento acima do concorrente mais
  -- forte (outro limite ou o maior lance manual), respeitando o teto dele.
  v_alvo := coalesce(v_lote.lance_inicial_centavos, 0);

  if v_segundo.participante_id is not null then
    v_alvo := greatest(v_alvo, v_segundo.maximo_centavos + v_lote.incremento_centavos);
  end if;

  if v_maior.id is not null and v_maior.participante_id <> v_primeiro.participante_id then
    v_alvo := greatest(v_alvo, v_maior.centavos + v_lote.incremento_centavos);
  end if;

  v_alvo := least(v_alvo, v_primeiro.maximo_centavos);

  -- Já está na frente pelo valor certo: não faz nada.
  if v_maior.id is not null
     and v_maior.participante_id = v_primeiro.participante_id
     and v_maior.centavos >= v_alvo then
    return;
  end if;

  -- O limite do líder não cobre o lance atual: quem está ganhando continua.
  if v_maior.id is not null
     and v_maior.participante_id <> v_primeiro.participante_id
     and v_primeiro.maximo_centavos < v_maior.centavos + v_lote.incremento_centavos then
    return;
  end if;

  perform registrar_lance(p_lote, v_primeiro.participante_id, v_primeiro.nome, v_alvo, p_janela_ms);
end;
$$;

-- Guardar (ou aumentar) o limite de alguém.
create or replace function definir_limite(
  p_lote uuid,
  p_participante uuid,
  p_nome text,
  p_maximo integer,
  p_janela_ms integer default 15000
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
  if v_lote.estado <> 'aberto' or (v_lote.fecha_em is not null and now() >= v_lote.fecha_em) then
    return json_build_object('ok', false, 'erro', 'lote-fechado');
  end if;

  select * into v_maior
  from lances
  where lote_id = p_lote and not cancelado
  order by centavos desc, em asc
  limit 1;

  v_minimo := case
    when v_maior.id is null then v_lote.lance_inicial_centavos
    else v_maior.centavos + v_lote.incremento_centavos
  end;

  if p_maximo < v_minimo then
    return json_build_object('ok', false, 'erro', 'valor-baixo', 'minimo', v_minimo);
  end if;

  insert into limites (lote_id, participante_id, nome, maximo_centavos)
  values (p_lote, p_participante, p_nome, p_maximo)
  on conflict (lote_id, participante_id) do update
    set maximo_centavos = greatest(limites.maximo_centavos, excluded.maximo_centavos),
        nome = excluded.nome,
        criado_em = now();

  perform resolver_automatico(p_lote, p_janela_ms);

  select * into v_maior
  from lances
  where lote_id = p_lote and not cancelado
  order by centavos desc, em asc
  limit 1;

  return json_build_object(
    'ok', true,
    'ganhando', v_maior.participante_id = p_participante,
    'centavos', v_maior.centavos,
    'fecha_em', (select fecha_em from lotes where id = p_lote)
  );
end;
$$;

-- O lance manual continua existindo, mas agora, depois dele, quem tem limite
-- guardado responde na hora.
create or replace function dar_lance(
  p_lote uuid,
  p_participante uuid,
  p_nome text,
  p_centavos integer,
  p_janela_ms integer default 15000,
  p_max_saltos integer default 50,
  p_confirmado boolean default false
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
  if v_lote.estado <> 'aberto' or (v_lote.fecha_em is not null and now() >= v_lote.fecha_em) then
    return json_build_object('ok', false, 'erro', 'lote-fechado');
  end if;

  select * into v_maior
  from lances
  where lote_id = p_lote and not cancelado
  order by centavos desc, em asc
  limit 1;

  if v_maior.id is not null then
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

  if not p_confirmado and p_centavos > v_minimo + v_lote.incremento_centavos * p_max_saltos then
    return json_build_object('ok', false, 'erro', 'confirmar-valor-alto', 'minimo', v_minimo);
  end if;

  v_fecha := registrar_lance(p_lote, p_participante, p_nome, p_centavos, p_janela_ms);

  -- Deixa os limites responderem ao lance que acabou de entrar.
  perform resolver_automatico(p_lote, p_janela_ms);

  select * into v_maior
  from lances
  where lote_id = p_lote and not cancelado
  order by centavos desc, em asc
  limit 1;

  return json_build_object(
    'ok', true,
    'centavos', v_maior.centavos,
    'ganhando', v_maior.participante_id = p_participante,
    'proximo_minimo', v_maior.centavos + v_lote.incremento_centavos,
    'fecha_em', (select fecha_em from lotes where id = p_lote)
  );
end;
$$;

revoke all on function definir_limite(uuid, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function dar_lance(uuid, uuid, text, integer, integer, integer, boolean) from public, anon, authenticated;
