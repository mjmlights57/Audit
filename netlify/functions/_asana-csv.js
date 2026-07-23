let Papa;
try { Papa = require('papaparse'); } catch {
  Papa = { parse: fallbackCsvParse };
}

function fallbackCsvParse(csvText, options = {}) {
  const text = String(csvText ?? '').replace(/^\uFEFF/, '');
  const table = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); table.push(row); row = []; field = ''; }
    else field += ch;
  }
  row.push(field.replace(/\r$/, ''));
  if (row.some(value => value !== '') || table.length === 0) table.push(row);
  const transformHeader = options.transformHeader || (value => value);
  const headers = (table.shift() || []).map(transformHeader);
  const data = table
    .filter(values => options.skipEmptyLines ? values.some(value => String(value).trim()) : true)
    .map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  return { data, errors: quoted ? [{ type: 'Quotes', message: 'Unclosed quoted field' }] : [], meta: { fields: headers } };
}

const clean = value => String(value ?? '').replace(/^\uFEFF/, '').trim();
const normalizeHeader = value => clean(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

const HEADER_ALIASES = {
  externalTaskId: ['task id', 'task gid', 'asana task id', 'gid', 'external task id'],
  appointmentNumber: ['appointment number', 'appointment id', 'appt number', 'audit number'],
  customerName: ['customer name', 'customer', 'client name', 'task name', 'name'],
  section: ['section/column', 'section', 'column', 'appointment status', 'status'],
  assigneeName: ['assignee', 'assigned auditor', 'auditor', 'assignee name'],
  assigneeEmail: ['assignee email', 'auditor email'],
  startDate: ['start date', 'appointment date', 'scheduled date'],
  dueDate: ['due date', 'appointment date', 'scheduled date', 'date'],
  scheduledTime: ['appointment time', 'scheduled time', 'start time', 'time'],
  notes: ['notes', 'description'],
  completedAt: ['completed at', 'completion date'],
  project: ['projects', 'project'],
  parentTask: ['parent task', 'parent']
};

function findValue(row, field) {
  const keys = Object.keys(row || {});
  const aliases = HEADER_ALIASES[field] || [];
  const key = keys.find(candidate => aliases.includes(normalizeHeader(candidate)));
  return key ? clean(row[key]) : '';
}

function parseNotes(notesText) {
  const text = clean(notesText).replace(/\r\n/g, '\n');
  const fields = {};

  for (const rawLine of text.split('\n')) {
    let line = clean(rawLine);
    if (!line) continue;

    line = line.replace(/^Notes:\s*/i, '').trim();
    const match = line.match(/^([^:]{1,80}):\s*(.*)$/);
    if (!match) continue;

    const key = normalizeHeader(match[1]);
    const value = clean(match[2]);
    if (!value) continue;

    if (!fields[key]) fields[key] = value;
  }

  const valueFor = aliases => {
    for (const alias of aliases) {
      const value = fields[normalizeHeader(alias)];
      if (value) return value;
    }
    return '';
  };

  const tabValue = label => {
    const pattern = new RegExp(`(?:^|\n)${label}\s*:?\s*\t+([^\t\n]+)`, 'i');
    return clean(text.match(pattern)?.[1] || '');
  };
  const lines = text.split('\n').map(clean).filter(Boolean);
  const fullAddress = lines.find(line => /^\d+[A-Za-z]?\s+.+\b[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i.test(line)) || '';
  const rawPhone = clean(text.match(/(?:Cell|Tel|Phone)\s*:\s*([^\n]+)/i)?.[1] || '');
  const rawContact = clean(text.match(/(?:POC|Contact)\s*:\s*([^\n]+)/i)?.[1] || '');

  return {
    facilityName: valueFor(['facility name', 'business name']) || tabValue('Business Name') || tabValue('Project Name'),
    utility: valueFor(['utility', 'utility company']),
    projectId: valueFor(['project id', 'pepco project id', 'utility project id', 'project number']),
    accountNumber: valueFor(['account number', 'utility account number', 'account #']) || tabValue('ELECTRIC ACCT\.#'),
    businessType: valueFor(['business type', 'facility type']) || tabValue('Building Type'),
    contactName: valueFor(['contact name', 'customer contact']) || tabValue('Contact') || rawContact,
    title: valueFor(['title']) || tabValue('Title'),
    phone: valueFor(['phone', 'phone #', 'main tel #', 'main telephone']) || tabValue('Phone') || rawPhone,
    phone2: valueFor(['phone #2', 'phone 2', 'alternate phone']),
    email: valueFor(['email', 'customer email']) || tabValue('Email'),
    streetAddress: valueFor(['street address', 'service address', 'address']) || tabValue('Street Address'),
    fullAddress,
    city: valueFor(['city']) || tabValue('City'),
    state: valueFor(['state']) || tabValue('State'),
    zipcode: valueFor(['zipcode', 'zip code', 'zip']) || tabValue('Zip'),
    appointmentTime: valueFor(['appointment time', 'scheduled time', 'start time', 'time']),
    rawFields: fields,
    rawText: text
  };
}

function buildAddress(parsedNotes) {
  if (parsedNotes.fullAddress) return parsedNotes.fullAddress;
  return [
    parsedNotes.streetAddress,
    parsedNotes.city,
    parsedNotes.state,
    parsedNotes.zipcode
  ].filter(Boolean).join(', ');
}


function normalizeAppointmentTime(timeValue) {
  const value = clean(timeValue);
  if (!value) return '';

  const compact = value.replace(/\s+/g, ' ').trim();
  const twelveHour = compact.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2] || '0');
    if (hour < 1 || hour > 12 || minute > 59) return compact;
    const suffix = twelveHour[3].toUpperCase() + 'M';
    return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  const twentyFourHour = compact.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    if (hour > 23 || minute > 59) return compact;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  return compact;
}


function normalizeUtilityProgram(value) {
  const raw = clean(value);
  const compact = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (compact.includes('BGE') || compact.includes('BALTIMOREGASELECTRIC') || compact.includes('BALTIMOREGASANDELECTRIC')) return 'BGE';
  if (compact.includes('PEPCO') || compact.includes('POTOMACELECTRICPOWER')) return 'PEPCO';
  return raw;
}

function normalizeStatus(sectionValue) {
  const status = clean(sectionValue).toLowerCase();
  if (/cancel|declin|not proceeding|lost/.test(status)) return 'cancelled';
  if (/archive|done|payment is received|completed/.test(status)) return 'archived';
  return 'assigned';
}

function dateAtNoonIso(dateValue) {
  const value = clean(dateValue);
  if (!value) return null;

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T12:00:00.000Z`;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCHours(12, 0, 0, 0);
  return parsed.toISOString();
}

function normalizeCsvRow(row, rowNumber) {
  const externalTaskId = findValue(row, 'externalTaskId');
  const customerName = findValue(row, 'customerName');
  const notes = parseNotes(findValue(row, 'notes'));
  const dueDate = findValue(row, 'dueDate') || findValue(row, 'startDate');
  const scheduledTime = normalizeAppointmentTime(findValue(row, 'scheduledTime') || notes.appointmentTime);
  const address = buildAddress(notes);
  const assigneeName = findValue(row, 'assigneeName');
  const assigneeEmail = findValue(row, 'assigneeEmail');
  const section = findValue(row, 'section');
  const parentTask = findValue(row, 'parentTask');

  const validationErrors = [];
  if (!externalTaskId) validationErrors.push('Task ID is missing.');
  if (!customerName) validationErrors.push('Customer/Task Name is missing.');
  if (!notes.streetAddress && !notes.fullAddress) validationErrors.push('Street Address could not be extracted from Notes.');

  const appointmentNumber = findValue(row, 'appointmentNumber') || externalTaskId;
  const sourcePayload = {
    asana_task_id: externalTaskId,
    asana_section: section,
    asana_assignee_name: assigneeName,
    asana_assignee_email: assigneeEmail,
    asana_project: findValue(row, 'project'),
    asana_completed_at: findValue(row, 'completedAt') || null,
    scheduled_date: dueDate || null,
    scheduled_time: scheduledTime || null,
    facility_name: notes.facilityName || customerName,
    utility: normalizeUtilityProgram(notes.utility) || null,
    utility_raw: notes.utility || null,
    project_id: notes.projectId || null,
    account_number: notes.accountNumber || null,
    business_type: notes.businessType || null,
    contact_name: notes.contactName || null,
    contact_title: notes.title || null,
    street_address: notes.streetAddress || null,
    city: notes.city || null,
    state: notes.state || null,
    zipcode: notes.zipcode || null,
    alternate_phone: notes.phone2 || null,
    parsed_notes: notes.rawFields,
    original_row: row
  };

  return {
    rowNumber,
    skipped: Boolean(parentTask),
    skipReason: parentTask ? `Subtask of ${parentTask}` : '',
    validationErrors,
    appointment: {
      source_system: 'asana_csv',
      external_task_id: externalTaskId,
      appointment_number: appointmentNumber,
      customer_name: customerName,
      customer_phone: notes.phone || notes.phone2 || null,
      customer_email: notes.email || null,
      service_address: address,
      scheduled_start: dateAtNoonIso(dueDate),
      timezone: 'America/New_York',
      appointment_status: normalizeStatus(section),
      source_active: true,
      source_last_seen_at: new Date().toISOString(),
      source_payload: sourcePayload
    }
  };
}

function parseAsanaCsv(csvText) {
  const parsed = Papa.parse(clean(csvText), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => clean(header)
  });

  const fatalErrors = (parsed.errors || []).filter(error => error.type === 'Quotes' || error.type === 'Delimiter');
  if (fatalErrors.length) {
    const error = new Error('The CSV could not be parsed. Please export it again from Asana.');
    error.details = fatalErrors.slice(0, 10);
    throw error;
  }

  const normalized = parsed.data.map((row, index) => normalizeCsvRow(row, index + 2));
  const seen = new Map();

  for (const item of normalized) {
    const id = item.appointment.external_task_id;
    if (!id) continue;
    if (seen.has(id)) {
      item.validationErrors.push(`Duplicate Task ID ${id}; first found on row ${seen.get(id)}.`);
    } else {
      seen.set(id, item.rowNumber);
    }
  }

  const skipped = normalized.filter(item => item.skipped);
  const candidates = normalized.filter(item => !item.skipped);
  const valid = candidates.filter(item => item.validationErrors.length === 0);
  const invalid = candidates.filter(item => item.validationErrors.length > 0);

  return {
    headers: parsed.meta.fields || [],
    totalRows: normalized.length,
    candidateRows: candidates.length,
    valid,
    invalid,
    skipped
  };
}

const COMPARISON_FIELDS = [
  'appointment_number',
  'customer_name',
  'customer_phone',
  'customer_email',
  'service_address',
  'scheduled_start',
  'appointment_status',
  'source_active'
];

function comparableValue(value) {
  return value === undefined || value === null ? '' : String(value);
}

function changedFields(existing, incoming) {
  const changes = [];
  for (const field of COMPARISON_FIELDS) {
    if (comparableValue(existing?.[field]) !== comparableValue(incoming?.[field])) {
      changes.push(field);
    }
  }

  const oldPayload = existing?.source_payload || {};
  const newPayload = incoming?.source_payload || {};
  for (const field of ['asana_section', 'asana_assignee_name', 'asana_assignee_email', 'utility', 'utility_raw', 'project_id', 'account_number', 'contact_name', 'contact_title', 'street_address', 'city', 'state', 'zipcode', 'business_type']) {
    if (comparableValue(oldPayload[field]) !== comparableValue(newPayload[field])) {
      changes.push(`source_payload.${field}`);
    }
  }

  return changes;
}

module.exports = {
  parseAsanaCsv,
  parseNotes,
  buildAddress,
  changedFields,
  dateAtNoonIso,
  normalizeAppointmentTime,
  normalizeUtilityProgram
};
