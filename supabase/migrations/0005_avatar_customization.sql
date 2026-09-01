-- Personalização de avatar: cor selecionada pelo usuário.
-- O desbloqueio de cada cor é calculado no app a partir de profiles.points
-- (marco atingido), não é gasto de pontos — por isso não precisa de coluna
-- extra de "itens desbloqueados".

alter table public.profiles add column if not exists avatar_color text not null default 'default';
