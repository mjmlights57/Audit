const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('v3.0.3 root admin exposes category management',()=>{
  const html=read('admin.html');
  assert.match(html,/id="categoryForm"/);
  assert.match(html,/id="categoryTable"/);
});

test('v3.0.3 bank file selection enables import control',()=>{
  const js=read('admin/business.js');
  assert.match(js,/bankStatementFile'\)\?\.addEventListener\('change'/);
  assert.match(js,/button\.disabled=!hasFile/);
  assert.match(js,/Preview statement is optional/);
});

test('v3.0.3 requested category migration is present',()=>{
  const sql=read('EWPROS-V3.0.3-MIGRATION.sql');
  for(const name of [
    'Permits & Licenses','Tools & Small Equipment','Rent & Storage','Utilities','Training & Certification',
    'Legal & Accounting','Payroll Wages (W-2 employee wages)','Payroll Taxes (Employer payroll taxes)',
    'Employee Benefits','Contractor Labor (1099)','Shipping & Delivery','Refunds & Adjustments',
    'Interest Expense','Loan Payment - Principal','Sales Tax Payable','Subcontractor (contract a company)'
  ]) assert.match(sql,new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(sql,/active=false where name='Labor'/);
});

test('loan principal and sales tax payments are non-P&L supported types',()=>{
  const core=read('netlify/functions/_business-core.js');
  const sql=read('EWPROS-V3.0.3-MIGRATION.sql');
  assert.match(core,/loan_principal_payment/);
  assert.match(core,/sales_tax_payment/);
  assert.match(sql,/Loan Payable/);
  assert.match(sql,/Sales Tax Payable/);
});
