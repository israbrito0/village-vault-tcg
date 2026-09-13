-- Parte 4: um preço para cada condição da carta (NM, SP, MP, HP, D).
-- Rode no Supabase (SQL Editor) depois das partes anteriores.

create table if not exists precos_condicao (
  carta_id text not null references cartas(id) on delete cascade,
  condicao text not null check (condicao in ('NM', 'SP', 'MP', 'HP', 'D', 'M')),
  centavos integer not null check (centavos > 0),
  fonte text,
  atualizado_em timestamptz not null default now(),
  primary key (carta_id, condicao)
);

alter table precos_condicao enable row level security;
-- Sem política de leitura pública: preço por condição é informação da casa,
-- só a nossa API (service_role) enxerga.
