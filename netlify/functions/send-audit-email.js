const { Resend } = require('resend');

const DEFAULT_FROM = 'EWPros Auditor Wizard <audit@ewpros.com>';
const DEFAULT_TO = 'audit@ewpros.com';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clean(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { Allow: 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[send-audit-email] RESEND_API_KEY is not configured');
    return json(500, { error: 'Email service is not configured.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    console.warn('[send-audit-email] Invalid JSON', error);
    return json(400, { error: 'Request body must be valid JSON.' });
  }

  const appointmentNumber = clean(payload.appointmentNumber, 100);
  const customerName = clean(payload.customerName, 200);
  const auditorName = clean(payload.auditorName, 200);
  const propertyAddress = clean(payload.propertyAddress, 500);
  const completionDateTime = clean(payload.completionDateTime, 100);

  const missing = Object.entries({ appointmentNumber, customerName, auditorName, propertyAddress, completionDateTime })
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    return json(400, { error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const parsedDate = new Date(completionDateTime);
  if (Number.isNaN(parsedDate.getTime())) {
    return json(400, { error: 'completionDateTime must be a valid date/time.' });
  }

  const from = process.env.AUDIT_EMAIL_FROM || DEFAULT_FROM;
  const to = (process.env.AUDIT_EMAIL_TO || DEFAULT_TO).split(',').map(v => v.trim()).filter(Boolean);
  const requestKey = clean(event.headers['x-idempotency-key'] || event.headers['X-Idempotency-Key'] || payload.id, 256);
  const idempotencyKey = requestKey || `audit-${appointmentNumber}-${parsedDate.getTime()}`;
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full', timeStyle: 'long', timeZone: process.env.AUDIT_TIME_ZONE || 'America/New_York',
  }).format(parsedDate);

  const subject = `Audit Completed – ${appointmentNumber}`;
  const text = [
    'An EWPros audit has been completed.', '',
    `Appointment Number: ${appointmentNumber}`,
    `Customer Name: ${customerName}`,
    `Auditor Name: ${auditorName}`,
    `Property Address: ${propertyAddress}`,
    `Completion Date and Time: ${formattedDate}`, '',
    'The completed audit has been uploaded to Dropbox.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:640px;margin:auto">
      <h2 style="color:#d50032">EWPros Audit Completed</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Appointment Number</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(appointmentNumber)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Customer Name</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(customerName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Auditor Name</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(auditorName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Property Address</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(propertyAddress)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Completion Date and Time</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(formattedDate)}</td></tr>
      </table>
      <p style="margin-top:20px"><strong>The completed audit has been uploaded to Dropbox.</strong></p>
    </div>`;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send(
      { from, to, subject, text, html },
      { idempotencyKey },
    );
    if (error) {
      console.error('[send-audit-email] Resend error', { appointmentNumber, error });
      return json(502, { error: error.message || 'Resend rejected the email request.' });
    }
    console.info('[send-audit-email] Email sent', { appointmentNumber, emailId: data?.id, to });
    return json(200, { ok: true, emailId: data?.id, appointmentNumber });
  } catch (error) {
    console.error('[send-audit-email] Unexpected error', { appointmentNumber, error });
    return json(500, { error: 'Unable to send the audit email at this time.' });
  }
};
