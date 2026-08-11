const { verifyAdminPassword } = require('./_admin-auth');
const { json } = require('./_supabase');

exports.handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { error: 'Method not allowed.' });
  }

  const auth = verifyAdminPassword(event);
  if (!auth.ok) return json(auth.statusCode, { error: auth.message });

  const hasUrl = Boolean(String(process.env.SUPABASE_URL || '').trim());
  const hasKey = Boolean(String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim());

  return json(200, {
    ok: true,
    authenticated: true,
    databaseConfigured: hasUrl && hasKey,
    missingDatabaseVariables: [
      !hasUrl ? 'SUPABASE_URL' : null,
      !hasKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null
    ].filter(Boolean)
  });
};
