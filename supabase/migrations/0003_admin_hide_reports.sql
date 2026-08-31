-- Papel de administrador + "esconder" reportes sem apagar do banco.

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.flood_reports add column if not exists hidden_at timestamptz;

-- Admins podem atualizar (esconder) qualquer reporte de qualquer usuário.
-- Usuários comuns continuam sem conseguir editar reportes de outras pessoas.
create policy "admins can hide any flood report"
on public.flood_reports for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin
  )
);

-- Depois de rodar esta migration, torne o SEU usuário admin trocando o e-mail abaixo:
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'seu-email-aqui@exemplo.com');
