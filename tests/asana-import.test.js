const test = require('node:test');
const assert = require('node:assert/strict');
const { parseNotes, parseAsanaCsv, dateAtNoonIso, normalizeAppointmentTime } = require('../netlify/functions/_asana-csv');

test('extracts structured customer details from Asana Notes', () => {
  const notes = `Assignee: Test User\n\nNotes: Facility Name: Sample Market\n\nNotes: Utility: Pepco\n\nNotes: Account Number: 50000000000\n\nNotes: Contact Name: Jane Doe\n\nNotes: Phone: (301) 555-0100\n\nNotes: Email: jane@example.com\n\nNotes: Street Address: 100 Main St\n\nNotes: City: Bowie\n\nNotes: Zipcode: 20720`;
  const result = parseNotes(notes);
  assert.equal(result.facilityName, 'Sample Market');
  assert.equal(result.utility, 'Pepco');
  assert.equal(result.accountNumber, '50000000000');
  assert.equal(result.contactName, 'Jane Doe');
  assert.equal(result.streetAddress, '100 Main St');
  assert.equal(result.city, 'Bowie');
  assert.equal(result.zipcode, '20720');
});

test('parses the current Asana export columns', () => {
  const csv = `Task ID,Name,Section/Column,Assignee,Assignee Email,Due Date,Notes,Projects\n1200000000000001,Sample Market,QEC Approved.,EWPros,support@example.com,2026-07-27,"Notes: Facility Name: Sample Market\n\nNotes: Utility: Pepco\n\nNotes: Account Number: 50000000000\n\nNotes: Contact Name: Jane Doe\n\nNotes: Phone: (301) 555-0100\n\nNotes: Email: jane@example.com\n\nNotes: Street Address: 100 Main St\n\nNotes: City: Bowie\n\nNotes: Zipcode: 20720",On-Going Projects`;
  const result = parseAsanaCsv(csv);
  assert.equal(result.totalRows, 1);
  assert.equal(result.valid.length, 1);
  assert.equal(result.invalid.length, 0);
  const row = result.valid[0].appointment;
  assert.equal(row.external_task_id, '1200000000000001');
  assert.equal(row.customer_name, 'Sample Market');
  assert.equal(row.customer_phone, '(301) 555-0100');
  assert.equal(row.customer_email, 'jane@example.com');
  assert.equal(row.service_address, '100 Main St, Bowie, 20720');
  assert.equal(row.source_payload.account_number, '50000000000');
});

test('flags duplicate Task IDs and incomplete addresses', () => {
  const csv = `Task ID,Name,Due Date,Notes\n1,One,2026-07-20,"Notes: City: Bowie"\n1,Two,2026-07-21,"Notes: Street Address: 2 Main St\n\nNotes: City: Bowie\n\nNotes: Zipcode: 20720"`;
  const result = parseAsanaCsv(csv);
  assert.equal(result.valid.length, 0);
  assert.equal(result.invalid.length, 2);
  assert.match(result.invalid[0].validationErrors.join(' '), /could not be extracted/i);
  assert.match(result.invalid[1].validationErrors.join(' '), /duplicate task id/i);
});

test('stores a due date at noon UTC to preserve its calendar date', () => {
  assert.equal(dateAtNoonIso('2026-07-27'), '2026-07-27T12:00:00.000Z');
});


test('extracts appointment time from Notes', () => {
  const csv = `Task ID,Name,Due Date,Notes\n10,Timed Customer,2026-07-27,"Notes: Street Address: 10 Main St\n\nNotes: City: Bowie\n\nNotes: Zipcode: 20720\n\nNotes: Appointment Time: 10:30 AM"`;
  const result = parseAsanaCsv(csv);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].appointment.source_payload.scheduled_time, '10:30 AM');
});

test('extracts appointment time from a CSV custom field', () => {
  const csv = `Task ID,Name,Due Date,Appointment Time,Notes\n11,Custom Field Customer,2026-07-27,14:15,"Notes: Street Address: 11 Main St\n\nNotes: City: Bowie\n\nNotes: Zipcode: 20720"`;
  const result = parseAsanaCsv(csv);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].appointment.source_payload.scheduled_time, '2:15 PM');
});

test('normalizes common appointment time formats', () => {
  assert.equal(normalizeAppointmentTime('9am'), '9:00 AM');
  assert.equal(normalizeAppointmentTime('09:05 AM'), '9:05 AM');
  assert.equal(normalizeAppointmentTime('16:30'), '4:30 PM');
});
