-- EWPros v3.0.3 additive migration
-- Run after EWPROS-V3.0.2-MIGRATION.sql.
-- Adds the requested category set and preserves historical records.

begin;

-- Support principal and sales-tax payments as balance-sheet transactions rather than P&L expenses.
alter table transaction_categories drop constraint if exists transaction_categories_behavior_check;
alter table transaction_categories add constraint transaction_categories_behavior_check
  check (behavior in ('income','expense','owner_contribution','owner_draw','transfer','credit_card_payment','customer_payment','vendor_payment','loan_principal_payment','sales_tax_payment'));

alter table financial_transactions drop constraint if exists financial_transactions_transaction_type_check;
alter table financial_transactions add constraint financial_transactions_transaction_type_check
  check (transaction_type in ('income','expense','owner_contribution','owner_draw','transfer','credit_card_payment','vendor_payment','customer_payment','loan_principal_payment','sales_tax_payment'));

-- Balance-sheet accounts used by two of the requested categories.
insert into chart_accounts(code,name,account_type,subtype) values
 ('2200','Sales Tax Payable','liability','current_liability'),
 ('2300','Loan Payable','liability','long_term_liability'),
 ('6260','Payroll Taxes','expense','operating_expense'),
 ('6270','Employee Benefits','expense','operating_expense'),
 ('6280','Contractor Labor (1099)','expense','cost_of_goods_sold'),
 ('6290','Legal & Accounting','expense','operating_expense'),
 ('6300','Refunds & Adjustments','expense','operating_expense')
on conflict (code) do update set name=excluded.name, account_type=excluded.account_type, subtype=excluded.subtype, active=true;

-- Rename existing standard categories where possible so existing rules keep their category IDs.
update transaction_categories set name='Permits & Licenses', active=true
where name='Licenses & Permits' and not exists (select 1 from transaction_categories where name='Permits & Licenses');
update transaction_categories set name='Rent & Storage', active=true
where name='Rent / Lease' and not exists (select 1 from transaction_categories where name='Rent & Storage');
update transaction_categories set name='Utilities', active=true
where name='Utilities (Office/Shop)' and not exists (select 1 from transaction_categories where name='Utilities');
update transaction_categories set name='Training & Certification', active=true
where name='Training & Certifications' and not exists (select 1 from transaction_categories where name='Training & Certification');
update transaction_categories set name='Shipping & Delivery', active=true
where name='Shipping & Postage' and not exists (select 1 from transaction_categories where name='Shipping & Delivery');
update transaction_categories set name='Subcontractor (contract a company)', active=true
where name='Subcontractor' and not exists (select 1 from transaction_categories where name='Subcontractor (contract a company)');

-- Requested categories. Existing income and other EWPros categories remain available.
insert into transaction_categories(name,behavior,ledger_account_id)
select x.name, x.behavior, a.id
from (values
 ('Permits & Licenses','expense','6190'),
 ('Tools & Small Equipment','expense','6150'),
 ('Rent & Storage','expense','6120'),
 ('Utilities','expense','6130'),
 ('Training & Certification','expense','6200'),
 ('Legal & Accounting','expense','6290'),
 ('Payroll Wages (W-2 employee wages)','expense','5010'),
 ('Payroll Taxes (Employer payroll taxes)','expense','6260'),
 ('Employee Benefits','expense','6270'),
 ('Contractor Labor (1099)','expense','6280'),
 ('Shipping & Delivery','expense','6220'),
 ('Refunds & Adjustments','expense','6300'),
 ('Interest Expense','expense','6250'),
 ('Loan Payment - Principal','loan_principal_payment','2300'),
 ('Sales Tax Payable','sales_tax_payment','2200'),
 ('Subcontractor (contract a company)','expense','5020')
) as x(name,behavior,code)
join chart_accounts a on a.code=x.code
on conflict (name) do update set behavior=excluded.behavior, ledger_account_id=excluded.ledger_account_id, active=true;

-- Remove old duplicate labels from active selections while preserving historical references.
update transaction_categories set active=false where name='Labor';
update transaction_categories set active=false where name in ('Subcontractor','Licenses & Permits','Rent / Lease','Utilities (Office/Shop)','Training & Certifications','Shipping & Postage');

commit;
