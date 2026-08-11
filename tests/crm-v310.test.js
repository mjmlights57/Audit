const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const crmImport = require('../netlify/functions/_crm-csv');

test('v3.1 CRM is the master customer workspace with import, export and scheduling', () => {
  const html = read('admin.html');
  const js = read('admin/business.js');
  assert.match(html,/Administrator · v3\.1\.0/);
  assert.match(html,/Import customers/);
  assert.match(html,/Export all customers \(CSV\)/);
  assert.match(html,/Master customer records used by appointments/);
  assert.match(js,/action:'create_appointment'/);
  assert.match(js,/Schedule appointment/);
  assert.match(js,/Edit master customer record/);
  assert.match(js,/create_project/);
});

test('v3.1 appointment migration links appointments to customer, project, line and worker', () => {
  const sql = read('EWPROS-V3.1.0-MIGRATION.sql');
  for (const column of ['customer_id','project_id','business_line_id','assigned_worker_id','auditor_visible','crm_created']) {
    assert.match(sql,new RegExp(`appointments add column if not exists ${column}`));
  }
  assert.match(sql,/before insert or update on public\.appointments/);
  assert.match(sql,/new\.customer_id := v_customer_id/);
  assert.match(sql,/where legacy_appointment_id = new\.id/);
});

test('CRM CSV parser recognizes common customer headers and line names', () => {
  const csv = [
    'Customer Name,Contact Name,Phone,Email,Service Address,City,State,Zip,Business Line,Stage',
    'ABC Hair Salon,Sarah,301-555-1000,sarah@example.com,123 Main St,Bowie,MD,20715,Utility Programs,Lead'
  ].join('\n');
  const parsed = crmImport.parseCustomerCsv(csv,{default_business_line_id:'fallback',default_customer_type:'customer'},[
    {id:'utility-id',code:'utility_programs',name:'Utility Programs'}
  ]);
  assert.equal(parsed.rows.length,1);
  assert.equal(parsed.rows[0].customer.display_name,'ABC Hair Salon');
  assert.equal(parsed.rows[0].customer.primary_business_line_id,'utility-id');
  assert.equal(parsed.rows[0].customer.customer_type,'lead');
});

test('CRM duplicate matching prefers email then phone then name and address', () => {
  const existing=[{id:'1',display_name:'ABC Hair Salon',email:'sarah@example.com',phone:'3015551000',service_address:'123 Main St'}];
  assert.equal(crmImport.customerMatch(existing,{display_name:'Other',email:'SARAH@example.com',phone:'',service_address:''}).matchedBy,'email');
  assert.equal(crmImport.customerMatch(existing,{display_name:'Other',email:'',phone:'(301) 555-1000',service_address:''}).matchedBy,'phone');
  assert.equal(crmImport.customerMatch(existing,{display_name:'abc hair salon',email:'',phone:'',service_address:'123 main st'}).matchedBy,'name + address');
});

test('Auditor Wizard accepts CRM appointments and no longer labels assignment as Asana-only', () => {
  const app = read('app.js');
  const getter = read('netlify/functions/get-appointments.js');
  assert.match(getter,/\.eq\('auditor_visible', true\)/);
  assert.match(getter,/sourceSystem: row\.source_system/);
  assert.match(app,/Assigned auditor:/);
  assert.doesNotMatch(app,/Asana assignee:/);
});

test('CRM export-style headers can be imported back into CRM', () => {
  const csv = [
    'display_name,company_name,contact_name,phone,email,service_address,city,state_code,zipcode,business_line,customer_type,source,notes',
    'Export Test,Export Test,Pat,3015552222,pat@example.com,10 Test Rd,Bowie,MD,20715,Utility Programs,customer,manual,Imported again'
  ].join('\n');
  const parsed = crmImport.parseCustomerCsv(csv,{default_business_line_id:'fallback',default_customer_type:'lead'},[
    {id:'utility-id',code:'utility_programs',name:'Utility Programs'}
  ]);
  assert.equal(parsed.rows[0].customer.display_name,'Export Test');
  assert.equal(parsed.rows[0].customer.contact_name,'Pat');
  assert.equal(parsed.rows[0].customer.primary_business_line_id,'utility-id');
});

test('CRM field appointments require an assigned worker and use CRM assignment metadata', () => {
  const action = read('netlify/functions/business-action.js');
  const getter = read('netlify/functions/get-appointments.js');
  assert.match(action,/Choose a worker\/auditor before sending this appointment to Auditor Wizard/);
  assert.match(action,/appointment_status:crmStatus/);
  assert.match(action,/assigned_worker_name: workerName/);
  assert.match(getter,/payload\.assigned_worker_name \|\| payload\.asana_assignee_name/);
});
