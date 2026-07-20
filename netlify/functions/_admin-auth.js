const crypto = require('crypto');

function getHeader(event, name) {
  const headers = event.headers || {};
  const lowerName = name.toLowerCase();
  const matchingKey = Object.keys(headers).find(key => key.toLowerCase() === lowerName);
  return matchingKey ? String(headers[matchingKey] || '') : '';
}

function verifyAdminPassword(event) {
  const expected = String(process.env.ADMIN_IMPORT_PASSWORD || '');
  const supplied = getHeader(event, 'x-admin-password');

  if (!expected) {
    return {
      ok: false,
      statusCode: 503,
      message: 'ADMIN_IMPORT_PASSWORD is not configured in Netlify.'
    };
  }

  if (!supplied || supplied.length !== expected.length) {
    return { ok: false, statusCode: 401, message: 'Invalid administrator password.' };
  }

  const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
  return valid
    ? { ok: true }
    : { ok: false, statusCode: 401, message: 'Invalid administrator password.' };
}

module.exports = { verifyAdminPassword };
