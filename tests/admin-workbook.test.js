const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadControlData() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'control-data.js'), 'utf8'), context);
  return context.window.EWPROS_CONTROL_PDATA;
}

test('auditor lighting rows include the requested control type dropdown', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /Ctrl Qty/);
  assert.doesNotMatch(app, /<th>Ctrl#<\/th>/);
  assert.match(app, /Ctrl Type/);
  assert.match(app, /value="OS"/);
  assert.match(app, /value="DL"/);
  assert.match(app, /value="O\+D"/);
  assert.match(app, /value="Ph"/);
  assert.match(app, /ctrlType/);
});

test('control PData is independent and includes the four supplied defaults', () => {
  const data = loadControlData();
  assert.equal(data.rows.length, 4);
  assert.equal(data.columns.length, 10);
  assert.deepEqual(Array.from(data.rows.map(row => row.controlDataToMain)), ['OS', 'DL', 'OD', 'Ph']);
  assert.equal(data.rows[0].controlMeasureCode, 'LC 133');
  assert.equal(data.rows[1].controlMeasureCode, 'LC 121');
  assert.equal(data.rows[2].controlMeasureCode, 'LC 111');
  assert.equal(data.rows[3].otherControlType, 'New Photocell control (Exterior fixtures)');
});

test('admin workspace contains PEPCO workbook and invoice designers', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'admin', 'admin.js'), 'utf8');
  assert.match(html, /General Project Information \(Required\)/);
  assert.match(html, /Lighting Inventory/);
  assert.match(html, /invoiceDocument/);
  assert.match(html, /invoiceCustomerSignature/);
  assert.match(js, /PEPCO_TOP_STORAGE_KEY/);
  assert.match(js, /PEPCO_INVENTORY_STORAGE_KEY/);
  assert.match(js, /localSignedAudits/);
  assert.match(js, /customerSignatureImage/);
  assert.match(js, /data-add-pepco-inventory/);
  assert.match(js, /data-delete-pepco-inventory/);
});
