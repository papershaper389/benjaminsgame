-- Steinzeitdorf: Tabellen und Zugriffsregeln für Supabase
-- Im Supabase-Dashboard unter SQL Editor einmal ausführen (für jedes Projekt).
--
-- Vorher im Dashboard:
--   Authentication → Sign In / Providers → "Allow new users to sign up" ausschalten
--   Authentication → URL Configuration → Site URL und Redirect URLs auf die Adressen der App setzen
-- Spieler anlegen: Authentication → Users → "Invite user", danach unten die Adresse in allowed_emails eintragen.

-- Wer spielen darf. Die App und alle Regeln unten prüfen die E-Mail-Adresse des angemeldeten Kontos.
create table if not exists public.allowed_emails (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

drop policy if exists "eigene Freigabe lesen" on public.allowed_emails;
create policy "eigene Freigabe lesen" on public.allowed_emails
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create or replace function public.is_player() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_player() from public, anon;
grant execute on function public.is_player() to authenticated;

-- Spielstand: eine Zeile je Konto und Umgebung (prod oder beta)
create table if not exists public.saves (
  user_id  uuid not null references auth.users (id) on delete cascade,
  env      text not null check (env in ('prod', 'beta')),
  state    jsonb not null,
  saved_at timestamptz not null,
  primary key (user_id, env)
);
alter table public.saves enable row level security;

drop policy if exists "eigener Spielstand" on public.saves;
create policy "eigener Spielstand" on public.saves
  for all to authenticated
  using (user_id = auth.uid() and public.is_player())
  with check (user_id = auth.uid() and public.is_player());

-- Bestenliste: alle Spieler sehen alle Zeilen, schreiben darf jeder nur die eigene
create table if not exists public.scores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  env        text not null check (env in ('prod', 'beta')),
  name       text not null check (char_length(name) between 1 and 24),
  day        int  not null default 1,
  pop        int  not null default 0,
  era        int  not null default 0,
  buildings  int  not null default 0,
  monument   int  not null default 0 check (monument between 0 and 100),
  points     int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, env)
);
create index if not exists scores_rank on public.scores (env, points desc);
alter table public.scores enable row level security;

drop policy if exists "Bestenliste lesen" on public.scores;
create policy "Bestenliste lesen" on public.scores
  for select to authenticated using (public.is_player());

drop policy if exists "eigene Wertung schreiben" on public.scores;
create policy "eigene Wertung schreiben" on public.scores
  for insert to authenticated with check (user_id = auth.uid() and public.is_player());

drop policy if exists "eigene Wertung ändern" on public.scores;
create policy "eigene Wertung ändern" on public.scores
  for update to authenticated
  using (user_id = auth.uid() and public.is_player())
  with check (user_id = auth.uid() and public.is_player());

-- Live-Aktualisierung der Bestenliste
do $$ begin
  alter publication supabase_realtime add table public.scores;
exception when duplicate_object then null; end $$;

-- Erste Freigabe, Adresse anpassen:
-- insert into public.allowed_emails (email, note) values ('du@example.com', 'Betreiber');
