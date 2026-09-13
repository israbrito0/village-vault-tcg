-- Parte 8: pagamento na hora, com aviso no chat e reprise de quem não paga.
--
-- Lote fecha -> nasce uma cobrança só daquele lote, com prazo. O chat avisa
-- "aguardando fulano pagar". Pagou: o chat avisa. Não pagou no prazo: a
-- cobrança expira e o lote volta para a fila 20% mais barato.

-- Prazo para pagar, por leilão (minutos).
alter table leiloes add column if not exists prazo_pagamento_min integer not null default 5;

-- Lote que voltou por falta de pagamento aponta para o original.
alter table lotes add column if not exists reprise_de uuid references lotes(id);

-- Mensagens do sistema (aguardando, pago, não pagou) aparecem diferente no chat.
alter table mensagens add column if not exists tipo text not null default 'chat';

-- Cobrança agora é por lote, com prazo.
alter table cobrancas add column if not exists lote_id uuid references lotes(id) on delete cascade;
alter table cobrancas add column if not exists pagar_ate timestamptz;

-- A regra antiga era uma cobrança por pessoa por leilão; agora é uma por lote.
alter table cobrancas drop constraint if exists cobrancas_leilao_id_participante_id_key;
create unique index if not exists cobranca_por_lote on cobrancas (lote_id) where lote_id is not null;

-- Estado novo: cobrança que passou do prazo sem pagamento.
alter table cobrancas drop constraint if exists cobrancas_estado_check;
alter table cobrancas add constraint cobrancas_estado_check
  check (estado in ('aberta', 'paga', 'cancelada', 'expirada'));

create index if not exists cobrancas_abertas on cobrancas (estado, pagar_ate);
