-- Mise à jour des horaires : mardi – samedi, 10:00 – 19:00 (créneaux de 30 min, dernier 18:30).
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.
create or replace function public.is_bookable(d date, s time) returns boolean
language sql stable security definer set search_path = public as $$
  select
        extract(isodow from d) between 2 and 6
    and s between '10:00' and '18:30' and extract(minute from s) in (0, 30) and extract(second from s) = 0
    and d <= (now() at time zone 'Europe/Paris')::date + 60
    and (d > (now() at time zone 'Europe/Paris')::date
         or (d = (now() at time zone 'Europe/Paris')::date
             and s > ((now() at time zone 'Europe/Paris') + interval '30 minutes')::time))
    and not exists (select 1 from public.blocked_days b where b.day = d);
$$;
