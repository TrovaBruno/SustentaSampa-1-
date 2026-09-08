-- Limita cada usuário a no máximo 3 reportes de alagamento por hora.
-- Aplicado como trigger no banco, então não tem como burlar chamando a API
-- diretamente (a proteção não depende do app respeitar isso).

create or replace function public.enforce_flood_report_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.flood_reports
  where user_id = new.user_id
    and created_at >= now() - interval '1 hour';

  if recent_count >= 3 then
    raise exception 'RATE_LIMIT_EXCEEDED: máximo de 3 reportes por hora'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_flood_report_rate_limit_trigger on public.flood_reports;
create trigger enforce_flood_report_rate_limit_trigger
before insert on public.flood_reports
for each row execute function public.enforce_flood_report_rate_limit();
