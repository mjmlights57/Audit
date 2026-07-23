const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildAuditCsv,
  buildAuditPdfBytes,
  buildFilledTermsPdfBytes,
  buildFilledBgeTermsPdfBytes,
  buildFilledPepcoTermsPdfBytes,
  normalizeUtilityProgram,
  splitServiceAddress,
  buildFileBaseName
} = require('../audit-export');

const sample = {
  id: 'A-12345', externalTaskId: '120000000001', projectId: 'PEP-2026-001',
  customer: 'Sample Market, LLC', contactName: 'Jane Doe', contactTitle: 'Owner',
  phone: '301-555-0100', email: 'jane@example.com',
  address: '100 Main Street, Bowie, MD 20720', utility: 'PEPCO', signedUtility: 'PEPCO',
  templateVersion: 'PEPCO-04-2025', account: '987654321', date: '2026-07-21', time: '10:30 AM',
  auditor: 'auditor', auditorName: 'EWPros Auditor', status: 'completed', completedAt: '2026-07-21T14:30:00.000Z',
  tasks: { confirm: true, front: true, interior: true, exterior: true, terms: true },
  equipment: {
    interior: [
      { kind: 'hvac', category: 'HVAC', type: 'Heat Pump', manufacturer: 'Acme', model: 'HP-1', serial: 'S123', quantity: 1, location: 'Roof', capacity: '3 tons', efficiency: '16 SEER', condition: 'Good', notes: 'Operating normally' },
      { kind: 'lighting', category: 'Lighting', location: 'Sales floor', over300sf: 'Yes', deviceCategory: 'Compact Fluorescents', deviceCode: '1c0005', quantity: 12, photo: null }
    ],
    exterior: []
  },
  noEquipment: { exterior: true }, photos: { front: null }, notes: 'Customer requested a copy.',
  signatureName: 'Jane Doe', signature: 'Jane Doe',
  signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Q5Z9WQAAAABJRU5ErkJggg==',
  signatureDate: '2026-07-21T14:30:00.000Z'
};

test('builds a readable CSV with HVAC and lighting rows', () => {
  const csv = buildAuditCsv(sample);
  assert.match(csv, /Appointment Number,Asana Task ID/);
  assert.match(csv, /Existing Device Category,Existing Device Code/);
  assert.match(csv, /Equipment Photo File/);
  assert.match(csv, /"Sample Market, LLC"/);
  assert.match(csv, /Heat Pump/);
  assert.match(csv, /Compact Fluorescents/);
  assert.match(csv, /1c0005/);
});

test('builds a PDF byte stream', () => {
  const bytes = buildAuditPdfBytes(sample);
  assert.match(Buffer.from(bytes.slice(0, 8)).toString(), /^%PDF-1\./);
  assert.match(Buffer.from(bytes).toString('latin1'), /Energy Audit Report/);
  assert.match(Buffer.from(bytes).toString('latin1'), /%%EOF/);
});

test('builds a safe filename', () => {
  assert.match(buildFileBaseName(sample), /^EWPros_Audit_A-12345_Sample_Market_LLC_2026-07-21$/);
});

test('normalizes supported utility names', () => {
  assert.equal(normalizeUtilityProgram('Pepco'), 'PEPCO');
  assert.equal(normalizeUtilityProgram('Utility: PEPCO'), 'PEPCO');
  assert.equal(normalizeUtilityProgram('Potomac Electric Power Company'), 'PEPCO');
  assert.equal(normalizeUtilityProgram('Baltimore Gas & Electric'), 'BGE');
  assert.equal(normalizeUtilityProgram('Utility: BGE'), 'BGE');
  assert.equal(normalizeUtilityProgram('Unknown'), '');
});

test('splits a combined service address', () => {
  assert.deepEqual(splitServiceAddress(sample), { street: '100 Main Street', city: 'Bowie', state: 'MD', zip: '20720' });
});

test('fills the attached three-page BGE Terms PDF', async () => {
  const bytes = await buildFilledBgeTermsPdfBytes({ ...sample, utility: 'BGE', signedUtility: 'BGE', templateVersion: 'BGE-C&I-202510' });
  assert.match(Buffer.from(bytes.slice(0, 8)).toString(), /^%PDF-1\./);
  assert.ok(bytes.length > 150000);
  if (process.env.WRITE_SAMPLE_PDF === '1') fs.writeFileSync(path.join(__dirname, 'sample-bge-terms.pdf'), bytes);
});

test('fills the attached three-page PEPCO Terms PDF', async () => {
  const bytes = await buildFilledPepcoTermsPdfBytes(sample);
  assert.match(Buffer.from(bytes.slice(0, 8)).toString(), /^%PDF-1\./);
  assert.ok(bytes.length > 200000);
  if (process.env.WRITE_SAMPLE_PDF === '1') fs.writeFileSync(path.join(__dirname, 'sample-pepco-terms.pdf'), bytes);
});

test('dispatches the correct utility template', async () => {
  const pepco = await buildFilledTermsPdfBytes(sample);
  const bge = await buildFilledTermsPdfBytes({ ...sample, utility: 'BGE', signedUtility: 'BGE' });
  assert.ok(pepco.length > 200000);
  assert.ok(bge.length > 150000);
});
