const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('v3.0.4 import button is not HTML-disabled in either admin entry point',()=>{
  for(const file of ['admin.html','admin/index.html']){
    const html=read(file);
    const tag=html.match(/<button id="confirmBankImport"[^>]*>/)?.[0]||'';
    assert.ok(tag,'confirmBankImport button exists');
    assert.doesNotMatch(tag,/\bdisabled\b/);
  }
});

test('v3.0.4 bank import remains clickable and validates at click time',()=>{
  const js=read('admin/business.js');
  assert.match(js,/function syncBankImportUi\(\)/);
  assert.match(js,/button\.disabled=false/);
  assert.match(js,/Choose a CSV, OFX, or QFX statement file first/);
  assert.match(js,/addEventListener\('change',bankFileChanged\)/);
  assert.match(js,/addEventListener\('input',bankFileChanged\)/);
  assert.match(js,/finally\{button\.textContent='Import transactions';syncBankImportUi\(\);\}/);
});

test('v3.0.4 cache-busts the business bundle',()=>{
  assert.match(read('admin.html'),/business\.js\?v=3\.0\.4/);
  assert.match(read('admin/index.html'),/business\.js\?v=3\.0\.4/);
});

test('v3.0.4 worker removal uses clear in-app confirmation instead of window.confirm',()=>{
  const js=read('admin/business.js');
  assert.match(js,/function askConfirmation/);
  assert.doesNotMatch(js,/window\.confirm\(/);
  assert.match(js,/title:'Remove worker',confirmLabel:'Remove worker'/);
  assert.match(js,/data-worker-name/);
});
