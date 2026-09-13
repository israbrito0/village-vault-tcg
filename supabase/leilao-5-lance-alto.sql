-- Parte 5: lance alto passa a ser confirmado, não recusado.
-- Antes, um salto grande batia na trava contra dedo gordo. Agora a tela
-- pergunta "é isso mesmo?" e manda confirmado; sem confirmação, a trava
-- continua valendo.

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

  -- Salto grande só passa confirmado: evita 15000 no lugar de 150, sem
  -- impedir quem quer mesmo arrematar de uma vez.
  if not p_confirmado and p_centavos > v_minimo + v_lote.incremento_centavos * p_max_saltos then
    return json_build_object('ok', false, 'erro', 'confirmar-valor-alto', 'minimo', v_minimo);
  end if;

  insert into lances (lote_id, participante_id, nome, centavos, em)
  values (p_lote, p_participante, p_nome, p_centavos, v_agora)
  returning id into v_id;

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

revoke all on function dar_lance(uuid, uuid, text, integer, integer, integer, boolean) from public, anon, authenticated;
