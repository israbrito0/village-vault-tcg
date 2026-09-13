-- Parte 3: lugar para guardar as fotos das cartas.
-- Rode no Supabase (SQL Editor) depois das partes 1 e 2.

-- Balde público: a foto precisa abrir para quem assiste o leilão. Quem escreve
-- é só a nossa API, que usa a chave service_role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leilao', 'leilao', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
