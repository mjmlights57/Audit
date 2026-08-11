const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDefaults() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'pepco-online-data.js'), 'utf8'), context);
  return context.window.EWPROS_PEPCO_ONLINE;
}

test('PEPCO online worksheet includes all supplied portal-entry defaults', () => {
  const data = loadDefaults();
  assert.equal(data.columns.length, 3);
  assert.equal(data.rows.length, 42);
  assert.ok(data.rows.some(row => row.field === 'Project Name:' && row.value === '0'));
  assert.ok(data.rows.some(row => row.field === 'Expected Completion Date' && row.dateRule === 'twoMonthsFromToday'));
  assert.ok(data.rows.some(row => row.field === 'Application Date *' && row.dateRule === 'today'));
  assert.ok(data.rows.some(row => row.field === 'Check Payable Name *' && row.value === 'EWPros, LLC'));
  assert.ok(data.rows.some(row => row.field === 'Payee Contact Name *' && row.value === 'Mtijan Kamara'));
  assert.ok(data.rows.some(row => row.field === 'Contact Person' && row.value === 'Mtijan Kamara'));
  assert.ok(data.rows.some(row => row.field === 'Phone' && row.value === '1-800-731-6750'));
  assert.ok(data.rows.some(row => row.field === 'Payee Zip Code *' && row.value === '20720'));
});

test('admin PEPCO online tab is editable and links to both utility portals', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'admin', 'admin.js'), 'utf8');
  assert.match(html, /PEPCO Online Portal Entry Worksheet/);
  assert.match(html, /homeenergysavings\.pepco\.com\/business\/apply/);
  assert.match(html, /bgeiconline\.customerapplication\.com/);
  assert.match(html, /pepcoOnlineTable/);
  assert.match(js, /PEPCO_ONLINE_STORAGE_KEY/);
  assert.match(js, /renderPepcoOnline/);
  assert.match(js, /data-duplicate-pepco-online/);
  assert.match(js, /data-delete-pepco-online/);
});
