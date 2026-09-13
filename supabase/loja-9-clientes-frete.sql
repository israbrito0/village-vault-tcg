-- Parte 9: conta do cliente, endereço de entrega e frete.
--
-- A conta em si (e-mail, senha, Google) mora no Supabase Auth: a senha fica
-- lá, criptografada, e ninguém da loja vê. Aqui ficam o perfil e os endereços.

create table if not exists clientes (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  whatsapp text,
  criado_em timestamptz not null default now()
);

create table if not exists enderecos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  cep text not null,
  rua text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  cidade text not null,
  uf text not null check (char_length(uf) = 2),
  principal boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists enderecos_do_cliente on enderecos (cliente_id, principal desc);

-- Cada cliente enxerga e mexe só no que é dele.
alter table clientes enable row level security;
alter table enderecos enable row level security;

drop policy if exists clientes_proprio on clientes;
create policy clientes_proprio on clientes
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists enderecos_proprios on enderecos;
create policy enderecos_proprios on enderecos
  for all to authenticated
  using (cliente_id = auth.uid())
  with check (cliente_id = auth.uid());

-- O participante do leilão passa a ser a conta do cliente.
alter table participantes add column if not exists usuario_id uuid references auth.users(id) on delete set null;
create unique index if not exists participante_por_usuario on participantes (usuario_id) where usuario_id is not null;

-- Frete na cobrança: uma vez por leilão, no primeiro arremate pago.
alter table cobrancas add column if not exists frete_centavos integer not null default 0;
alter table cobrancas add column if not exists frete_servico text;
alter table cobrancas add column if not exists endereco_id uuid references enderecos(id) on delete set null;
