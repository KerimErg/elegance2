-- Mise à jour des horaires : mardi – samedi, 10:00 – 19:00 (dernier créneau 18:00).
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.
create or replace function public.is_bookable(d date, s time) returns boolean
language sql stable security definer set search_path = public as $$
  select
        extract(isodow from d) between 2 and 6
    and s in ('10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00')
    and d <= (now() at time zone 'Europe/Paris')::date + 60
    and (d > (now() at time zone 'Europe/Paris')::date
         or (d = (now() at time zone 'Europe/Paris')::date
             and s > ((now() at time zone 'Europe/Paris') + interval '30 minutes')::time))
    and not exists (select 1 from public.blocked_days b where b.day = d);
$$;
