-- EWPros v3.2.1 additive migration
-- CRM utility-program fields, customer document links, and assigned CRM tasks.
-- Run after the corrected EWPros v3.2.0 migration.
-- This migration does not delete existing customers, projects, tasks, or documents.

begin;

-- Optional Utility Programs details stored on the CRM customer record.
alter table public.customers add column if not exists utility text;
alter table public.customers add column if not exists utility_account_number text;
alter table public.customers add column if not exists business_type text;

-- Assign CRM Next Action Tasks to an existing active Team member.
alter table public.reminders add column if not exists assigned_worker_id uuid references public.workers(id) on delete set null;
create index if not exists reminders_assigned_worker_idx on public.reminders(assigned_worker_id, status, due_at);

-- Link customer documents that live in external storage such as Google Drive or Dropbox.
create table if not exists public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null,
  provider text not null default 'Other' check (provider in ('Google Drive','Dropbox','OneDrive','Other')),
  document_url text not null,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_documents_customer_idx on public.customer_documents(customer_id, created_at desc);

-- Keep CRM document links server-only, consistent with the rest of EWPros business data.
alter table public.customer_documents enable row level security;
revoke all on table public.customer_documents from anon, authenticated;
grant all on table public.customer_documents to service_role;

commit;
