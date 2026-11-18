-- Decisão do PO (RF14): quando um reporte é ocultado por um administrador,
-- os 10 pontos concedidos por ele são removidos do autor.
-- Se o reporte voltar a ficar visível (hidden_at = null), os pontos são devolvidos.
-- O contador de reportes enviados (reports_count) não muda: ele conta envios, não reportes visíveis.

create or replace function public.handle_flood_report_visibility()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.hidden_at is null and new.hidden_at is not null then
    update public.profiles
      set points = greatest(0, points - 10)
      where id = new.user_id;
  elsif old.hidden_at is not null and new.hidden_at is null then
    update public.profiles
      set points = points + 10
      where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_flood_report_visibility on public.flood_reports;
create trigger on_flood_report_visibility
  after update of hidden_at on public.flood_reports
  for each row
  when (old.hidden_at is distinct from new.hidden_at)
  execute function public.handle_flood_report_visibility();
