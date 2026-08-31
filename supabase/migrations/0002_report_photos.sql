-- Fotos obrigatórias nos reportes de alagamento.

-- Bucket público (as fotos aparecem no popup do mapa para todo mundo).
insert into storage.buckets (id, name, public)
values ('flood-reports', 'flood-reports', true)
on conflict (id) do nothing;

-- Qualquer pessoa (mesmo anônima) pode VER as fotos, já que o bucket é público.
create policy "flood report photos are publicly viewable"
on storage.objects for select
using (bucket_id = 'flood-reports');

-- Só usuários autenticados podem enviar, e só dentro da própria pasta
-- (o caminho do arquivo é sempre "{user_id}/arquivo.jpg").
create policy "users can upload their own flood report photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'flood-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Coluna da foto na tabela de reportes.
alter table public.flood_reports add column if not exists photo_url text;
update public.flood_reports set photo_url = '' where photo_url is null;
alter table public.flood_reports alter column photo_url set not null;
