-- ===========================================================================
-- 2026-06-health-screen-split.sql
-- Synergize intake — separate sensitive health-screen answers into their own
-- table so AI/admin connectors never touch them incidentally. Companion:
-- intake-security-spec.md (revised) at the projects root.
--
-- WHAT THIS DOES
--   1. Creates public.health_screen_responses (1:1 with intake_submissions).
--   2. Adds an ATOMIC writer function the data-handler calls at submit time, so
--      a health submission and its responses are inserted in one transaction
--      (the immutability trigger blocks DELETE, so a two-step app insert could
--      otherwise orphan a row on partial failure).
--   3. Backfills existing health-screen responses into the new table.
--   4. (Separate, gated section) blanks the responses left behind in
--      intake_submissions — run ONLY after the data-handler is deployed and
--      verified, because the immutability trigger must be toggled to do it.
--
-- ORDER OF OPERATIONS (important):
--   A. Run sections 1–3 below (create table, function, backfill) and STOP at
--      the 3b verification. Confirm moved == source (both 2).
--   B. Deploy the updated data-handler (intake.ts) — it writes new health rows
--      to health_screen_responses and reads them back for the PDF + admin view.
--   C. Submit a test intake, open the admin review, render a PDF — confirm OK.
--   D. THEN run section 4 (blank historical responses).
--
-- Idempotent where practical. Apply in the Supabase SQL editor on yxndmpwqvdatkujcukdv.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Sensitive health-screen content, keyed 1:1 to its submission.
-- ---------------------------------------------------------------------------
create table if not exists public.health_screen_responses (
  submission_id uuid primary key
    references public.intake_submissions(id) on delete cascade,
  contact_id    uuid not null
    references public.contacts(id),
  responses     jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.health_screen_responses is
  'Sensitive health-screen answers (PHIPA reasonable-safeguards). Separated from intake_submissions so they are never exposed incidentally. AI assistants are instructed not to read this table (standing rule in CLAUDE.md). Written only by the data-handler service role; read only by the operator, deliberately.';

create index if not exists health_screen_responses_contact_idx
  on public.health_screen_responses (contact_id);

-- RLS on, no policy: members never read it (the members page reads only
-- non-sensitive status columns from intake_submissions). Service role bypasses
-- RLS by design; ai_connector has no grant, so it is walled regardless.
alter table public.health_screen_responses enable row level security;


-- ---------------------------------------------------------------------------
-- 2. Atomic writer — insert a submission and (for health screens) its responses
--    in ONE transaction. SECURITY INVOKER: runs with the caller's privileges,
--    so only the service role (not ai_connector) can use it for health rows.
-- ---------------------------------------------------------------------------
create or replace function public.intake_submit_record(
  p_contact_id    uuid,
  p_auth_user_id  uuid,
  p_doc_type      intake_doc_type,
  p_doc_version   text,
  p_doc_text_hash text,
  p_responses     jsonb,
  p_signature_name text,
  p_flagged       boolean,
  p_expires_at    timestamptz,
  p_ip_address    inet,
  p_user_agent    text
) returns jsonb
language plpgsql
as $$
declare
  v_id        uuid;
  v_signed_at timestamptz;
  v_is_health boolean := (p_doc_type = 'health_screen');
begin
  insert into public.intake_submissions (
    contact_id, auth_user_id, doc_type, doc_version, doc_text_hash,
    responses, signature_name, flagged, expires_at, ip_address, user_agent
  ) values (
    p_contact_id, p_auth_user_id, p_doc_type, p_doc_version, p_doc_text_hash,
    -- Health answers go to the separate table; keep this column empty for them.
    case when v_is_health then '{}'::jsonb else coalesce(p_responses, '{}'::jsonb) end,
    p_signature_name, coalesce(p_flagged, false), p_expires_at, p_ip_address, p_user_agent
  )
  returning id, signed_at into v_id, v_signed_at;

  if v_is_health then
    insert into public.health_screen_responses (submission_id, contact_id, responses)
    values (v_id, p_contact_id, coalesce(p_responses, '{}'::jsonb));
  end if;

  return jsonb_build_object(
    'id', v_id,
    'doc_type', p_doc_type,
    'flagged', coalesce(p_flagged, false),
    'signed_at', v_signed_at
  );
end $$;

-- Keep the function off the restricted role's surface (defence in depth;
-- SECURITY INVOKER already prevents it writing health rows without grants).
revoke all on function public.intake_submit_record(
  uuid, uuid, intake_doc_type, text, text, jsonb, text, boolean, timestamptz, inet, text
) from public;


-- ---------------------------------------------------------------------------
-- 3. Backfill existing health-screen responses, then VERIFY.
-- ---------------------------------------------------------------------------
-- 3a. Copy (idempotent — skips rows already moved).
insert into public.health_screen_responses (submission_id, contact_id, responses, created_at)
select s.id, s.contact_id, s.responses, s.created_at
from public.intake_submissions s
where s.doc_type = 'health_screen'
  and not exists (
    select 1 from public.health_screen_responses h where h.submission_id = s.id
  );

-- 3b. VERIFY — expect moved == source_health_rows (both 2). STOP if they differ.
select
  (select count(*) from public.health_screen_responses) as moved,
  (select count(*) from public.intake_submissions where doc_type = 'health_screen') as source_health_rows;


-- ===========================================================================
-- 4. BLANK THE LEFT-BEHIND RESPONSES  ——  GATED
--    Run ONLY after: (A) 3b verified, (B) data-handler deployed, (C) a test
--    intake + admin review + PDF confirmed working from the new table.
--
--    The immutability trigger freezes `responses` (and blocks DELETE), so it
--    must be disabled for this one statement, then re-enabled. Run as the table
--    owner / supabase_admin in the SQL editor.
-- ===========================================================================
-- alter table public.intake_submissions disable trigger intake_submissions_freeze_trg;
--
-- update public.intake_submissions
--   set responses = '{}'::jsonb
--   where doc_type = 'health_screen'
--     and responses <> '{}'::jsonb;
--
-- alter table public.intake_submissions enable trigger intake_submissions_freeze_trg;
--
-- -- Confirm none remain:
-- select count(*) as health_rows_with_responses_left
-- from public.intake_submissions
-- where doc_type = 'health_screen' and responses <> '{}'::jsonb;   -- expect 0


-- ===========================================================================
-- ROLLBACK (while you still have the data — i.e. before section 4, or if you
-- kept the originals): re-point reads back to intake_submissions by reverting
-- the data-handler, then optionally:
--   drop function if exists public.intake_submit_record(
--     uuid, uuid, intake_doc_type, text, text, jsonb, text, boolean, timestamptz, inet, text);
--   drop table if exists public.health_screen_responses;
-- If you already ran section 4, restore first:
--   alter table public.intake_submissions disable trigger intake_submissions_freeze_trg;
--   update public.intake_submissions s
--     set responses = h.responses
--     from public.health_screen_responses h
--     where h.submission_id = s.id and s.doc_type = 'health_screen';
--   alter table public.intake_submissions enable trigger intake_submissions_freeze_trg;
-- ===========================================================================
