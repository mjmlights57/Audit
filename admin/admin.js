const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const ENDPOINTS = {
  dashboard: '/.netlify/functions/admin-dashboard',
  import: '/.netlify/functions/import-appointments'
};

let state = {
  password: sessionStorage.getItem('ewpros_admin_password') || '',
  dashboard: null,
  csvText: '',
  filename: '',
  preview: null
};

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.remove('hidden');
  setTimeout(() => $('#toast').classList.add('hidden'), 2600);
}

function showAlert(message, type = 'error') {
  const alert = $('#globalAlert');
  alert.textContent = message;
  alert.className = `alert ${type}`;
}

function clearAlert() {
  $('#globalAlert').className = 'alert hidden';
  $('#globalAlert').textContent = '';
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'X-Admin-Password': state.password,
      'Cache-Control': 'no-cache'
    }
  });

  let body = {};
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function metric(label, value) {
  return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function formatDate(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusTag(status, active = true) {
  const value = !active ? 'archived' : (status || 'assigned');
  return `<span class="tag ${escapeHtml(value)}">${escapeHtml(value)}</span>`;
}

function renderDashboard() {
  const data = state.dashboard;
  if (!data) return;
  const m = data.metrics;
  $('#metricCards').innerHTML = [
    metric('Active appointments', m.activeAppointments),
    metric('Upcoming appointments', m.upcomingAppointments),
    metric('Cancelled', m.cancelledAppointments),
    metric('Recorded imports', m.importBatches)
  ].join('');

  const upcoming = data.appointments
    .filter(item => item.active && item.status !== 'archived' && item.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 12);

  $('#upcomingList').innerHTML = upcoming.length ? `
    <table><thead><tr><th>Date</th><th>Customer</th><th>Address</th><th>Assignee</th></tr></thead>
    <tbody>${upcoming.map(item => `<tr><td>${formatDate(item.date)}</td><td><strong>${escapeHtml(item.customer)}</strong><small>${escapeHtml(item.taskId)}</small></td><td>${escapeHtml(item.address)}</td><td>${escapeHtml(item.assignee || '—')}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">No scheduled appointments found.</div>';

  const recent = data.batches.slice(0, 6);
  $('#recentImports').innerHTML = recent.length ? recent.map(batch => `
    <div class="import-item"><div><strong>${escapeHtml(batch.filename)}</strong><span class="tag ${batch.status === 'completed' ? 'completed' : 'archive'}">${escapeHtml(batch.status)}</span></div><small>${new Date(batch.uploaded_at).toLocaleString()} · ${batch.total_rows} rows · ${batch.inserted_rows} new · ${batch.updated_rows} updated</small></div>`).join('')
    : '<div class="empty">No CSV has been imported yet.</div>';

  renderAppointments();
  renderHistory();
}

function filteredAppointments() {
  const data = state.dashboard?.appointments || [];
  const query = ($('#appointmentSearch')?.value || '').trim().toLowerCase();
  const filter = $('#appointmentStatusFilter')?.value || 'all';
  return data.filter(item => {
    const haystack = [item.customer, item.address, item.taskId, item.assignee, item.phone, item.accountNumber, item.utility].join(' ').toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesStatus = filter === 'all'
      || (filter === 'active' && item.active && item.status !== 'archived')
      || (filter === 'cancelled' && item.status === 'cancelled')
      || (filter === 'archived' && (!item.active || item.status === 'archived'));
    return matchesSearch && matchesStatus;
  });
}

function renderAppointments() {
  if (!$('#appointmentsTable')) return;
  const rows = filteredAppointments();
  $('#appointmentsTable').innerHTML = rows.length ? `
    <table><thead><tr><th>Date</th><th>Customer</th><th>Contact</th><th>Address</th><th>Asana</th><th>Status</th></tr></thead>
    <tbody>${rows.map(item => `<tr>
      <td>${formatDate(item.date)}</td>
      <td><strong>${escapeHtml(item.customer)}</strong><small>Task ${escapeHtml(item.taskId)}</small></td>
      <td>${escapeHtml(item.phone || '—')}<br><small>${escapeHtml(item.email || '')}</small></td>
      <td>${escapeHtml(item.address)}${item.accountNumber ? `<br><small>${escapeHtml(item.utility)} account: ${escapeHtml(item.accountNumber)}</small>` : ''}</td>
      <td>${escapeHtml(item.assignee || '—')}<br><small>${escapeHtml(item.section || '')}</small></td>
      <td>${statusTag(item.status, item.active)}</td>
    </tr>`).join('')}</tbody></table>`
    : '<div class="empty">No appointments match the current filter.</div>';
}

function renderHistory() {
  const batches = state.dashboard?.batches || [];
  $('#historyTable').innerHTML = batches.length ? `
    <table><thead><tr><th>Imported</th><th>File</th><th>Rows</th><th>New</th><th>Updated</th><th>Unchanged</th><th>Archived</th><th>Errors</th><th>Status</th></tr></thead>
    <tbody>${batches.map(batch => `<tr><td>${new Date(batch.uploaded_at).toLocaleString()}</td><td><strong>${escapeHtml(batch.filename)}</strong><small>${batch.is_full_snapshot ? 'Complete export' : 'Update only'}</small></td><td>${batch.total_rows}</td><td>${batch.inserted_rows}</td><td>${batch.updated_rows}</td><td>${batch.unchanged_rows}</td><td>${batch.archived_rows}</td><td>${batch.error_rows}</td><td>${statusTag(batch.status)}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">No import history yet.</div>';
}

async function loadDashboard(showSuccess = false) {
  clearAlert();
  $('#refreshDashboard').disabled = true;
  try {
    state.dashboard = await api(ENDPOINTS.dashboard);
    renderDashboard();
    if (showSuccess) toast('Dashboard refreshed');
  } catch (error) {
    if (/Invalid administrator password/i.test(error.message)) {
      sessionStorage.removeItem('ewpros_admin_password');
      state.password = '';
      $('#dashboard').classList.add('hidden');
      $('#loginPanel').classList.remove('hidden');
      $('#loginError').textContent = error.message;
      $('#loginError').classList.remove('hidden');
    } else {
      showAlert(error.message);
    }
    throw error;
  } finally {
    $('#refreshDashboard').disabled = false;
  }
}

function showView(name) {
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === name));
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
  const titles = { overview: 'Overview', import: 'Import CSV', appointments: 'Appointments', history: 'Import History' };
  $('#pageTitle').textContent = titles[name] || 'Dashboard';
}

function setFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showAlert('Please choose a CSV file exported from Asana.');
    return;
  }
  file.text().then(text => {
    state.csvText = text;
    state.filename = file.name;
    state.preview = null;
    $('#fileLabel').textContent = file.name;
    $('#previewBtn').disabled = false;
    $('#importBtn').disabled = true;
    $('#previewPanel').classList.add('hidden');
    clearAlert();
  });
}

function renderPreview(data) {
  state.preview = data;
  const summary = data.summary;
  $('#previewPanel').classList.remove('hidden');
  $('#formatDetected').textContent = `${data.detectedFormat} detected. Review the changes before confirming.`;
  $('#previewMetrics').innerHTML = [
    metric('CSV rows', summary.totalRows),
    metric('Skipped subtasks', summary.skippedRows),
    metric('Valid customers', summary.validRows),
    metric('New', summary.newRows),
    metric('Updates', summary.updateRows),
    metric('Would archive', summary.archivedRows)
  ].join('');

  $('#previewErrors').innerHTML = summary.errors.length ? `
    <div class="error-list"><h3>${summary.errorRows} row(s) need correction</h3>${summary.errors.slice(0, 25).map(error => `<div>Row ${error.row}: ${escapeHtml(error.message)}</div>`).join('')}</div>` : '';

  $('#previewChanges').innerHTML = data.changes.length ? `
    <table><thead><tr><th>Action</th><th>Date</th><th>Customer</th><th>Address</th><th>Assignee</th><th>Fields</th></tr></thead>
    <tbody>${data.changes.map(change => `<tr><td><span class="tag ${escapeHtml(change.action)}">${escapeHtml(change.action)}</span></td><td>${formatDate(change.date)}</td><td><strong>${escapeHtml(change.customer)}</strong><small>${escapeHtml(change.taskId)}</small></td><td>${escapeHtml(change.address)}</td><td>${escapeHtml(change.assignee || '—')}</td><td><small>${escapeHtml((change.changedFields || []).join(', ') || 'New record')}</small></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">No database changes are needed. The uploaded file matches the current appointment data.</div>';

  $('#importBtn').disabled = summary.validRows === 0;
}

async function submitImport(previewOnly) {
  if (!state.csvText) return showAlert('Choose an Asana CSV file first.');
  clearAlert();
  $('#previewBtn').disabled = true;
  $('#importBtn').disabled = true;
  try {
    const data = await api(ENDPOINTS.import, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: state.filename,
        csvText: state.csvText,
        previewOnly,
        fullSnapshot: $('#fullSnapshot').checked
      })
    });
    renderPreview(data);
    if (!previewOnly) {
      showAlert(`Import complete: ${data.summary.newRows} new, ${data.summary.updateRows} updated, ${data.summary.unchangedRows} unchanged, and ${data.summary.archivedRows} archived.`, 'success');
      toast('Appointments imported successfully');
      await loadDashboard(false);
      showView('overview');
    }
  } catch (error) {
    showAlert(error.message);
  } finally {
    $('#previewBtn').disabled = !state.csvText;
    $('#importBtn').disabled = !state.preview || state.preview.summary?.validRows === 0;
  }
}

$('#adminLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  state.password = $('#adminPassword').value;
  $('#loginError').classList.add('hidden');
  try {
    await loadDashboard(false);
    sessionStorage.setItem('ewpros_admin_password', state.password);
    $('#loginPanel').classList.add('hidden');
    $('#dashboard').classList.remove('hidden');
  } catch {}
});

$$('.nav-item').forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
$('#refreshDashboard').addEventListener('click', () => loadDashboard(true).catch(() => {}));
$('#adminLogout').addEventListener('click', () => {
  sessionStorage.removeItem('ewpros_admin_password');
  location.reload();
});
$('#csvFile').addEventListener('change', event => setFile(event.target.files[0]));
$('#previewBtn').addEventListener('click', () => submitImport(true));
$('#importBtn').addEventListener('click', () => {
  const archiveMessage = $('#fullSnapshot').checked ? ' Missing appointments will be archived.' : '';
  if (confirm(`Import the previewed appointments now?${archiveMessage}`)) submitImport(false);
});
$('#appointmentSearch').addEventListener('input', renderAppointments);
$('#appointmentStatusFilter').addEventListener('change', renderAppointments);

const dropZone = $('#dropZone');
for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.add('dragging'); });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.remove('dragging'); });
}
dropZone.addEventListener('drop', event => setFile(event.dataTransfer.files[0]));

if (state.password) {
  $('#loginPanel').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  loadDashboard(false).catch(() => {});
}
