const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('v3.1.2 CRM list includes next action and due date and shows notes instead of address',()=>{
  const js=read('admin/business.js');
  assert.match(js,/\['Customer','Stage','Next Action','Due Date','Business line','Contact','Notes',''\]/);
  assert.match(js,/c\.next_action/);
  assert.match(js,/c\.due_date/);
  assert.match(js,/c\.notes/);
  const data=read('netlify/functions/business-data.js');
  assert.match(data,/next_action: next\?\.title/);
  assert.match(data,/due_date: next\?\.due_at/);
});

test('v3.1.2 projects use due date ordering and expose archived projects',()=>{
  const html=read('admin.html');
  const js=read('admin/business.js');
  const data=read('netlify/functions/business-data.js');
  const actions=read('netlify/functions/business-action.js');
  assert.match(html,/name="end_date"/);
  assert.match(html,/id="projectViewFilter"/);
  assert.match(html,/Archived projects/);
  assert.match(js,/ad=a\.end_date\|\|'9999-12-31'/);
  assert.match(js,/data-archive-project/);
  assert.match(js,/data-restore-project/);
  assert.match(data,/archivedProjects/);
  assert.match(actions,/action === 'archive_project'/);
  assert.match(actions,/action === 'restore_project'/);
});

test('v3.1.2 accounting and banking requested sections are collapsible',()=>{
  const html=read('admin.html');
  for(const title of ['Accounting categories','Record invoice payment','Record income or expense','Bank import audit trail','Transaction rules','Transaction review queue']){
    assert.match(html,new RegExp(`<summary>${title.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}</summary>`));
  }
});

test('v3.1.2 audit tools collapse includes auditor app and StrikeCheck CRM',()=>{
  const html=read('admin.html');
  assert.match(html,/class="nav-group" open/);
  assert.match(html,/<summary>Audit tools<\/summary>/);
  assert.match(html,/>Auditor app<\/a>/);
  assert.match(html,/href="https:\/\/del57\.netlify\.app\/"[^>]*>StrikeCheck CRM<\/a>/);
});
