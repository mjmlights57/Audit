let Papa=null;
try { Papa=require('papaparse'); } catch (_) { /* Netlify installs this dependency; tests use the fallback parser. */ }
const clean = value => String(value ?? '').trim();
const norm = value => clean(value).toLowerCase().replace(/\s+/g, ' ');
const phoneDigits = value => clean(value).replace(/\D/g, '');


function fallbackCsvObjects(text) {
  const table=[]; let row=[]; let cell=''; let quoted=false;
  const input=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(ch==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>String(v).trim()!==''))table.push(row);row=[];}
    else cell+=ch;
  }
  row.push(cell); if(row.some(v=>String(v).trim()!==''))table.push(row);
  if(!table.length)return {data:[],headers:[]};
  const headers=table[0].map(h=>clean(h));
  return {data:table.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??'']))),headers};
}
const ALIASES = {
  display_name: ['customer','customer name','display name','name','company','company name','business name','client','client name'],
  company_name: ['company','company name','business name','facility','facility name'],
  contact_name: ['contact','contact name','customer contact','representative'],
  phone: ['phone','phone number','telephone','mobile','cell'],
  email: ['email','email address','e-mail'],
  service_address: ['address','service address','street address','property address'],
  city: ['city'],
  state_code: ['state','state code','province'],
  zipcode: ['zip','zipcode','zip code','postal code'],
  customer_type: ['stage','status','customer type','type'],
  source: ['source','lead source'],
  notes: ['notes','note','comments','comment'],
  business_line: ['business line','line of business','division']
};

function headerKey(header) {
  const key = norm(header).replace(/[_-]+/g, ' ');
  for (const [field, aliases] of Object.entries(ALIASES)) if (aliases.includes(key)) return field;
  return null;
}

function normalizeStage(value, fallback='customer') {
  const v = norm(value);
  if (/lead|prospect/.test(v)) return 'lead';
  if (/inactive|archive/.test(v)) return 'inactive';
  if (/customer|client|active/.test(v)) return 'customer';
  return fallback === 'lead' ? 'lead' : 'customer';
}

function normalizeRow(raw, headers, defaults={}) {
  const row = {};
  for (const header of headers) {
    const field = headerKey(header);
    if (field && row[field] === undefined) row[field] = clean(raw[header]);
  }
  const displayName = row.display_name || row.company_name || row.contact_name;
  return {
    display_name: clean(displayName),
    company_name: clean(row.company_name || displayName),
    contact_name: clean(row.contact_name),
    phone: clean(row.phone),
    email: clean(row.email),
    service_address: clean(row.service_address),
    city: clean(row.city),
    state_code: clean(row.state_code).toUpperCase().slice(0, 2),
    zipcode: clean(row.zipcode),
    customer_type: normalizeStage(row.customer_type, defaults.default_customer_type),
    source: clean(row.source) || 'crm_import',
    notes: clean(row.notes),
    business_line: clean(row.business_line),
    primary_business_line_id: defaults.default_business_line_id || null
  };
}

function lineMatcher(lines=[]) {
  const byKey = new Map();
  for (const line of lines) {
    for (const key of [line.id, line.code, line.name]) if (key) byKey.set(norm(key), line.id);
  }
  return value => byKey.get(norm(value)) || null;
}

function customerMatch(existing, row) {
  const email = norm(row.email);
  if (email) {
    const match = existing.find(c => norm(c.email) === email);
    if (match) return { customer: match, matchedBy: 'email' };
  }
  const phone = phoneDigits(row.phone);
  if (phone.length >= 7) {
    const match = existing.find(c => phoneDigits(c.phone) === phone);
    if (match) return { customer: match, matchedBy: 'phone' };
  }
  const name = norm(row.display_name), address = norm(row.service_address);
  if (name && address) {
    const match = existing.find(c => norm(c.display_name) === name && norm(c.service_address) === address);
    if (match) return { customer: match, matchedBy: 'name + address' };
  }
  return null;
}

function parseCustomerCsv(csvText, defaults={}, businessLines=[]) {
  const fallback=Papa?null:fallbackCsvObjects(String(csvText||''));
  const parsed = Papa ? Papa.parse(String(csvText || ''), { header:true, skipEmptyLines:'greedy', transformHeader:h=>clean(h) }) : {data:fallback.data,errors:[],meta:{fields:fallback.headers}};
  const fatal = (parsed.errors || []).filter(e => e.type === 'Quotes' || e.type === 'Delimiter');
  if (fatal.length) throw new Error('The customer CSV could not be parsed. Please save/export it as a standard CSV file.');
  const headers = parsed.meta?.fields || [];
  if (!headers.length) throw new Error('The customer CSV has no header row.');
  const recognized = headers.filter(h => headerKey(h));
  if (!recognized.length) throw new Error('No customer columns were recognized. Include a Customer/Name/Company column.');
  const findLine = lineMatcher(businessLines);
  const rows = parsed.data.map((raw,index) => {
    const customer = normalizeRow(raw, headers, defaults);
    const errors=[];
    if (!customer.display_name) errors.push('Customer/Company name is missing.');
    if (customer.business_line) customer.primary_business_line_id = findLine(customer.business_line) || customer.primary_business_line_id;
    if (!customer.primary_business_line_id) errors.push('Business line is missing or was not recognized.');
    return { rowNumber:index+2, customer, errors };
  });
  return { headers, recognized, rows };
}

function mergePatch(existing, incoming) {
  const patch={};
  for (const key of ['display_name','company_name','contact_name','phone','email','service_address','city','state_code','zipcode','notes','primary_business_line_id']) {
    if (clean(incoming[key]) && clean(existing[key]) !== clean(incoming[key])) patch[key]=incoming[key];
  }
  if (incoming.customer_type && existing.customer_type !== incoming.customer_type) patch.customer_type=incoming.customer_type;
  if (existing.active === false) patch.active=true;
  return patch;
}


module.exports={headerKey,normalizeStage,normalizeRow,customerMatch,parseCustomerCsv,mergePatch,fallbackCsvObjects};
