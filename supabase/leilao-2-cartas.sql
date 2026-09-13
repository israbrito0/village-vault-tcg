-- Parte 2: base de cartas e preço de referência no lote.
-- Rode no Supabase (SQL Editor) depois do leilao.sql.

-- Base própria de cartas: o que já foi consultado uma vez fica guardado, e o
-- preço que VOCÊ define (preco_manual_centavos) tem prioridade sobre o preço
-- internacional convertido.
create table if not exists cartas (
  id text primary key,                    -- id da TCGdex, ex: "sv04.5-232"
  nome text not null,
  colecao text,
  colecao_id text,
  numero text,
  total_oficial integer,
  raridade text,
  imagem text,
  preco_ref_centavos integer,             -- convertido de Cardmarket/TCGplayer
  preco_manual_centavos integer,          -- o seu preço, quando você define
  fonte text,
  atualizado_em timestamptz not null default now()
);

alter table cartas enable row level security;

drop policy if exists cartas_leitura on cartas;
create policy cartas_leitura on cartas for select to anon, authenticated using (true);

-- O lote guarda de qual carta veio e por quanto ela vale, para mostrar na tela
-- do leilão sem depender de consulta externa na hora.
alter table lotes add column if not exists carta_id text references cartas(id);
alter table lotes add column if not exists preco_ref_centavos integer;
