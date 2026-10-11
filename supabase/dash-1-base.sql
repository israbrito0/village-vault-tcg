-- Dash Village: o painel das lives da Jamble no site.
--
-- Quem escreve é só a API do site (chave de serviço), com o que a extensão do
-- Edge manda: ela lê o que a própria página da live recebe. Por isso todas as
-- tabelas têm RLS ligado e nenhuma política -- a chave pública não lê nada.

create extension if not exists pgcrypto;

-- Quem pode entrar no painel e de qual conta (vendedor) ele vê as lives.
create table if not exists dash_membros (
  email text primary key,
  conta text not null,
  papel text not null default 'dono',
  recursos text[] not null default array['painel','sorteios','tela','lives','clientes'],
  criado_em timestamptz not null default now()
);

-- Preferências de cada conta e a chave das telas do OBS (link sem login).
create table if not exists dash_config (
  conta text primary key,
  tela_chave text not null default encode(gen_random_bytes(18), 'hex'),
  termos_carpa text not null default 'magikarp_shiny',
  preferencias jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- Uma linha por live vista pela extensão (da conta ou de outro vendedor).
create table if not exists dash_lives (
  show_id text primary key,
  conta text not null,
  vendedor text,
  titulo text,
  capa_url text,
  inicio timestamptz,
  fim timestamptz,
  ao_vivo boolean not null default false,
  audiencia int,
  audiencia_pico int,
  likes int,
  metricas jsonb not null default '{}'::jsonb,
  participacao jsonb not null default '[]'::jsonb,
  leilao jsonb,
  batalha jsonb,
  visto_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);
create index if not exists dash_lives_conta on dash_lives (conta, inicio desc);
create index if not exists dash_lives_vendedor on dash_lives (vendedor, inicio desc);

-- Cada emotion (gema) enviada, com o id que a própria Jamble dá.
create table if not exists dash_emocoes (
  id text primary key,
  show_id text not null references dash_lives(show_id) on delete cascade,
  handle text,
  nome text,
  foto text,
  icone text,
  gemas int not null default 0,
  time text,
  ts timestamptz not null
);
create index if not exists dash_emocoes_live on dash_emocoes (show_id, ts desc);

-- Mensagens do chat.
create table if not exists dash_chat (
  id text primary key,
  show_id text not null references dash_lives(show_id) on delete cascade,
  handle text,
  nome text,
  foto text,
  texto text,
  ts timestamptz not null
);
create index if not exists dash_chat_live on dash_chat (show_id, ts desc);

-- Cada venda (leilão, compra direta, morte súbita), já com quem comprou.
create table if not exists dash_vendas (
  id text primary key,
  show_id text not null references dash_lives(show_id) on delete cascade,
  conta text not null,
  vendedor text,
  titulo text,
  imagem text,
  comprador text,
  foto text,
  preco numeric(12,2),
  quantidade int not null default 1,
  total numeric(12,2),
  tipo text,
  pago boolean,
  cancelado boolean not null default false,
  ts timestamptz not null,
  atualizado_em timestamptz not null default now()
);
create index if not exists dash_vendas_live on dash_vendas (show_id, ts desc);
create index if not exists dash_vendas_cliente on dash_vendas (conta, vendedor, comprador);

-- Ranking mensal de vendedores da Jamble, como a extensão viu.
create table if not exists dash_ranking (
  conta text not null,
  ts timestamptz not null default now(),
  mes text not null,
  pontos bigint,
  posicao int,
  acima jsonb,
  abaixo jsonb,
  lista jsonb,
  primary key (conta, ts)
);

-- Sorteios do painel e quem ganhou.
create table if not exists dash_sorteios (
  id uuid primary key default gen_random_uuid(),
  show_id text not null references dash_lives(show_id) on delete cascade,
  conta text not null,
  nome text not null,
  premio text,
  fonte text not null,
  peso text not null default 'quantidade',
  repetir boolean not null default true,
  excluir_suspeitos boolean not null default true,
  excluir text[] not null default '{}',
  modo text not null default 'livre',
  a_cada int,
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists dash_sorteios_live on dash_sorteios (show_id, ordem);

create table if not exists dash_ganhadores (
  id uuid primary key default gen_random_uuid(),
  sorteio_id uuid not null references dash_sorteios(id) on delete cascade,
  show_id text not null,
  handle text not null,
  foto text,
  bilhetes int,
  total_bilhetes int,
  participantes int,
  marco int,
  status text not null default 'valido',
  ts timestamptz not null default now()
);
create index if not exists dash_ganhadores_sorteio on dash_ganhadores (sorteio_id, ts);

-- Metas da live (ranking do mês, gemas, carpas, vendas, itens).
create table if not exists dash_metas (
  id uuid primary key default gen_random_uuid(),
  show_id text not null references dash_lives(show_id) on delete cascade,
  conta text not null,
  nome text,
  tipo text not null,
  alvo numeric not null,
  premio text,
  ativo boolean not null default true,
  batida_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table dash_membros enable row level security;
alter table dash_config enable row level security;
alter table dash_lives enable row level security;
alter table dash_emocoes enable row level security;
alter table dash_chat enable row level security;
alter table dash_vendas enable row level security;
alter table dash_ranking enable row level security;
alter table dash_sorteios enable row level security;
alter table dash_ganhadores enable row level security;
alter table dash_metas enable row level security;
