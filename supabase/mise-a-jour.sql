-- =====================================================================
--  Mise à jour Elegance (à exécuter une fois dans Supabase : SQL Editor > New query > Run)
--  · horaires mardi – samedi 10:00 – 19:00, créneaux de 30 min (dernier 18:30)
--  · l'admin peut ajouter un rendez-vous à la main, téléphone facultatif
--  Sans danger si exécuté plusieurs fois.
-- =====================================================================
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

alter table public.appointments alter column client_phone drop not null;
alter table public.appointments drop constraint if exists appointments_client_phone_check;
alter table public.appointments add constraint appointments_client_phone_check
  check (client_phone is null or client_phone ~ '^[0-9 +().-]{8,20}$');

drop policy if exists "public peut réserver" on public.appointments;
create policy "public peut réserver" on public.appointments
  for insert to anon, authenticated
  with check (status = 'confirmed' and client_phone is not null and public.is_bookable(day, slot));

drop policy if exists "admin ajoute" on public.appointments;
create policy "admin ajoute" on public.appointments for insert to authenticated with check (public.is_admin());
