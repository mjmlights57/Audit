const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('v3.1.4 CRM customer notes stay editable after projects exist',()=>{
  const js=read('admin/business.js');
  assert.match(js,/id="customerNotesQuick"/);
  assert.match(js,/Customer notes<textarea name="notes"/);
  assert.match(js,/action:'update_customer',id,patch:\{notes:d\.notes\|\|''\}/);
  assert.match(js,/data-edit-note=/);
  assert.match(js,/action:'update_customer_note'/);
});

test('v3.1.4 CRM list displays latest customer comment before static notes',()=>{
  const data=read('netlify/functions/business-data.js');
  const js=read('admin/business.js');
  assert.match(data,/latestNoteByCustomer/);
  assert.match(data,/latest_comment: latest\?\.note/);
  assert.match(data,/latest_comment_at: latest\?\.created_at/);
  assert.match(js,/c\.latest_comment\|\|c\.notes/);
  assert.match(js,/Latest comment/);
});

test('v3.1.4 exposes update_customer_note in the server action handler',()=>{
  const actions=read('netlify/functions/business-action.js');
  assert.match(actions,/action === 'update_customer_note'/);
  assert.match(actions,/from\('customer_notes'\)\.update\(\{note:required\(body\.note,'Note'\)\}\)/);
});

test('both admin entry points load the v3.1.4 CRM bundle',()=>{
  for(const file of ['admin.html','admin/index.html']){
    const html=read(file);
    assert.match(html,/Administrator · v3\.1\.4/);
    assert.match(html,/business\.js\?v=3\.1\.4/);
  }
});
