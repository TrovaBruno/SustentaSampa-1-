-- Permite que administradores apaguem qualquer mensagem do chat.
-- Mensagens continuam podendo ser lidas/inseridas normalmente por todos;
-- só o DELETE é restrito a admins.

create policy "admins can delete any chat message"
on public.chat_messages for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin
  )
);
