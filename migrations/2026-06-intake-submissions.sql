-- ===========================================================================
-- 2026-06-intake-submissions.sql
-- Synergize Fitness digital intake — Option A single table + RLS + immutability.
-- Idempotent (IF NOT EXISTS / guarded). Apply to live Supabase yxndmpwqvdatkujcukdv.
-- Companion build doc: crawford-site/synergize-intake-build-handoff.md (phases 1-2).
-- ===========================================================================

-- doc_type enum, with forward room for the reserved Growth-Zone disclaimer (spec §1).
do $$ begin
  if not exists (select 1 from pg_type where typname = 'intake_doc_type') then
    create type intake_doc_type as enum
      ('health_screen','liability_waiver','group_policies','online_activity_disclaimer');
  end if;
end $$;

create table if not exists public.intake_submissions (
  id                uuid primary key default gen_random_uuid(),
  contact_id        uuid not null references public.contacts(id) on delete restrict,
  auth_user_id      uuid not null,                       -- denormalized contacts.auth_user_id, for RLS
  doc_type          intake_doc_type not null,
  doc_version       text not null,                       -- e.g. '1.0'
  doc_text_hash     text not null,                       -- SHA-256 of the exact version text shown (server-computed)
  responses         jsonb not null default '{}'::jsonb,  -- per-doc payload (spec §3)
  signature_name    text,                                -- liability_waiver: typed-name signature
  flagged           boolean not null default false,      -- health_screen: any Part-A "yes"
  expires_at        timestamptz,                         -- health_screen: signed_at + 12 months
  reviewed_by       uuid,                                -- flagged-screen review (phase 8)
  reviewed_at       timestamptz,
  review_note       text,
  ip_address        inet,
  user_agent        text,
  signed_at         timestamptz not null default now(),
  record_emailed_at timestamptz,                         -- phase 7
  pdf_storage_path  text,                                -- phase 7
  created_at        timestamptz not null default now()
);

create index if not exists intake_submissions_contact_doc_idx
  on public.intake_submissions (contact_id, doc_type, signed_at desc);
create index if not exists intake_submissions_auth_user_idx
  on public.intake_submissions (auth_user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Members read/insert ONLY their own rows; admin reads go through the
-- service-role data-handler (bypasses RLS by design). No UPDATE/DELETE policy
-- for `authenticated` → signed records are immutable to members.
alter table public.intake_submissions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='intake_submissions'
                   and policyname='intake_self_select') then
    create policy intake_self_select on public.intake_submissions
      for select to authenticated using (auth_user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='intake_submissions'
                   and policyname='intake_self_insert') then
    create policy intake_self_insert on public.intake_submissions
      for insert to authenticated with check (auth_user_id = auth.uid());
  end if;
end $$;

-- ── Immutability guard ─────────────────────────────────────────────────────
-- Block any change to the SIGNED columns after insert, while permitting
-- service-role updates to the OPERATIONAL columns (review + delivery stamping,
-- phases 7-8). The service role connects as `service_role` / bypasses RLS but
-- still fires triggers, so we let it through here; members have no UPDATE policy
-- anyway. Corrections happen via a new versioned record, never by editing history.
create or replace function public.intake_submissions_freeze()
returns trigger language plpgsql as $$
begin
  if current_setting('role', true) = 'service_role'
     or current_user in ('service_role','postgres','supabase_admin') then
    -- privileged callers may stamp operational columns only
    if (new.doc_type, new.doc_version, new.doc_text_hash, new.responses,
        new.signature_name, new.signed_at, new.contact_id, new.auth_user_id,
        new.flagged, new.expires_at)
       is distinct from
       (old.doc_type, old.doc_version, old.doc_text_hash, old.responses,
        old.signature_name, old.signed_at, old.contact_id, old.auth_user_id,
        old.flagged, old.expires_at) then
      raise exception 'intake_submissions: signed columns are immutable';
    end if;
    return new;
  end if;
  raise exception 'intake_submissions: rows are immutable';
end $$;

drop trigger if exists intake_submissions_freeze_trg on public.intake_submissions;
create trigger intake_submissions_freeze_trg
  before update or delete on public.intake_submissions
  for each row execute function public.intake_submissions_freeze();
