const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('space type catalog and PEPCO workbook mapping features are present', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'space-types.js'), 'utf8'), sandbox);
  assert.ok(sandbox.window.EWPROS_SPACE_TYPES.spaceTypes.length > 100);
  assert.equal(sandbox.window.EWPROS_SPACE_TYPES.suggestSpaceType('Main Lobby', 'Interior'), 'Lobby - Otherwise');
  assert.equal(sandbox.window.EWPROS_SPACE_TYPES.suggestSpaceType('Parking Lot', 'Exterior'), 'Uncovered Parking Areas and Driveways');

  const admin = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');
  assert.match(admin, /loadPepcoOnlineFromImportedProject/);
  assert.match(admin, /pepcoInventoryFromAudit/);
  assert.match(admin, /exactPDataMatch/);
  assert.match(admin, /exactControlDataMatch/);
  assert.match(admin, /label: 'Propose Measure'/);
  assert.match(admin, /label: 'Ctrl Type'/);
  assert.match(admin, /label: 'Control Type'/);
});

test('PEPCO online dates are enforced dynamically', () => {
  const admin = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');
  assert.match(admin, /applyPepcoOnlineDateRules/);
  assert.match(admin, /dateMonthsFromToday\(2\)/);
  assert.match(admin, /Automatically calculated/);
});

test('Control Data first visible column is Ctrl Type', () => {
  const source = fs.readFileSync(path.join(ROOT, 'control-data.js'), 'utf8');
  assert.match(source, /"label": "Ctrl Type"/);
});
