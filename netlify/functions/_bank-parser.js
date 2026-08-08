const crypto = require('crypto');

let Papa = null;
try { Papa = require('papaparse'); } catch (_) { /* Optional local fallback; Netlify installs declared dependencies. */ }

function money(value) {
  const n = Number(value || 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function parseMoney(value) {
  if (value == null || value === '') return 0;
  let text = String(value).trim().replace(/[$,]/g, '');
  const parenNegative = /^\(.*\)$/.test(text);
  text = text.replace(/[()]/g, '');
  const n = Number(text);
  if (!Number.isFinite(n)) return 0;
  return parenNegative ? -Math.abs(n) : n;
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const slash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (slash) {
    let year = Number(slash[3]); if (year < 100) year += 2000;
    return `${String(year).padStart(4,'0')}-${String(Number(slash[1])).padStart(2,'0')}-${String(Number(slash[2])).padStart(2,'0')}`;
  }
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return '';
}

const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
function field(row, candidates) {
  const entries = Object.entries(row || {});
  for (const candidate of candidates) {
    const found = entries.find(([k]) => key(k) === key(candidate));
    if (found && found[1] !== '') return found[1];
  }
  return '';
}

function fallbackCsvObjects(text) {
  const table=[]; let row=[]; let cell=''; let quoted=false;
  const input=String(text || '').replace(/^\uFEFF/,'');
  for (let i=0;i<input.length;i++) {
    const ch=input[i];
    if (ch==='"') {
      if (quoted && input[i+1]==='"') { cell+='"'; i++; }
      else quoted=!quoted;
    } else if (ch===',' && !quoted) { row.push(cell); cell=''; }
    else if ((ch==='\n' || ch==='\r') && !quoted) {
      if (ch==='\r' && input[i+1]==='\n') i++;
      row.push(cell); cell='';
      if (row.some(v=>String(v).trim()!=='')) table.push(row);
      row=[];
    } else cell+=ch;
  }
  row.push(cell);
  if (row.some(v=>String(v).trim()!=='')) table.push(row);
  if (!table.length) return [];
  const headers=table[0].map(h=>String(h||'').trim());
  return table.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i] ?? ''])));
}

function parseCsv(text) {
  const parsed = Papa
    ? Papa.parse(text, { header:true, skipEmptyLines:'greedy', transformHeader:h=>String(h||'').trim() })
    : { data:fallbackCsvObjects(text), errors:[] };
  if (parsed.errors?.length && !parsed.data?.length) throw new Error(parsed.errors[0].message || 'Unable to parse CSV.');
  const rows = [];
  for (const raw of parsed.data || []) {
    const date = normalizeDate(field(raw,['Date','Transaction Date','Posted Date','Posting Date','Trans Date']));
    const posted = normalizeDate(field(raw,['Posted Date','Posting Date'])) || date;
    const description = String(field(raw,['Description','Memo','Name','Payee','Details','Transaction Description']) || '').trim();
    const externalId = String(field(raw,['FITID','Transaction ID','Reference','Reference Number','Check Number']) || '').trim();
    const amountValue = field(raw,['Amount','Transaction Amount','AMOUNT']);
    let amount = parseMoney(amountValue);
    if (amountValue === '') {
      const credit = parseMoney(field(raw,['Credit','Deposit','Deposits','Money In']));
      const debit = parseMoney(field(raw,['Debit','Withdrawal','Withdrawals','Money Out']));
      amount = credit - Math.abs(debit);
    }
    if (!date || !description || !amount) continue;
    rows.push({ transaction_date:date, posted_date:posted, description, original_description:description, amount:money(amount), external_id:externalId || null });
  }
  if (!rows.length) throw new Error('No usable transactions were found. The file needs a date, description, and amount (or deposit/withdrawal columns).');
  return rows;
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
  return match ? match[1].trim() : '';
}

function parseOfx(text) {
  const blocks = String(text || '').split(/<STMTTRN>/i).slice(1);
  const rows = blocks.map(block => {
    const description = [tagValue(block,'NAME'), tagValue(block,'MEMO')].filter(Boolean).join(' — ') || 'Bank transaction';
    return {
      transaction_date: normalizeDate(tagValue(block,'DTPOSTED')),
      posted_date: normalizeDate(tagValue(block,'DTPOSTED')),
      description,
      original_description:description,
      amount:money(parseMoney(tagValue(block,'TRNAMT'))),
      external_id: tagValue(block,'FITID') || null
    };
  }).filter(row => row.transaction_date && row.amount);
  if (!rows.length) throw new Error('No <STMTTRN> records were found in the OFX/QFX file.');
  return rows;
}

function statementRows(text, filename, format) {
  const ext = (format || filename?.split('.').pop() || 'csv').toLowerCase();
  return ['ofx','qfx'].includes(ext) ? parseOfx(text) : parseCsv(text);
}

function stableTransactionHash(accountId, row) {
  if (row.external_id) return sha256(`${accountId}|external|${String(row.external_id).trim().toLowerCase()}`);
  return sha256([accountId,row.transaction_date,money(row.amount).toFixed(2),String(row.description).trim().toLowerCase().replace(/\s+/g,' ')].join('|'));
}

module.exports={parseMoney,normalizeDate,parseCsv,parseOfx,statementRows,stableTransactionHash,fallbackCsvObjects};
