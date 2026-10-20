const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v3.2.1 CRM orders due work first and hides inactive from All Stages',()=>{
  const js=read('admin/business.js');
  assert.match(js,/stage==='all'\?allRows\.filter\(c=>c\.customer_type!=='inactive'\)/);
  assert.match(js,/Number\.POSITIVE_INFINITY/);
  assert.match(js,/ad-bd\|\|String\(a\.display_name/);
  const data=read('netlify/functions/business-data.js');
  assert.match(data,/order\('end_date', \{ ascending: true, nullsFirst: false \}\)\.order\('name'\)/);
});

test('v3.2.1 Activity cards are blue and tasks can be assigned',()=>{
  const js=read('admin/business.js'), css=read('admin/admin.css'), action=read('netlify/functions/business-action.js');
  assert.match(js,/crm-activity-card/);
  assert.match(css,/\.crm-activity-card\{border:2px solid #2563eb\}/);
  assert.match(js,/name="assigned_worker_id"/);
  assert.match(js,/data-task-assignee/);
  assert.match(action,/action === 'assign_reminder'/);
});

test('v3.2.1 new customer has Title and conditional Utility Programs fields',()=>{
  const html=read('admin/index.html'), js=read('admin/business.js'), action=read('netlify/functions/business-action.js');
  assert.match(html,/>Title<input name="contact_name"/);
  assert.match(html,/data-utility-customer-fields/);
  for(const name of ['utility','utility_account_number','business_type']) assert.match(html,new RegExp(`name="${name}"`));
  assert.match(js,/isUtilityBusinessLine/);
  assert.match(js,/utility_programs/);
  assert.match(action,/utility_account_number: clean\(body\.utility_account_number\)/);
});

test('v3.2.1 adds Documents tab with external storage links',()=>{
  const js=read('admin/business.js'), action=read('netlify/functions/business-action.js'), data=read('netlify/functions/business-data.js'), sql=read('EWPROS-V3.2.1-MIGRATION.sql');
  assert.match(js,/data-crm-tab="documents">Documents/);
  assert.match(js,/Google Drive/); assert.match(js,/Dropbox/); assert.match(js,/OneDrive/);
  assert.match(js,/id="customerDocumentQuick"/);
  assert.match(action,/action === 'add_customer_document'/);
  assert.match(action,/action === 'delete_customer_document'/);
  assert.match(data,/customer_documents/);
  assert.match(sql,/create table if not exists public\.customer_documents/);
});

test('v3.2.1 main CRM includes Assigned To filter',()=>{
  const html=read('admin/index.html'), js=read('admin/business.js'), data=read('netlify/functions/business-data.js');
  assert.match(html,/id="crmAssignedFilter"/);
  assert.match(html,/Assigned To: All/);
  assert.match(js,/open_assignee_ids/);
  assert.match(js,/crmAssignedFilter/);
  assert.match(data,/assigned_worker_id/);
  assert.match(data,/open_assignee_ids/);
});

test('v3.2.1 migration is additive and version is cache-busted',()=>{
  const sql=read('EWPROS-V3.2.1-MIGRATION.sql'), html=read('admin/index.html'), pkg=JSON.parse(read('package.json'));
  assert.match(sql,/customers add column if not exists utility text/);
  assert.match(sql,/reminders add column if not exists assigned_worker_id/);
  assert.match(sql,/enable row level security/);
  assert.match(html,/Administrator · v3\.2\.1/);
  assert.match(html,/business\.js\?v=3\.2\.1/);
  assert.equal(pkg.version,'3.2.1');
});
