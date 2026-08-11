const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

test('PEPCO model table and inventory implement automatic model selection', () => {
  const html = fs.readFileSync(path.join(ROOT, 'admin', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');
  assert.match(html, /Proposed LED Device/);
  assert.match(js, /label: 'Model Select'/);
  assert.match(js, /syncPepcoModelsFromInventory/);
  assert.match(js, /M-\$\{String\(models\.length \+ 1\)\.padStart\(2, '0'\)\}/);
  assert.match(js, /dlcEnergyStarId: pData\.dlcEnergyStarId/);
  assert.match(js, /reportedWattage: pData\.reportedWattage/);
});

test('PData and Control Data expose utility-specific incentive columns', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'p-data.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'control-data.js'), 'utf8'), context);
  const pColumns = context.window.EWPROS_PDATA.columns;
  const cColumns = context.window.EWPROS_CONTROL_PDATA.columns;
  assert.ok(pColumns.some(column => column.label === 'BGE Incentives'));
  assert.ok(pColumns.some(column => column.label === 'PEPCO Incentives'));
  assert.ok(pColumns.some(column => column.label === 'Unit Price'));
  assert.ok(cColumns.some(column => column.label === 'BGE Ctrl Incentives'));
  assert.ok(cColumns.some(column => column.label === 'PEPCO Ctrl Incentives'));
});

test('invoice uses branded assets, sequential numbering, workbook lines, and hidden admin references', () => {
  const html = fs.readFileSync(path.join(ROOT, 'admin', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'admin', 'admin.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');
  assert.match(html, /assets\/ewpros-logo\.jpg/);
  assert.match(html, /assets\/authorized-personnel-signature\.jpg/);
  assert.match(html, /loadInvoiceWorkbook/);
  assert.match(js, /INVOICE_SEQUENCE_STORAGE_KEY/);
  assert.match(js, /padStart\(7, '0'\)/);
  assert.match(js, /invoiceFromPepcoWorkbook/);
  assert.match(js, /materialCost = \(projectCost \* 0\.35\)/);
  assert.match(js, /installationCost = \(projectCost \* 0\.65\)/);
  assert.match(js, /projectCost - incentiveAmount/);
  assert.match(css, /invoice-printing \.invoice-lines-table \.admin-reference/);
});

test('complete project archive supports download and restore', () => {
  const html = fs.readFileSync(path.join(ROOT, 'admin', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');
  assert.match(html, /Download all project data/);
  assert.match(html, /uploadProjectArchive/);
  assert.match(js, /buildProjectArchive/);
  assert.match(js, /restoreProjectArchive/);
  assert.match(js, /aw_appointments/);
  assert.match(js, /customer signature/);
});


test('root admin route contains the updated workspace', () => {
  const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
  assert.match(html, /downloadProjectArchive/);
  assert.match(html, /loadInvoiceWorkbook/);
  assert.match(html, /assets\/ewpros-logo\.jpg/);
});
