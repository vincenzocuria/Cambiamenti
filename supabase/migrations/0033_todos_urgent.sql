-- Cose da fare: voci urgenti (in evidenza e filtrabili).
alter table public.todos add column if not exists urgent boolean not null default false;
