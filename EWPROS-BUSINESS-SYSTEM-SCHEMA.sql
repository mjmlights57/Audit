-- EWPros Business Management System v3.0
-- Run this once in Supabase -> SQL Editor after the existing Auditor 2.8 schema is installed.
-- This migration is additive: it does not delete or rename the existing appointments/import tables.

create extension if not exists pgcrypto;

create table if not exists business_lines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into business_lines (code, name) values
  ('strikecheck_inspections', 'StrikeCheck Inspections'),
  ('strikecheck_referrals', 'StrikeCheck Referrals'),
  ('utility_programs', 'Utility Programs'),
  ('ewpros_electrical', 'EWPros Electrical'),
  ('ewpros_renovation', 'EWPros Renovation')
on conflict (code) do update set name = excluded.name, active = true;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  legacy_appointment_id uuid unique,
  external_key text,
  primary_business_line_id uuid references business_lines(id),
  customer_type text not null default 'customer' check (customer_type in ('lead','customer','inactive')),
  display_name text not null,
  company_name text,
  contact_name text,
  phone text,
  email text,
  service_address text,
  mailing_address text,
  city text,
  state_code text,
  zipcode text,
  source text not null default 'manual',
  tags text[] not null default '{}',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table customers add column if not exists primary_business_line_id uuid references business_lines(id);
create index if not exists customers_display_name_idx on customers (lower(display_name));
create index if not exists customers_email_idx on customers (lower(email));

create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  note text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  project_id uuid,
  title text not null,
  details text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  legacy_appointment_id uuid unique,
  external_key text,
  customer_id uuid references customers(id) on delete set null,
  business_line_id uuid not null references business_lines(id),
  project_number text unique,
  name text not null,
  project_type text,
  status text not null default 'lead' check (status in ('lead','scheduled','active','on_hold','completed','cancelled','archived')),
  start_date date,
  end_date date,
  service_address text,
  description text,
  quoted_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_customer_idx on projects(customer_id);
create index if not exists projects_business_line_idx on projects(business_line_id);

alter table reminders drop constraint if exists reminders_project_id_fkey;
alter table reminders add constraint reminders_project_id_fkey foreign key (project_id) references projects(id) on delete cascade;

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  email text,
  address text,
  tax_id_last4 text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  worker_type text not null check (worker_type in ('W2','1099')),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  pay_type text not null default 'hourly' check (pay_type in ('hourly','salary','per_job')),
  pay_rate numeric(12,2) not null default 0,
  overtime_rate numeric(12,2),
  active boolean not null default true,
  payroll_external_id text,
  timesheet_pin_salt text,
  timesheet_pin_hash text,
  timesheet_access_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table workers add column if not exists timesheet_pin_salt text;
alter table workers add column if not exists timesheet_pin_hash text;
alter table workers add column if not exists timesheet_access_enabled boolean not null default true;
create unique index if not exists workers_email_unique_idx on workers(lower(email)) where email is not null;

create table if not exists project_workers (
  project_id uuid not null references projects(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  role text,
  primary key (project_id, worker_id)
);

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references workers(id),
  project_id uuid references projects(id) on delete set null,
  business_line_id uuid not null references business_lines(id),
  work_date date not null,
  regular_hours numeric(8,2) not null default 0 check (regular_hours >= 0),
  overtime_hours numeric(8,2) not null default 0 check (overtime_hours >= 0),
  notes text,
  approval_status text not null default 'submitted' check (approval_status in ('draft','submitted','approved','rejected','paid')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists time_entries_project_idx on time_entries(project_id, work_date);
create index if not exists time_entries_worker_idx on time_entries(worker_id, work_date);

create table if not exists worker_payments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references workers(id),
  project_id uuid references projects(id) on delete set null,
  business_line_id uuid references business_lines(id),
  financial_account_id uuid,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_type text not null default 'labor_payment' check (payment_type in ('labor_payment','advance','reimbursement','other')),
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists mileage_trips (
  id uuid primary key default gen_random_uuid(),
  trip_date date not null,
  worker_id uuid references workers(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  business_line_id uuid not null references business_lines(id),
  origin text not null,
  destination text not null,
  miles numeric(10,2) not null check (miles >= 0),
  purpose text,
  reimbursement_rate numeric(8,4),
  reimbursable boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists chart_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','income','expense')),
  subtype text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into chart_accounts(code,name,account_type,subtype) values
 ('1000','Business Checking','asset','bank'),
 ('1010','Business Savings','asset','bank'),
 ('1100','Accounts Receivable','asset','accounts_receivable'),
 ('1200','Undeposited Funds','asset','other_current_asset'),
 ('2000','Credit Cards','liability','credit_card'),
 ('2100','Accounts Payable','liability','accounts_payable'),
 ('3000','Owner Contributions','equity','owner_contribution'),
 ('3100','Owner Draws','equity','owner_draw'),
 ('3200','Retained Earnings','equity','retained_earnings'),
 ('4000','Inspection Income','income','service_income'),
 ('4010','Referral Income','income','service_income'),
 ('4020','Utility Program Revenue','income','service_income'),
 ('4030','Electrical Revenue','income','service_income'),
 ('4040','Renovation Revenue','income','service_income'),
 ('4050','Other Income','income','other_income'),
 ('5000','Materials','expense','cost_of_goods_sold'),
 ('5010','Direct Labor','expense','cost_of_goods_sold'),
 ('5020','Subcontractor','expense','cost_of_goods_sold'),
 ('6000','Fuel','expense','operating_expense'),
 ('6010','Equipment','expense','operating_expense'),
 ('6020','Insurance','expense','operating_expense'),
 ('6030','Telephone Services','expense','operating_expense'),
 ('6040','Office Services','expense','operating_expense'),
 ('6050','Software & Subscriptions','expense','operating_expense'),
 ('6060','Bank & Merchant Fees','expense','operating_expense'),
 ('6070','Professional Services','expense','operating_expense'),
 ('6080','Advertising & Marketing','expense','operating_expense'),
 ('6090','Mileage & Travel','expense','operating_expense'),
 ('6100','Repairs & Maintenance','expense','operating_expense'),
 ('6110','Other Expense','expense','operating_expense'),
 ('6120','Rent / Lease','expense','operating_expense'),
 ('6130','Utilities (Office/Shop)','expense','operating_expense'),
 ('6140','Office Supplies','expense','operating_expense'),
 ('6150','Tools & Small Equipment','expense','operating_expense'),
 ('6160','Vehicle Maintenance','expense','operating_expense'),
 ('6170','Vehicle Insurance','expense','operating_expense'),
 ('6180','Parking & Tolls','expense','operating_expense'),
 ('6190','Licenses & Permits','expense','operating_expense'),
 ('6200','Training & Certifications','expense','operating_expense'),
 ('6210','Safety / PPE','expense','operating_expense'),
 ('6220','Shipping & Postage','expense','operating_expense'),
 ('6230','Business Meals','expense','operating_expense'),
 ('6240','Taxes & Filing Fees','expense','operating_expense'),
 ('6250','Interest Expense','expense','operating_expense')
on conflict (code) do update set name=excluded.name, account_type=excluded.account_type, subtype=excluded.subtype, active=true;

create table if not exists transaction_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  behavior text not null check (behavior in ('income','expense','owner_contribution','owner_draw','transfer','credit_card_payment','customer_payment','vendor_payment')),
  ledger_account_id uuid references chart_accounts(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into transaction_categories(name,behavior,ledger_account_id)
select x.name, x.behavior, a.id
from (values
 ('Inspection Income','income','4000'),
 ('Referral Income','income','4010'),
 ('Utility Revenue','income','4020'),
 ('Electrical Revenue','income','4030'),
 ('Renovation Revenue','income','4040'),
 ('Other Income','income','4050'),
 ('Materials','expense','5000'),
 ('Labor','expense','5010'),
 ('Subcontractor','expense','5020'),
 ('Fuel','expense','6000'),
 ('Equipment','expense','6010'),
 ('Insurance','expense','6020'),
 ('Telephone Services','expense','6030'),
 ('Office Services','expense','6040'),
 ('Software & Subscriptions','expense','6050'),
 ('Bank Fees','expense','6060'),
 ('Professional Services','expense','6070'),
 ('Advertising','expense','6080'),
 ('Mileage & Travel','expense','6090'),
 ('Repairs & Maintenance','expense','6100'),
 ('Other Expense','expense','6110'),
 ('Rent / Lease','expense','6120'),
 ('Utilities (Office/Shop)','expense','6130'),
 ('Office Supplies','expense','6140'),
 ('Tools & Small Equipment','expense','6150'),
 ('Vehicle Maintenance','expense','6160'),
 ('Vehicle Insurance','expense','6170'),
 ('Parking & Tolls','expense','6180'),
 ('Licenses & Permits','expense','6190'),
 ('Training & Certifications','expense','6200'),
 ('Safety / PPE','expense','6210'),
 ('Shipping & Postage','expense','6220'),
 ('Business Meals','expense','6230'),
 ('Taxes & Filing Fees','expense','6240'),
 ('Interest Expense','expense','6250'),
 ('Owner Contribution','owner_contribution','3000'),
 ('Owner''s Draw (Personal)','owner_draw','3100'),
 ('Transfer','transfer',null),
 ('Credit Card Payment','credit_card_payment','2000'),
 ('Customer Payment','customer_payment','1100'),
 ('Vendor Payment','vendor_payment','2100')
) as x(name,behavior,code)
left join chart_accounts a on a.code = x.code
on conflict (name) do update set behavior=excluded.behavior, ledger_account_id=excluded.ledger_account_id, active=true;

create table if not exists financial_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution text,
  account_type text not null default 'bank' check (account_type in ('bank','credit_card','cash')),
  last4 text,
  ledger_account_id uuid references chart_accounts(id),
  opening_balance numeric(14,2) not null default 0,
  opening_balance_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(name, last4)
);

alter table worker_payments drop constraint if exists worker_payments_financial_account_id_fkey;
alter table worker_payments add constraint worker_payments_financial_account_id_fkey foreign key (financial_account_id) references financial_accounts(id) on delete set null;

create table if not exists bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  financial_account_id uuid not null references financial_accounts(id),
  filename text not null,
  file_type text not null,
  file_hash text not null,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  status text not null default 'preview' check (status in ('preview','completed','failed','undone')),
  imported_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  undone_at timestamptz,
  undone_rows integer not null default 0,
  unique(financial_account_id, file_hash)
);

alter table bank_import_batches add column if not exists undone_at timestamptz;
alter table bank_import_batches add column if not exists undone_rows integer not null default 0;
alter table bank_import_batches drop constraint if exists bank_import_batches_status_check;
alter table bank_import_batches add constraint bank_import_batches_status_check check (status in ('preview','completed','failed','undone'));

create table if not exists transaction_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  keywords text[] not null,
  match_mode text not null default 'any' check (match_mode in ('any','all')),
  category_id uuid references transaction_categories(id),
  business_line_id uuid references business_lines(id),
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  financial_account_id uuid not null references financial_accounts(id),
  import_batch_id uuid references bank_import_batches(id) on delete set null,
  transaction_date date not null,
  posted_date date,
  description text not null,
  original_description text,
  amount numeric(14,2) not null,
  external_id text,
  external_hash text not null,
  category_id uuid references transaction_categories(id),
  business_line_id uuid references business_lines(id),
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  matched_rule_id uuid references transaction_rules(id) on delete set null,
  review_status text not null default 'pending' check (review_status in ('pending','posted','ignored')),
  personal boolean not null default false,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(financial_account_id, external_hash)
);
create index if not exists bank_transactions_date_idx on bank_transactions(transaction_date desc);
create index if not exists bank_transactions_review_idx on bank_transactions(review_status, transaction_date desc);

create table if not exists financial_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('income','expense','owner_contribution','owner_draw','transfer','credit_card_payment','vendor_payment','customer_payment')),
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  category_id uuid references transaction_categories(id),
  business_line_id uuid references business_lines(id),
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  financial_account_id uuid references financial_accounts(id) on delete set null,
  bank_transaction_id uuid unique references bank_transactions(id) on delete set null,
  personal boolean not null default false,
  source text not null default 'manual',
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);
alter table financial_transactions add column if not exists voided_at timestamptz;
alter table financial_transactions add column if not exists void_reason text;

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  memo text,
  source_type text,
  source_id uuid,
  status text not null default 'posted' check (status in ('draft','posted','void')),
  created_at timestamptz not null default now()
);

create table if not exists journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  ledger_account_id uuid not null references chart_accounts(id),
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  business_line_id uuid references business_lines(id),
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((debit = 0 and credit > 0) or (credit = 0 and debit > 0))
);
create index if not exists journal_lines_entry_idx on journal_lines(journal_entry_id);
create index if not exists journal_lines_project_idx on journal_lines(project_id);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  business_line_id uuid references business_lines(id),
  invoice_date date not null,
  due_date date,
  completion_date date,
  status text not null default 'draft' check (status in ('draft','sent','partial','paid','void')),
  subtotal numeric(14,2) not null default 0,
  incentive_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) not null default 0,
  notes text,
  legacy_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  material_cost numeric(14,2) not null default 0,
  labor_cost numeric(14,2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  business_line_id uuid references business_lines(id),
  financial_account_id uuid references financial_accounts(id) on delete set null,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

-- Keep timestamps current.
create or replace function ewpros_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['customers','projects','workers','time_entries','transaction_rules','invoices'] loop
    execute format('drop trigger if exists %I on %I', 'ewpros_touch_' || t, t);
    execute format('create trigger %I before update on %I for each row execute function ewpros_set_updated_at()', 'ewpros_touch_' || t, t);
  end loop;
end $$;

-- Migrate and continuously synchronize existing appointment/customer data.
create or replace function ewpros_sync_appointment_to_crm() returns trigger language plpgsql as $$
declare
  v_customer_id uuid;
  v_line_id uuid;
  v_project_name text;
  v_project_status text;
begin
  select id into v_line_id from business_lines where code = 'utility_programs' limit 1;

  insert into customers(
    legacy_appointment_id, external_key, primary_business_line_id, customer_type, display_name, company_name, contact_name,
    phone, email, service_address, city, state_code, zipcode, source, active
  ) values (
    new.id,
    new.external_task_id,
    v_line_id,
    'customer',
    coalesce(nullif(new.customer_name,''), 'Unnamed Customer'),
    coalesce(new.source_payload->>'company_name', new.source_payload->>'facility_name', new.customer_name),
    new.source_payload->>'contact_name',
    new.customer_phone,
    new.customer_email,
    new.service_address,
    new.source_payload->>'city',
    new.source_payload->>'state',
    new.source_payload->>'zipcode',
    'appointment',
    coalesce(new.source_active,true)
  )
  on conflict (legacy_appointment_id) do update set
    external_key=excluded.external_key,
    primary_business_line_id=excluded.primary_business_line_id,
    display_name=excluded.display_name,
    company_name=excluded.company_name,
    contact_name=excluded.contact_name,
    phone=excluded.phone,
    email=excluded.email,
    service_address=excluded.service_address,
    city=excluded.city,
    state_code=excluded.state_code,
    zipcode=excluded.zipcode,
    active=excluded.active,
    updated_at=now()
  returning id into v_customer_id;

  v_project_name := coalesce(new.source_payload->>'project_id', new.source_payload->>'facility_name', new.customer_name, 'Imported project');
  v_project_status := case
    when not coalesce(new.source_active,true) or new.appointment_status = 'archived' then 'archived'
    when new.appointment_status = 'cancelled' then 'cancelled'
    when new.appointment_status = 'completed' then 'completed'
    when new.scheduled_start is not null then 'scheduled'
    else 'active'
  end;

  insert into projects(
    legacy_appointment_id, external_key, customer_id, business_line_id, project_number, name,
    project_type, status, start_date, service_address, description
  ) values (
    new.id,
    new.external_task_id,
    v_customer_id,
    v_line_id,
    nullif(new.source_payload->>'project_id',''),
    v_project_name,
    'Utility Audit',
    v_project_status,
    coalesce(nullif(new.source_payload->>'scheduled_date','')::date, new.scheduled_start::date),
    new.service_address,
    'Migrated from EWPros Auditor appointment'
  )
  on conflict (legacy_appointment_id) do update set
    external_key=excluded.external_key,
    customer_id=excluded.customer_id,
    name=excluded.name,
    status=excluded.status,
    start_date=excluded.start_date,
    service_address=excluded.service_address,
    updated_at=now();

  return new;
exception when others then
  -- Appointment importing must not fail if optional CRM synchronization encounters malformed legacy data.
  raise warning 'EWPros CRM sync skipped appointment %: %', new.id, sqlerrm;
  return new;
end $$;

drop trigger if exists ewpros_sync_appointment_crm on appointments;
create trigger ewpros_sync_appointment_crm
after insert or update on appointments
for each row execute function ewpros_sync_appointment_to_crm();

-- One-time migration of every existing appointment.
-- This harmless update fires the synchronization trigger once per existing record.
update appointments set updated_at = updated_at;

-- Starter rules requested by EWPros. Rules are matched case-insensitively.
insert into transaction_rules(name,keywords,match_mode,category_id,active,priority)
select x.rule_name, x.keywords, 'any', c.id, true, x.priority
from (values
  ('Callture -> Telephone Services', array['callture']::text[], 'Telephone Services', 10),
  ('ReceptionHQ -> Office Services', array['receptionhq']::text[], 'Office Services', 20),
  ('YMCA -> Owner Draw', array['ymca']::text[], 'Owner''s Draw (Personal)', 30),
  ('Active Cash Visa -> Credit Card Payment', array['active cash visa']::text[], 'Credit Card Payment', 40)
) as x(rule_name,keywords,category_name,priority)
join transaction_categories c on c.name = x.category_name
where not exists (select 1 from transaction_rules r where r.name = x.rule_name);

-- Helpful reporting views.
create or replace view v_project_profitability as
select
  p.id as project_id,
  p.name as project_name,
  p.customer_id,
  p.business_line_id,
  coalesce(sum(case when ft.transaction_type in ('income','customer_payment') and not ft.personal then ft.amount else 0 end),0) as cash_revenue,
  coalesce(sum(case when ft.transaction_type in ('expense','vendor_payment') and not ft.personal then ft.amount else 0 end),0) as direct_expense,
  coalesce((select sum(te.regular_hours * w.pay_rate + te.overtime_hours * coalesce(w.overtime_rate,w.pay_rate*1.5))
            from time_entries te join workers w on w.id=te.worker_id where te.project_id=p.id and te.approval_status in ('approved','paid')),0) as labor_cost
from projects p
left join financial_transactions ft on ft.project_id=p.id and ft.voided_at is null
group by p.id;

comment on table journal_entries is 'Double-entry accounting journal. Reports use posted journal lines; operational transactions are posted here by Netlify Functions.';
comment on table bank_transactions is 'Imported statement rows. Duplicate prevention uses (financial_account_id, external_hash).';

-- -----------------------------------------------------------------------------
-- Security hardening for EWPros v3.0
-- The web app accesses these tables only through trusted Netlify Functions
-- using the Supabase service/secret key. No direct anon/authenticated access is
-- required. Enable RLS and revoke public Data API access.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'business_lines','customers','customer_notes','reminders','projects','vendors',
    'workers','project_workers','time_entries','worker_payments','mileage_trips',
    'chart_accounts','transaction_categories','financial_accounts',
    'bank_import_batches','transaction_rules','bank_transactions',
    'financial_transactions','journal_entries','journal_lines','invoices',
    'invoice_items','payments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

-- The profitability view is consumed only by trusted server-side functions.
-- PostgreSQL views can otherwise bypass underlying RLS depending on ownership,
-- so do not expose this view to browser roles.
revoke all on table public.v_project_profitability from anon, authenticated;
grant select on table public.v_project_profitability to service_role;
