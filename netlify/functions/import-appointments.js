const crypto = require('crypto');
const { verifyAdminPassword } = require('./_admin-auth');
const { parseAsanaCsv, changedFields } = require('./_asana-csv');
const { getSupabaseAdmin, json, fetchAll } = require('./_supabase');

const UPSERT_BATCH_SIZE = 200;

function summarizeErrors(invalidRows) {
  return invalidRows.map(item => ({
    row: item.rowNumber,
    message: item.validationErrors.join(' ')
  }));
}

function previewItem(item, action, fields = []) {
  const appt = item.appointment;
  return {
    row: item.rowNumber,
    action,
    taskId: appt.external_task_id,
    customer: appt.customer_name,
    date: appt.source_payload?.scheduled_date || '',
    address: appt.service_address,
    assignee: appt.source_payload?.asana_assignee_name || '',
    utility: appt.source_payload?.utility || appt.source_payload?.utility_raw || '',
    changedFields: fields
  };
}

async function upsertInBatches(supabase, rows) {
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from('appointments')
      .upsert(batch, { onConflict: 'source_system,external_task_id' });
    if (error) throw error;
  }
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const auth = verifyAdminPassword(event);
  if (!auth.ok) return json(auth.statusCode, { error: auth.message });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'The request body is invalid.' });
  }

  const csvText = String(body.csvText || '').trim();
  if (!csvText) return json(400, { error: 'Choose an Asana CSV file first.' });

  let parsed;
  try {
    parsed = parseAsanaCsv(csvText);
  } catch (error) {
    return json(400, { error: error.message, details: error.details || [] });
  }

  try {
    const supabase = getSupabaseAdmin();
    const existingRows = await fetchAll(
      supabase,
      'appointments',
      'id,source_system,external_task_id,appointment_number,customer_name,customer_phone,customer_email,service_address,scheduled_start,appointment_status,source_active,source_payload',
      query => query.eq('source_system', 'asana_csv')
    );

    const existingById = new Map(existingRows.map(row => [String(row.external_task_id), row]));
    const newItems = [];
    const changedItems = [];
    const unchangedItems = [];

    for (const item of parsed.valid) {
      const existing = existingById.get(String(item.appointment.external_task_id));
      if (!existing) {
        newItems.push(item);
        continue;
      }

      const fields = changedFields(existing, item.appointment);
      if (fields.length) changedItems.push({ item, fields });
      else unchangedItems.push(item);
    }

    const incomingIds = new Set(parsed.valid.map(item => String(item.appointment.external_task_id)));
    const archiveCandidates = body.fullSnapshot
      ? existingRows.filter(row => row.source_active && !incomingIds.has(String(row.external_task_id)))
      : [];

    const summary = {
      totalRows: parsed.totalRows,
      candidateRows: parsed.candidateRows,
      skippedRows: parsed.skipped.length,
      validRows: parsed.valid.length,
      newRows: newItems.length,
      updateRows: changedItems.length,
      unchangedRows: unchangedItems.length,
      errorRows: parsed.invalid.length,
      archivedRows: archiveCandidates.length,
      errors: summarizeErrors(parsed.invalid)
    };

    const changes = [
      ...newItems.slice(0, 60).map(item => previewItem(item, 'new')),
      ...changedItems.slice(0, 60).map(({ item, fields }) => previewItem(item, 'update', fields)),
      ...archiveCandidates.slice(0, 60).map(row => ({
        action: 'archive',
        taskId: row.external_task_id,
        customer: row.customer_name,
        date: row.source_payload?.scheduled_date || '',
        address: row.service_address,
        assignee: row.source_payload?.asana_assignee_name || '',
        utility: row.source_payload?.utility || row.source_payload?.utility_raw || '',
        changedFields: ['source_active', 'appointment_status']
      }))
    ].slice(0, 100);

    if (body.previewOnly) {
      return json(200, {
        ok: true,
        preview: true,
        detectedFormat: parsed.headers.includes('Task ID') && parsed.headers.includes('Notes')
          ? 'Asana CSV export'
          : 'Compatible CSV',
        headers: parsed.headers,
        summary,
        changes
      });
    }

    const filename = String(body.filename || 'appointments.csv').trim();
    const fileHash = crypto.createHash('sha256').update(csvText).digest('hex');
    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .insert({
        filename,
        file_hash: fileHash,
        import_scope: 'Asana appointment export',
        is_full_snapshot: Boolean(body.fullSnapshot),
        status: 'processing',
        total_rows: parsed.totalRows,
        inserted_rows: newItems.length,
        updated_rows: changedItems.length,
        unchanged_rows: unchangedItems.length,
        archived_rows: archiveCandidates.length,
        error_rows: parsed.invalid.length
      })
      .select('id')
      .single();

    if (batchError) throw batchError;

    const rowsToUpsert = parsed.valid.map(item => ({
      ...item.appointment,
      last_import_batch_id: batch.id
    }));

    await upsertInBatches(supabase, rowsToUpsert);

    if (archiveCandidates.length) {
      const ids = archiveCandidates.map(row => row.id);
      for (let index = 0; index < ids.length; index += UPSERT_BATCH_SIZE) {
        const chunk = ids.slice(index, index + UPSERT_BATCH_SIZE);
        const { error } = await supabase
          .from('appointments')
          .update({
            source_active: false,
            appointment_status: 'archived',
            last_import_batch_id: batch.id
          })
          .in('id', chunk);
        if (error) throw error;
      }
    }

    const { error: completeError } = await supabase
      .from('import_batches')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', batch.id);
    if (completeError) throw completeError;

    return json(200, {
      ok: true,
      imported: true,
      batchId: batch.id,
      summary,
      changes
    });
  } catch (error) {
    console.error('[import-appointments]', error);
    return json(500, { error: error.message || 'The import could not be completed.' });
  }
};
