const test = require('node:test');
const assert = require('node:assert/strict');
const { parseNotes, parseAsanaCsv, dateAtNoonIso, normalizeAppointmentTime, normalizeUtilityProgram } = require('../netlify/functions/_asana-csv');

test('extracts structured customer details from Asana Notes', () => {
  const notes = `Notes: Facility Name: Sample Market\n\nNotes: Utility: Pepco\n\nNotes: Project ID: PEP-2026-001\n\nNotes: Account Number: 50000000000\n\nNotes: Contact Name: Jane Doe\n\nNotes: Phone: (301) 555-0100\n\nNotes: Email: jane@example.com\n\nNotes: Street Address: 100 Main St\n\nNotes: City: Bowie\n\nNotes: Zipcode: 20720`;
  const result = parseNotes(notes);
  assert.equal(result.facilityName, 'Sample Market');
  assert.equal(result.utility, 'Pepco');
  assert.equal(result.projectId, 'PEP-2026-001');
  assert.equal(result.accountNumber, '50000000000');
  assert.equal(result.contactName, 'Jane Doe');
});

test('parses current Asana export columns and normalizes utility', () => {
  const csv = `Task ID,Name,Section/Column,Assignee,Assignee Email,Due Date,Notes,Projects\n1200000000000001,Sample Market,QEC Approved.,EWPros,support@example.com,2026-07-27,"Notes: Facility Name: Sample Market\n\nNotes: Utility: PEPCO\n\nNotes: Project ID: PEP-2026-001\n\nNotes: Account Number: 50000000000\n\nNotes: Contact Name: Jane Doe\n\nNotes: Phone: (301) 555-0100\n\nNotes: Email: jane@example.com\n\nNotes: Street Address: 100 Main St\n\nNotes: City: Bowie\n\nNotes: State: MD\n\nNotes: Zipcode: 20720",On-Going Projects`;
  const result = parseAsanaCsv(csv);
  assert.equal(result.valid.length, 1);
  const row = result.valid[0].appointment;
  assert.equal(row.source_payload.utility, 'PEPCO');
  assert.equal(row.source_payload.project_id, 'PEP-2026-001');
  assert.equal(row.service_address, '100 Main St, Bowie, MD, 20720');
});

test('flags duplicate Task IDs and incomplete addresses', () => {
  const csv = `Task ID,Name,Due Date,Notes\n1,One,2026-07-20,"Notes: City: Bowie"\n1,Two,2026-07-21,"Notes: Street Address: 2 Main St\n\nNotes: City: Bowie\n\nNotes: Zipcode: 20720"`;
  const result = parseAsanaCsv(csv);
  assert.equal(result.valid.length, 0);
  assert.equal(result.invalid.length, 2);
  assert.match(result.invalid[0].validationErrors.join(' '), /could not be extracted/i);
  assert.match(result.invalid[1].validationErrors.join(' '), /duplicate task id/i);
});

test('stores date at noon and normalizes time', () => {
  assert.equal(dateAtNoonIso('2026-07-27'), '2026-07-27T12:00:00.000Z');
  assert.equal(normalizeAppointmentTime('9am'), '9:00 AM');
  assert.equal(normalizeAppointmentTime('16:30'), '4:30 PM');
});

test('normalizes utility descriptions', () => {
  assert.equal(normalizeUtilityProgram('Utility: BGE'), 'BGE');
  assert.equal(normalizeUtilityProgram('Baltimore Gas and Electric'), 'BGE');
  assert.equal(normalizeUtilityProgram('Utility: PEPCO'), 'PEPCO');
  assert.equal(normalizeUtilityProgram('Potomac Electric Power Company'), 'PEPCO');
});
