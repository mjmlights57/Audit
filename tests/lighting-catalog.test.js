const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadCatalog() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lighting-catalog.js'), 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.EWPROS_LIGHTING_DEVICE_CATALOG;
}

test('full lighting catalog loads with all supplied categories', () => {
  const catalog = loadCatalog();
  assert.equal(Object.keys(catalog).length, 41); // 40 supplied categories + manual fallback
  assert.ok(Array.isArray(catalog['Compact Fluorescents']));
  assert.ok(Array.isArray(catalog['Eight Foot Fluorescent T8']));
  assert.ok(Array.isArray(catalog['Two Foot Fluorescent T12']));
});

test('dependent device code examples map to the correct categories', () => {
  const catalog = loadCatalog();
  assert.ok(catalog['Compact Fluorescents'].includes('1C0005'));
  assert.ok(catalog['Compact Fluorescents'].includes('1C0011'));
  assert.ok(catalog['Eight Foot Fluorescent T8'].includes('1F59T8NBF'));
  assert.ok(catalog['Eight Foot Fluorescent T12 HO'].includes('4F96T12STM110'));
  assert.ok(catalog['LED Lighting in Reach-In Cases'].includes('1Cooler'));
  assert.ok(catalog['Two Foot Fluorescent T8 U-bend'].includes('2F32T8UHBF-HE'));
});

test('categories with no supplied codes retain manual-entry behavior', () => {
  const catalog = loadCatalog();
  assert.equal(catalog['Five Foot Fluorescent T8'].length, 0);
  assert.equal(catalog['Neon'].length, 0);
  assert.equal(catalog['Other / Not listed'].length, 0);
});

test('catalog contains the complete normalized source code set', () => {
  const catalog = loadCatalog();
  const codes = new Set(Object.values(catalog).flat());
  assert.equal(codes.size, 542);
});
