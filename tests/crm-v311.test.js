const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('v3.1.1 CRM main screen is a minimal list workspace',()=>{
  for(const file of ['admin.html','admin/index.html']){
    const html=read(file);
    assert.match(html,/class="crm-workspace"/);
    assert.match(html,/id="crmSearch"/);
    assert.match(html,/id="crmStageFilter"/);
    assert.match(html,/id="crmLineFilter"/);
    assert.match(html,/id="crmCustomerTable"/);
    assert.doesNotMatch(html,/<details class="panel business-form-panel"><summary>Add lead \/ customer/);
  }
});

test('v3.1.1 CRM secondary actions are hidden until requested',()=>{
  const html=read('admin.html');
  assert.match(html,/id="crmCustomerModal" class="crm-modal-overlay hidden"/);
  assert.match(html,/id="crmImportModal" class="crm-modal-overlay hidden"/);
  assert.match(html,/id="crmDetailPanel" class="crm-detail-drawer hidden"/);
});

test('v3.1.1 customer drawer uses four focused tabs and quick actions',()=>{
  const js=read('admin/business.js');
  for(const tab of ['overview','appointments','projects','activity']) assert.match(js,new RegExp(`data-crm-tab="${tab}"`));
  assert.match(js,/data-crm-open="appointment"/);
  assert.match(js,/data-crm-open="project"/);
  assert.match(js,/data-crm-open="edit"/);
  assert.match(js,/const showTab=name=>/);
});

test('v3.1.1 retains CRM import export scheduling and project creation',()=>{
  const js=read('admin/business.js');
  assert.match(js,/previewCrmImport/);
  assert.match(js,/exportCustomers/);
  assert.match(js,/action:'create_appointment'/);
  assert.match(js,/action:'create_project'/);
  assert.match(js,/action:'update_customer'/);
});
