const test = require('node:test');
const assert = require('node:assert/strict');
const _test = require('../netlify/functions/_bank-parser');

test('CSV bank parser handles Amount column and debit/credit columns', () => {
  const amountRows = _test.parseCsv('Date,Description,Amount\n08/01/2026,Customer Deposit,225.00\n08/02/2026,Home Depot,-158.44\n');
  assert.equal(amountRows.length, 2);
  assert.equal(amountRows[0].transaction_date, '2026-08-01');
  assert.equal(amountRows[0].amount, 225);
  assert.equal(amountRows[1].amount, -158.44);

  const splitRows = _test.parseCsv('Posted Date,Memo,Deposit,Withdrawal\n08/03/2026,Inspection,350.00,\n08/04/2026,Fuel,,72.11\n');
  assert.equal(splitRows[0].amount, 350);
  assert.equal(splitRows[1].amount, -72.11);
});

test('OFX/QFX parser extracts transaction blocks', () => {
  const rows = _test.parseOfx(`<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260801120000<TRNAMT>-42.15<FITID>abc123<NAME>CALLTURE<MEMO>Monthly service</STMTTRN></BANKTRANLIST></OFX>`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].transaction_date, '2026-08-01');
  assert.equal(rows[0].amount, -42.15);
  assert.equal(rows[0].external_id, 'abc123');
  assert.match(rows[0].description, /CALLTURE/);
});

test('transaction hash prefers stable external ID and account', () => {
  const a = _test.stableTransactionHash('acct-1', { external_id:'FIT-9', transaction_date:'2026-08-01', amount:10, description:'A' });
  const b = _test.stableTransactionHash('acct-1', { external_id:'FIT-9', transaction_date:'2026-08-02', amount:99, description:'B' });
  const c = _test.stableTransactionHash('acct-2', { external_id:'FIT-9', transaction_date:'2026-08-01', amount:10, description:'A' });
  assert.equal(a,b);
  assert.notEqual(a,c);
});
