-- ============================================================================
--  Crawford Site — Auth Foundation Migration
--  File: migrations/2026-05-auth-foundation.sql
--  Created: May 2026
--
--  PURPOSE
--  -------
--  Adds the minimum schema needed to put the Growth Zone behind magic-link
--  auth and to gate the new Synergize Members Area.
--
--  Idempotent: safe to re-run. Every change uses IF NOT EXISTS / DO blocks.
--
--  APPLY VIA
--  ---------
--  Supabase SQL editor on the project that owns the `contacts` table
--  (yxndmpwqvdatkujcukdv). Run it once; the trigger and policies persist.
--
--  AUDIT CHECKLIST AFTER RUNNING
--  -----------------------------
--    1. Confirm new columns appear on public.contacts.
--    2. Confirm RLS is enabled on public.contacts.
--    3. Sign up a test user; confirm the auth.users INSERT trigger sets
--       contacts.auth_user_id for the matching email (or creates a row if
--       no contact existed).
--    4. Sign in as that user via the site; confirm Supabase REST returns
--       only that user's contacts row (RLS enforced).
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. Columns on public.contacts
-- ----------------------------------------------------------------------------

-- Auth link. One auth user = one contact row.
alter table public.contacts
  add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contacts_auth_user_id_fkey'
  ) then
    alter table public.contacts
      add constraint contacts_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists contacts_auth_user_id_key
  on public.contacts (auth_user_id)
  where auth_user_id is not null;

-- Coarse-grained access tier (per platform-auth-chat-summary.md).
-- 'public'        — no login, no special access (default for new auth users
--                   who never had a contacts row).
-- 'email_captured'— identified visitor; email-gated Growth Zone tier.
-- 'subscriber'    — paid Growth Zone subscriber.
-- 'client'        — active coaching / WHOLE participant.
alter table public.contacts
  add column if not exists tier text not null default 'public';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contacts_tier_check'
  ) then
    alter table public.contacts
      add constraint contacts_tier_check
      check (tier in ('public', 'email_captured', 'subscriber', 'client'));
  end if;
end $$;

-- Active-status flags. The CRM owns when these flip true/false.
-- These are the inputs to the role-resolution decision tree in spec v1.3 §5.2.
alter table public.contacts
  add column if not exists synergize_active        boolean not null default false;
alter table public.contacts
  add column if not exists coaching_active         boolean not null default false;
alter table public.contacts
  add column if not exists whole_active            boolean not null default false;
alter table public.contacts
  add column if not exists growth_zone_subscribed  boolean not null default false;
alter table public.contacts
  add column if not exists whole_alumni_claimed    boolean not null default false;
alter table public.contacts
  add column if not exists whole_alumni_claim_date timestamptz;


-- ----------------------------------------------------------------------------
--  2. Trigger on auth.users — link contacts row by email
--
--  When a new auth user is created (by magic-link sign-in), look up the
--  contacts row that already has their email. If found, set its
--  auth_user_id. If not, insert a minimal contacts row at tier='public'.
--
--  This is what makes "sign in with the email already on the Synergize
--  billing record" Just Work without separate account creation.
-- ----------------------------------------------------------------------------

create or replace function public.handle_auth_user_linked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalised_email text := lower(trim(new.email));
  v_existing_id uuid;
begin
  if v_normalised_email is null or v_normalised_email = '' then
    return new;
  end if;

  select id into v_existing_id
  from public.contacts
  where lower(email) = v_normalised_email
  limit 1;

  if v_existing_id is not null then
    update public.contacts
      set auth_user_id = new.id
      where id = v_existing_id
        and (auth_user_id is null or auth_user_id <> new.id);
  else
    insert into public.contacts (email, auth_user_id, tier, email_consent)
      values (v_normalised_email, new.id, 'public', false);
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_linked();


-- ----------------------------------------------------------------------------
--  3. Row Level Security on public.contacts
--
--  CRM admin keeps full access via the service-role key (used by the
--  data-handler edge function — service-role bypasses RLS by design).
--  Authenticated end users can only SELECT their own row.
--  No UPDATE/INSERT/DELETE policies for end users — all writes go through
--  service-role via data-handler.
-- ----------------------------------------------------------------------------

alter table public.contacts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'contacts'
      and policyname = 'contacts_self_select'
  ) then
    create policy contacts_self_select
      on public.contacts
      for select
      to authenticated
      using (auth_user_id = auth.uid());
  end if;
end $$;


-- ----------------------------------------------------------------------------
--  4. Notes
-- ----------------------------------------------------------------------------
--
--  The `tier` column is intentionally coarse. The fine-grained role-resolution
--  decision tree (spec v1.3 §5.2) is computed at request time from the active-
--  status flags above, not from `tier` alone. `tier` is used for quick UI gates
--  and reporting; the boolean flags are authoritative for paywalls.
--
--  When a Synergize membership flips to inactive, the CRM is responsible for
--  setting contacts.synergize_active = false. The site's gate logic reads the
--  flag at every page load via supabase.from('contacts').select(...).
--
-- ============================================================================
