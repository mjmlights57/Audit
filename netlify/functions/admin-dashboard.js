const { verifyAdminPassword } = require('./_admin-auth');
const { getSupabaseAdmin, json, fetchAll } = require('./_supabase');

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' });

  const auth = verifyAdminPassword(event);
  if (!auth.ok) return json(auth.statusCode, { error: auth.message });

  try {
    const supabase = getSupabaseAdmin();
    const appointments = await fetchAll(
      supabase,
      'appointments',
      'id,external_task_id,appointment_number,customer_name,customer_phone,customer_email,service_address,scheduled_start,appointment_status,source_active,source_payload,updated_at',
      query => query.order('scheduled_start', { ascending: true, nullsFirst: false })
    );

    const { data: batches, error: batchError } = await supabase
      .from('import_batches')
      .select('id,filename,status,total_rows,inserted_rows,updated_rows,unchanged_rows,archived_rows,error_rows,is_full_snapshot,uploaded_at,completed_at')
      .order('uploaded_at', { ascending: false })
      .limit(30);
    if (batchError) throw batchError;

    const active = appointments.filter(row => row.source_active && row.appointment_status !== 'archived');
    const cancelled = active.filter(row => row.appointment_status === 'cancelled');
    const upcoming = active.filter(row => {
      if (!row.scheduled_start) return false;
      return new Date(row.scheduled_start).getTime() >= new Date().setHours(0, 0, 0, 0);
    });

    return json(200, {
      ok: true,
      metrics: {
        totalAppointments: appointments.length,
        activeAppointments: active.length,
        upcomingAppointments: upcoming.length,
        cancelledAppointments: cancelled.length,
        importBatches: (batches || []).length
      },
      appointments: appointments.map(row => ({
        id: row.id,
        taskId: row.external_task_id,
        appointmentNumber: row.appointment_number,
        customer: row.customer_name,
        phone: row.customer_phone || '',
        email: row.customer_email || '',
        address: row.service_address,
        date: row.source_payload?.scheduled_date || (row.scheduled_start ? row.scheduled_start.slice(0, 10) : ''),
        assignee: row.source_payload?.asana_assignee_name || '',
        section: row.source_payload?.asana_section || '',
        accountNumber: row.source_payload?.account_number || '',
        utility: row.source_payload?.utility || '',
        status: row.appointment_status,
        active: row.source_active,
        updatedAt: row.updated_at
      })),
      batches: batches || []
    });
  } catch (error) {
    console.error('[admin-dashboard]', error);
    return json(500, { error: error.message || 'Unable to load the administrator dashboard.' });
  }
};
