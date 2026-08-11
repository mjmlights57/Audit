-- EWPros v3.0.2 additive migration
-- Safe to run after the v3.0/v3.0.1 business schema.
-- Adds void/undo tracking and common bookkeeping categories.

begin;

alter table financial_transactions add column if not exists voided_at timestamptz;
alter table financial_transactions add column if not exists void_reason text;

alter table bank_import_batches add column if not exists undone_at timestamptz;
alter table bank_import_batches add column if not exists undone_rows integer not null default 0;
alter table bank_import_batches drop constraint if exists bank_import_batches_status_check;
alter table bank_import_batches add constraint bank_import_batches_status_check
  check (status in ('preview','completed','failed','undone'));

insert into chart_accounts(code,name,account_type,subtype) values
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

insert into transaction_categories(name,behavior,ledger_account_id)
select x.name, 'expense', a.id
from (values
 ('Rent / Lease','6120'),
 ('Utilities (Office/Shop)','6130'),
 ('Office Supplies','6140'),
 ('Tools & Small Equipment','6150'),
 ('Vehicle Maintenance','6160'),
 ('Vehicle Insurance','6170'),
 ('Parking & Tolls','6180'),
 ('Licenses & Permits','6190'),
 ('Training & Certifications','6200'),
 ('Safety / PPE','6210'),
 ('Shipping & Postage','6220'),
 ('Business Meals','6230'),
 ('Taxes & Filing Fees','6240'),
 ('Interest Expense','6250')
) as x(name,code)
join chart_accounts a on a.code=x.code
on conflict (name) do update set behavior=excluded.behavior, ledger_account_id=excluded.ledger_account_id, active=true;

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

commit;
