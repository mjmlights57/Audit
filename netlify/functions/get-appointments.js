const { getSupabaseAdmin, json, fetchAll } = require('./_supabase');

function formatDate(isoValue, fallback) {
  if (!isoValue) return fallback || '';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return fallback || '';
  return date.toISOString().slice(0, 10);
}

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' });

  try {
    const supabase = getSupabaseAdmin();
    const data = await fetchAll(
      supabase,
      'appointments',
      'id,external_task_id,appointment_number,customer_name,customer_phone,customer_email,service_address,scheduled_start,timezone,appointment_status,source_active,source_payload,updated_at',
      query => query
        .eq('source_active', true)
        .neq('appointment_status', 'archived')
        .order('scheduled_start', { ascending: true, nullsFirst: false })
        .order('customer_name', { ascending: true })
    );

    const appointments = data.map(row => {
      const payload = row.source_payload || {};
      const sourceDate = payload.scheduled_date || '';
      return {
        databaseId: row.id,
        id: row.appointment_number || row.external_task_id,
        externalTaskId: row.external_task_id,
        customer: row.customer_name,
        contactName: payload.contact_name || '',
        contactTitle: payload.contact_title || '',
        phone: row.customer_phone || '',
        email: row.customer_email || '',
        address: row.service_address,
        streetAddress: payload.street_address || '',
        city: payload.city || '',
        stateCode: payload.state || '',
        zipcode: payload.zipcode || '',
        account: payload.account_number || '',
        utility: payload.utility || payload.utility_raw || '',
        projectId: payload.project_id || '',
        businessType: payload.business_type || '',
        date: formatDate(row.scheduled_start, sourceDate),
        time: payload.scheduled_time || '',
        auditor: 'auditor',
        auditorName: payload.asana_assignee_name || '',
        auditorEmail: payload.asana_assignee_email || '',
        asanaSection: payload.asana_section || '',
        status: row.appointment_status === 'cancelled' ? 'cancelled' : 'assigned',
        sourceUpdatedAt: row.updated_at
      };
    });

    return json(200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      appointments
    });
  } catch (error) {
    console.error('[get-appointments]', error);
    return json(500, { error: error.message || 'Unable to load appointments.' });
  }
};
