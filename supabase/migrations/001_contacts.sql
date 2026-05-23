-- ─────────────────────────────────────────────────────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Contacts table — stores the phone numbers you want to message
create table if not exists public.contacts (
  id          bigint generated always as identity primary key,
  name        text,
  -- Phone number in E.164 format: +447911123456  (country code + number, no spaces)
  phone       text not null unique,
  -- Only send messages to contacts who have opted in (good practice + Meta policy)
  opted_in    boolean not null default false,
  -- Metadata written back after each send attempt
  last_sent_at timestamptz,
  last_status  text,           -- 'sent' | 'failed' | 'delivered' | 'read'
  error_detail text,           -- raw error message from WhatsApp API on failure
  created_at  timestamptz not null default now()
);

-- Message log — one row per send attempt (sent + status updates from webhook)
create table if not exists public.message_log (
  id              bigint generated always as identity primary key,
  contact_id      bigint references public.contacts(id) on delete set null,
  phone           text not null,
  -- 'outbound' = we sent it; 'inbound' = they replied
  direction       text not null default 'outbound',
  message_body    text,
  -- WhatsApp message ID returned by the API — used to match webhook status updates
  wa_message_id   text unique,
  -- 'sent' | 'delivered' | 'read' | 'failed'
  status          text not null default 'sent',
  error_code      text,
  error_message   text,
  sent_at         timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for fast webhook lookups by wa_message_id
create index if not exists message_log_wa_message_id_idx
  on public.message_log(wa_message_id);

-- Row-level security — lock down to service role only (your API routes use service_role key)
alter table public.contacts enable row level security;
alter table public.message_log enable row level security;

-- Allow the service role (used by your Next.js API routes) full access
create policy "service role full access — contacts"
  on public.contacts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role full access — message_log"
  on public.message_log for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ─── Sample data (delete before going live) ──────────────────────────────────
-- insert into public.contacts (name, phone, opted_in) values
--   ('Alice Example', '+447911000001', true),
--   ('Bob Example',   '+447911000002', true);
