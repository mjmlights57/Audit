-- EWPros v3.2.0 additive migration
-- CRM stages, EWPros/MJMLight customer brand, proposals, invoice linkage, and shared editable app notes.
-- Run after the existing v3.x migrations. This migration does not delete customer/project/accounting data.

begin;

-- Brand / issuing company used by CRM proposals and invoices.
alter table public.customers add column if not exists customer_brand text;
update public.customers set customer_brand='EWPros' where customer_brand is null or btrim(customer_brand)='';
alter table public.customers alter column customer_brand set default 'EWPros';
alter table public.customers alter column customer_brand set not null;
alter table public.customers drop constraint if exists customers_customer_brand_check;
alter table public.customers add constraint customers_customer_brand_check check (customer_brand in ('EWPros','MJMLight'));

-- Replace legacy Lead stage with the new CRM stage set.
-- Drop the legacy check BEFORE changing 'lead' to 'prospect'; otherwise
-- PostgreSQL rejects the update because the old constraint does not allow 'prospect'.
alter table public.customers drop constraint if exists customers_customer_type_check;
update public.customers set customer_type='prospect' where customer_type='lead';
alter table public.customers add constraint customers_customer_type_check
  check (customer_type in ('prospect','customer','follow_up','inactive'));
alter table public.customers alter column customer_type set default 'customer';

-- Proposal records are shared across browsers/users rather than browser-local.
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  brand text not null check (brand in ('EWPros','MJMLight')),
  proposal_date date not null default current_date,
  project_title text not null default 'Electrical Service & Installation',
  scope_of_work text,
  terms_conditions text,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proposals_customer_idx on public.proposals(customer_id, proposal_date desc);

alter table public.invoices add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

-- One shared editable Notes/help page for the administrator app.
create table if not exists public.app_notes (
  note_key text primary key,
  content text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.app_notes(note_key,content)
values ('usage_guide', $$My recommended structure

1. Prospects
Interested, not yet a customer
People transferred from your cold-calling CRM who show interest in your electrical services.
Examples: Wants an estimate, considering a panel upgrade, interested in an EV charger.

2. Customers
Has purchased your service
People who have hired your electrical business, whether the job is ongoing or completed.

Track completed jobs, repeat business, and future follow-ups.

3. Follow-Up
Next action due
People who need another call, quote follow-up, or future outreach.

Use a follow-up date rather than treating this as a separate customer type.

4. Inactive
Contacts that aren't currently progressing toward a sale or receiving planned relationship follow-up.

Examples: Lost opportunities, people who declined, and former customers with no active plan.
Rule for your business
0-6 months since last job
Keep Active if you have a planned follow-up, ongoing work, or a relationship-building plan.
6-12 months
Review the customer. Keep Active if follow-ups are planned; otherwise, consider Inactive.
12+ months without engagement
A reasonable default is Inactive if there are no upcoming jobs, scheduled follow-ups, or ongoing agreements.

Customer Notes & Requirements and Comments

1. Customer Special Requirements / Notes
Purpose: Store important information about the customer that your team should be able to reference anytime.
Examples for your electrical business:
Prefers calls after 4 PM.
Must call before arriving at the property.
Prefers estimates by email.
Interested in an EV charger installation in the future.
Property access instructions.
This information should remain available until it changes or is no longer relevant.

2. Comments
Purpose: Record conversations, updates, decisions, and actions taken over time.
Examples:
Completed the electrical panel upgrade.
Oct 20 - Called customer about additional electrical work; no answer.
Oct 22 - Customer requested a follow-up in six months.
Apr 22 - Called about EV charger installation; customer wants an estimate.
Comments should build a chronological history rather than overwrite previous entries.$$
)
on conflict (note_key) do nothing;

-- Keep sensitive CRM/business data server-only, consistent with the rest of EWPros.
alter table public.proposals enable row level security;
alter table public.app_notes enable row level security;
revoke all on table public.proposals, public.app_notes from anon, authenticated;
grant all on table public.proposals, public.app_notes to service_role;

commit;
