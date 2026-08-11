const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('v3 administrator includes integrated business modules',()=>{
  const html=read('admin/index.html');
  for(const id of ['view-business-dashboard','view-crm','view-projects','view-banking','view-accounting','view-team','view-mileage','view-reports']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/Sync to CRM \/ Accounting/);
  assert.match(html,/Open worker portal/);
});

test('v3 schema contains shared CRM, ledger, bank import, project costing and worker tables',()=>{
  const sql=read('EWPROS-BUSINESS-SYSTEM-SCHEMA.sql');
  for(const table of ['customers','projects','financial_accounts','bank_transactions','financial_transactions','journal_entries','journal_lines','invoices','workers','time_entries','mileage_trips']) assert.match(sql,new RegExp(`create table if not exists ${table}`,'i'));
  assert.match(sql,/ewpros_sync_appointment_to_crm/);
  assert.match(sql,/v_project_profitability/);
});

test('worker portal submits timesheets without exposing administrator workspace',()=>{
  const html=read('time/index.html');
  const js=read('time/time.js');
  assert.match(html,/Worker sign in/);
  assert.match(html,/Regular hours/);
  assert.match(html,/Overtime/);
  assert.match(js,/worker-timesheet/);
  assert.doesNotMatch(html,/Administrator Dashboard/);
});
