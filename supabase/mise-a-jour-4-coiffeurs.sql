-- =====================================================================
--  Mise à jour Elegance : 4 coiffeurs (Orhan, Kaan, Taha, Omer).
--  Jusqu'à 4 clients par créneau, un seul par coiffeur ; le client peut choisir son coiffeur.
--  À exécuter une fois dans Supabase : SQL Editor > New query > Run. Sans danger si relancé.
-- =====================================================================
alter table public.appointments add column if not exists barber text
  check (barber is null or char_length(barber) <= 30);
drop index if exists public.appointments_one_per_slot;

-- 4 coiffeurs : jusqu'à 4 clients par créneau, et un seul client par coiffeur.
-- (identique à la liste barbers de config.js)
create or replace function public.slot_capacity() returns integer
language sql immutable as $$ select 4 $$;

-- Refuse un rendez-vous si le créneau est complet ou si le coiffeur choisi est déjà pris.
-- Le verrou empêche deux réservations simultanées de passer. L'erreur 23505 est celle que le site affiche.
create or replace function public.check_slot_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'confirmed' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' and old.day = new.day and old.slot = new.slot
     and old.barber is not distinct from new.barber then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.day::text || ' ' || new.slot::text));
  if (select count(*) from public.appointments a
      where a.day = new.day and a.slot = new.slot and a.status = 'confirmed' and a.id <> new.id)
     >= public.slot_capacity() then
    raise exception 'Créneau complet' using errcode = '23505';
  end if;
  if new.barber is not null and exists (select 1 from public.appointments a
      where a.day = new.day and a.slot = new.slot and a.status = 'confirmed' and a.id <> new.id and a.barber = new.barber) then
    raise exception 'Coiffeur déjà pris sur ce créneau' using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists appointments_capacity on public.appointments;
create trigger appointments_capacity before insert or update of status, day, slot, barber on public.appointments
  for each row execute function public.check_slot_capacity();

-- Occupation des créneaux, sans aucune donnée client : nombre de rdv et coiffeurs déjà pris.
create or replace function public.slot_load(from_day date, to_day date)
returns table (day date, slot time, total integer, barbers text[])
language sql stable security definer set search_path = public as $$
  select a.day, a.slot, count(*)::integer, array_remove(array_agg(a.barber), null)
  from public.appointments a
  where a.status = 'confirmed'
    and a.day between from_day and least(to_day, from_day + 62)
  group by a.day, a.slot;
$$;

-- Créneaux complets (ancienne fonction, gardée pour compatibilité)
create or replace function public.taken_slots(from_day date, to_day date)
returns table (day date, slot time)
language sql stable security definer set search_path = public as $$
  select l.day, l.slot from public.slot_load(from_day, to_day) l where l.total >= public.slot_capacity();
$$;

grant execute on function public.slot_load(date, date) to anon, authenticated;
grant execute on function public.taken_slots(date, date) to anon, authenticated;
