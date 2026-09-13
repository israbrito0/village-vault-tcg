-- Parte 7: registro cru dos avisos de pagamento da InfinitePay.
-- Guardar o que a operadora manda evita discussão quando algo não bate.

create table if not exists avisos_pagamento (
  id uuid primary key default gen_random_uuid(),
  nsu text,
  pago boolean not null default false,
  corpo jsonb,
  recebido_em timestamptz not null default now()
);

alter table avisos_pagamento enable row level security;
-- Sem leitura pública: é registro interno.

create index if not exists avisos_por_nsu on avisos_pagamento (nsu, recebido_em desc);
