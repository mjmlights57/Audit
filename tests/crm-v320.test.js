const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v3.2 new customer requires EWP/MJM brand and updated stages',()=>{
  const html=read('admin/index.html');
  assert.match(html,/EWP\/MJM Customer<select name="customer_brand" required/);
  for(const label of ['Prospects','Customers','Follow-up','Inactive']) assert.match(html,new RegExp(`>${label}<`));
  assert.match(html,/Customer Notes &amp; Requirements<textarea name="notes"/);
});

test('v3.2 customer detail keeps requirements read-only until edit',()=>{
  const js=read('admin/business.js');
  assert.match(js,/crm-contact-label">Customer Notes &amp; Requirements/);
  assert.match(js,/data-crm-open="edit"/);
  assert.match(js,/Customer Notes &amp; Requirements<textarea name="notes"/);
  assert.doesNotMatch(js,/id="customerNotesQuick"/);
  assert.match(js,/Latest Comment/);
});

test('v3.2 activity uses next action task checkboxes and comments',()=>{
  const js=read('admin/business.js');
  assert.match(js,/Next Action Task/);
  assert.match(js,/data-toggle-reminder/);
  assert.match(js,/action:'toggle_reminder'/);
  assert.match(js,/Comments/);
  assert.match(js,/Add comment/);
  assert.match(read('admin/admin.css'),/task-done/);
});

test('v3.2 proposal and invoice tools are branded and PDF-enabled',()=>{
  const html=read('admin/index.html'), doc=read('admin/document-generator.js'), action=read('netlify/functions/business-action.js');
  assert.match(html,/pdf-lib\.min\.js/);
  assert.match(doc,/EWPros, LLC/); assert.match(doc,/MJMLIGHT, LLC/);
  assert.match(doc,/Save &amp; Download PDF/);
  assert.match(doc,/buildProposalPdf/); assert.match(doc,/buildInvoicePdf/);
  assert.match(action,/action === 'save_proposal'/); assert.match(action,/action === 'save_invoice_from_proposal'/);
});

test('v3.2 migration adds brand proposals app notes and stage constraint',()=>{
  const sql=read('EWPROS-V3.2.0-MIGRATION.sql');
  assert.match(sql,/customers add column if not exists customer_brand/);
  assert.match(sql,/customer_type in \('prospect','customer','follow_up','inactive'\)/);
  assert.match(sql,/create table if not exists public\.proposals/);
  assert.match(sql,/create table if not exists public\.app_notes/);
  assert.match(sql,/alter table public\.proposals enable row level security/);
});

test('v3.2 adds eSign and editable Notes page',()=>{
  const html=read('admin/index.html'), js=read('admin/business.js'), admin=read('admin/admin.js');
  assert.match(html,/https:\/\/ewpros\.com\/esign\/index\.php/);
  assert.match(html,/data-view="notes">Notes/);
  assert.match(html,/id="appNotesEditor"/);
  assert.match(js,/save_app_notes/); assert.match(js,/get\('app-notes'\)/); assert.match(admin,/notes:'Notes'/);
});

test('CRM notes list remains ellipsized',()=>{
  assert.match(read('admin/admin.css'),/\.crm-notes-cell\{[^}]*text-overflow:ellipsis/);
});
