const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('v3.0.2 captures form references before async work',()=>{
  const js=read('admin/business.js');
  assert.doesNotMatch(js,/e\.currentTarget\.reset\(\)/);
  assert.doesNotMatch(js,/e\.currentTarget\.elements/);
  assert.match(js,/const form=e\.currentTarget;const f=\$\('#bankStatementFile'\)/);
});

test('v3.0.2 exposes safe delete, void and undo controls',()=>{
  const js=read('admin/business.js');
  for(const token of ['delete_account','delete_rule','delete_bank_transaction','undo_bank_import','void_transaction','delete_vendor','delete_worker','delete_time_entry','delete_worker_payment','delete_mileage','delete_customer','delete_project']) {
    assert.match(js,new RegExp(token));
  }
});

test('v3.0.2 includes category management and additive migration',()=>{
  const html=read('admin/index.html');
  const sql=read('EWPROS-V3.0.2-MIGRATION.sql');
  assert.match(html,/id="categoryForm"/);
  assert.match(html,/id="categoryTable"/);
  assert.match(sql,/voided_at/);
  assert.match(sql,/status in \('preview','completed','failed','undone'\)/);
  assert.match(sql,/Office Supplies/);
  assert.match(sql,/Vehicle Maintenance/);
});

test('worker timesheet portal does not dereference currentTarget after await',()=>{
  const js=read('time/time.js');
  assert.doesNotMatch(js,/e\.currentTarget\.elements/);
});
