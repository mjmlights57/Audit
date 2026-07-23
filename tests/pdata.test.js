const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPData() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'p-data.js'), 'utf8'), context);
  return context.window.EWPROS_PDATA;
}

test('PData contains all supplied proposed-device rows and editable columns', () => {
  const data = loadPData();
  assert.equal(data.rows.length, 47);
  assert.equal(data.columns.length, 18);
  assert.ok(data.rows.some(row => row.proposeMeasure === '(2x4)LED40W'));
  assert.ok(data.rows.some(row => row.proposeMeasure === 'Top_Post_151W'));
  assert.ok(data.columns.some(column => column.key === 'proposeMeasure'));
  assert.ok(data.columns.some(column => column.key === 'reportedEfficacy'));
});

test('auditor and admin pages load the shared PData catalog', () => {
  const auditor = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const admin = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');
  assert.match(auditor, /p-data\.js/);
  assert.match(admin, /p-data\.js/);
});

test('equipment workflow supports proposed fields and both areas', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /Proposed Device/);
  assert.match(app, /Proposed Qty/);
  assert.match(app, /data-lighting-area/);
  assert.match(app, /equipmentModes:\{interior:'hvac',exterior:'hvac'\}/);
});
