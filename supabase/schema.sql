-- =====================================================================
--  Elegance Strasbourg — réservation en ligne (Supabase / PostgreSQL)
--  À exécuter une fois dans Supabase : SQL Editor > New query > Run.
--  Les horaires ci-dessous doivent rester identiques à config.js.
-- =====================================================================

-- ---------- Tables ----------
create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  day          date not null,
  slot         time not null,
  service      text not null check (char_length(service) between 1 and 60),
  price        integer,
  client_name  text not null check (char_length(client_name) between 2 and 80),
  client_phone text check (client_phone is null or client_phone ~ '^[0-9 +().-]{8,20}$'),
  client_email text check (client_email is null or client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  note         text check (note is null or char_length(note) <= 300),
  barber       text check (barber is null or char_length(barber) <= 30),  -- null = sans préférence
  status       text not null default 'confirmed' check (status in ('confirmed', 'cancelled'))
);


-- Jours fermés exceptionnellement (congés, formation…)
create table if not exists public.blocked_days (
  day    date primary key,
  reason text
);

-- Comptes autorisés à ouvrir la page admin
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Règles d'ouverture (identiques à config.js) ----------
-- Mardi (2) à samedi (6), 10:00 – 19:00 ; créneaux de 30 min, dernier créneau 18:30.
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

-- ---------- Capacité : 4 coiffeurs ----------
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

-- ---------- Sécurité (Row Level Security) ----------
alter table public.appointments enable row level security;
alter table public.blocked_days enable row level security;
alter table public.admins       enable row level security;

-- Le public peut seulement créer un rendez-vous valide (jamais lire ceux des autres).
drop policy if exists "public peut réserver" on public.appointments;
create policy "public peut réserver" on public.appointments
  for insert to anon, authenticated
  with check (status = 'confirmed' and client_phone is not null and public.is_bookable(day, slot));

-- L'admin ajoute des rendez-vous à la main (clients au téléphone ou au salon), à n'importe quelle heure.
drop policy if exists "admin ajoute" on public.appointments;
create policy "admin ajoute" on public.appointments for insert to authenticated with check (public.is_admin());

-- L'admin voit, modifie et supprime tout.
drop policy if exists "admin lit" on public.appointments;
create policy "admin lit" on public.appointments for select to authenticated using (public.is_admin());
drop policy if exists "admin modifie" on public.appointments;
create policy "admin modifie" on public.appointments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin supprime" on public.appointments;
create policy "admin supprime" on public.appointments for delete to authenticated using (public.is_admin());

-- Les jours fermés sont publics (le site les grise) ; seul l'admin les gère.
drop policy if exists "jours fermés publics" on public.blocked_days;
create policy "jours fermés publics" on public.blocked_days for select to anon, authenticated using (true);
drop policy if exists "admin gère jours fermés" on public.blocked_days;
create policy "admin gère jours fermés" on public.blocked_days for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin se voit" on public.admins;
create policy "admin se voit" on public.admins for select to authenticated using (user_id = auth.uid());

-- Accès explicites (fonctionne même si « Afficher automatiquement les nouvelles tables » est décoché)
grant usage on schema public to anon, authenticated;
grant insert on public.appointments to anon, authenticated;
grant select, update, delete on public.appointments to authenticated;
grant select on public.blocked_days to anon, authenticated;
grant insert, update, delete on public.blocked_days to authenticated;
grant select on public.admins to authenticated;

grant execute on function public.taken_slots(date, date) to anon, authenticated;
grant execute on function public.slot_load(date, date) to anon, authenticated;
grant execute on function public.is_bookable(date, time) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------- Donner l'accès admin ----------
-- 1. Supabase > Authentication > Users > Add user (ton e-mail + un mot de passe).
-- 2. Remplace l'e-mail ci-dessous puis exécute cette ligne :
-- insert into public.admins (user_id) select id from auth.users where email = 'ton-email@exemple.fr';
