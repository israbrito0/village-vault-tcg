-- Parte 10: pedidos da loja (carrinho do site).
-- Rode no Supabase (SQL Editor) depois da parte 9.

create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete restrict,
  -- Foto do que foi comprado no momento da compra: nome, preço e quantidade
  -- ficam guardados, mesmo que a planilha mude depois.
  itens jsonb not null,
  subtotal_centavos integer not null check (subtotal_centavos >= 0),
  frete_centavos integer not null default 0,
  frete_servico text,
  endereco_id uuid references enderecos(id) on delete set null,
  endereco jsonb,
  total_centavos integer not null check (total_centavos > 0),
  estado text not null default 'aguardando' check (estado in ('aguardando', 'pago', 'enviado', 'entregue', 'cancelado')),
  link text,
  rastreio text,
  criado_em timestamptz not null default now(),
  pago_em timestamptz
);

create index if not exists pedidos_do_cliente on pedidos (usuario_id, criado_em desc);
create index if not exists pedidos_por_estado on pedidos (estado, criado_em desc);

alter table pedidos enable row level security;

-- O cliente lê os próprios pedidos; quem cria e muda é só a nossa API.
drop policy if exists pedidos_leitura_propria on pedidos;
create policy pedidos_leitura_propria on pedidos
  for select to authenticated
  using (usuario_id = auth.uid());
