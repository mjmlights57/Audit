const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const ENDPOINTS = {
  login: '/.netlify/functions/admin-login',
  dashboard: '/.netlify/functions/admin-dashboard',
  import: '/.netlify/functions/import-appointments'
};

let state = {
  password: sessionStorage.getItem('ewpros_admin_password') || '',
  dashboard: null,
  archiveSnapshot: null,
  csvText: '',
  filename: '',
  preview: null,
  workspaceTab: 'main',
  pDataRows: [],
  controlPDataRows: [],
  pepcoTop: null,
  pepcoInventoryRows: [],
  pepcoOnlineRows: [],
  invoice: null,
  selectedPepcoProjectId: '',
  selectedPepcoOnlineProjectId: '',
  selectedInvoiceProjectId: ''
};

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const PDATA_STORAGE_KEY = 'ewpros_pdata_rows_v1';
const CONTROL_PDATA_STORAGE_KEY = 'ewpros_control_pdata_rows_v1';
const PEPCO_TOP_STORAGE_KEY = 'ewpros_pepco_workbook_top_v1';
const PEPCO_INVENTORY_STORAGE_KEY = 'ewpros_pepco_workbook_inventory_v1';
const PEPCO_ONLINE_STORAGE_KEY = 'ewpros_pepco_online_rows_v1';
const INVOICE_STORAGE_KEY = 'ewpros_invoice_v1';
const INVOICE_SEQUENCE_STORAGE_KEY = 'ewpros_invoice_sequence_v1';
const ADMIN_ARCHIVE_STORAGE_KEY = 'ewpros_admin_project_archive_v1';
const ADMIN_ARCHIVE_VERSION = '2.8';

function pDataColumns() {
  return window.EWPROS_PDATA?.columns || [];
}

function migratePDataRow(row = {}) {
  return {
    ...row,
    bgeIncentives: row.bgeIncentives ?? row.inc ?? '',
    pepcoIncentives: row.pepcoIncentives ?? '',
    unitPrice: row.unitPrice ?? row.inc2 ?? ''
  };
}

function defaultPDataRows() {
  return JSON.parse(JSON.stringify(window.EWPROS_PDATA?.rows || [])).map(migratePDataRow);
}

function loadPDataRows() {
  try {
    const saved = JSON.parse(localStorage.getItem(PDATA_STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return saved.map(migratePDataRow);
  } catch {}
  return defaultPDataRows();
}

function blankPDataRow() {
  return Object.fromEntries(pDataColumns().map(column => [column.key, '']));
}

function setPDataStatus(message, dirty = false) {
  const status = $('#pdataStatus');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('dirty', dirty);
}

function csvValue(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function savePDataRows(showMessage = true) {
  localStorage.setItem(PDATA_STORAGE_KEY, JSON.stringify(state.pDataRows));
  setPDataStatus(`${state.pDataRows.length} rows saved`);
  if (showMessage) toast('PData saved on this browser');
}

function renderPData() {
  const container = $('#pdataTable');
  if (!container) return;
  const columns = pDataColumns();
  const query = ($('#pdataSearch')?.value || '').trim().toLowerCase();
  const visible = state.pDataRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !query || Object.values(row).join(' ').toLowerCase().includes(query));

  container.innerHTML = visible.length ? `
    <table class="pdata-table">
      <thead><tr><th>#</th>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}<th>Actions</th></tr></thead>
      <tbody>${visible.map(({ row, index }) => `<tr>
        <td class="pdata-row-number">${index + 1}</td>
        ${columns.map(column => {
          const value = escapeHtml(row[column.key] || '');
          const longField = ['measureDescription', 'modelNumber', 'reportedModelNumber'].includes(column.key);
          return `<td>${longField
            ? `<textarea data-pdata-index="${index}" data-pdata-field="${column.key}" rows="2">${value}</textarea>`
            : `<input data-pdata-index="${index}" data-pdata-field="${column.key}" value="${value}">`
          }</td>`;
        }).join('')}
        <td><div class="pdata-row-actions"><button class="button mini secondary" type="button" data-duplicate-pdata="${index}">Duplicate</button><button class="button mini danger-outline" type="button" data-delete-pdata="${index}">Delete</button></div></td>
      </tr>`).join('')}</tbody>
    </table>` : '<div class="empty">No PData rows match the current search.</div>';

  $$('[data-pdata-field]').forEach(input => input.addEventListener('input', () => {
    const index = Number(input.dataset.pdataIndex);
    const field = input.dataset.pdataField;
    if (!state.pDataRows[index]) return;
    state.pDataRows[index][field] = input.value;
    setPDataStatus('Unsaved changes', true);
  }));
  $$('[data-duplicate-pdata]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.duplicatePdata);
    state.pDataRows.splice(index + 1, 0, { ...state.pDataRows[index] });
    setPDataStatus('Unsaved changes', true);
    renderPData();
  }));
  $$('[data-delete-pdata]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.deletePdata);
    if (!confirm('Delete this PData row?')) return;
    state.pDataRows.splice(index, 1);
    setPDataStatus('Unsaved changes', true);
    renderPData();
  }));
}


function controlPDataColumns() {
  return window.EWPROS_CONTROL_PDATA?.columns || [];
}

function migrateControlPDataRow(row = {}) {
  return {
    ...row,
    bgeCtrlIncentives: row.bgeCtrlIncentives ?? row.proposedControlManufacturer ?? '',
    pepcoCtrlIncentives: row.pepcoCtrlIncentives ?? row.proposedControlModelNumber ?? ''
  };
}

function defaultControlPDataRows() {
  return JSON.parse(JSON.stringify(window.EWPROS_CONTROL_PDATA?.rows || [])).map(migrateControlPDataRow);
}

function loadControlPDataRows() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONTROL_PDATA_STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return saved.map(migrateControlPDataRow);
  } catch {}
  return defaultControlPDataRows();
}

function blankControlPDataRow() {
  return Object.fromEntries(controlPDataColumns().map(column => [column.key, '']));
}

function setControlPDataStatus(message, dirty = false) {
  const status = $('#controlPdataStatus');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('dirty', dirty);
}

function saveControlPDataRows(showMessage = true) {
  localStorage.setItem(CONTROL_PDATA_STORAGE_KEY, JSON.stringify(state.controlPDataRows));
  setControlPDataStatus(`${state.controlPDataRows.length} rows saved`);
  if (showMessage) toast('Control Data saved on this browser');
}

function renderControlPData() {
  const container = $('#controlPdataTable');
  if (!container) return;
  const columns = controlPDataColumns();
  const query = ($('#controlPdataSearch')?.value || '').trim().toLowerCase();
  const visible = state.controlPDataRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !query || Object.values(row).join(' ').toLowerCase().includes(query));

  container.innerHTML = visible.length ? `
    <table class="pdata-table control-pdata-table">
      <thead><tr><th>#</th>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}<th>Actions</th></tr></thead>
      <tbody>${visible.map(({ row, index }) => `<tr>
        <td class="pdata-row-number">${index + 1}</td>
        ${columns.map(column => {
          const value = escapeHtml(row[column.key] || '');
          const longField = ['controlType', 'controlSelect', 'controlMeasureDescription', 'otherControlType', 'proposedControlModelNumber'].includes(column.key);
          return `<td>${longField
            ? `<textarea data-control-pdata-index="${index}" data-control-pdata-field="${column.key}" rows="2">${value}</textarea>`
            : `<input data-control-pdata-index="${index}" data-control-pdata-field="${column.key}" value="${value}">`
          }</td>`;
        }).join('')}
        <td><div class="pdata-row-actions"><button class="button mini secondary" type="button" data-duplicate-control-pdata="${index}">Duplicate</button><button class="button mini danger-outline" type="button" data-delete-control-pdata="${index}">Delete</button></div></td>
      </tr>`).join('')}</tbody>
    </table>` : '<div class="empty">No Control Data rows match the current search.</div>';

  $$('[data-control-pdata-field]').forEach(input => input.addEventListener('input', () => {
    const index = Number(input.dataset.controlPdataIndex);
    const field = input.dataset.controlPdataField;
    if (!state.controlPDataRows[index]) return;
    state.controlPDataRows[index][field] = input.value;
    setControlPDataStatus('Unsaved changes', true);
  }));
  $$('[data-duplicate-control-pdata]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.duplicateControlPdata);
    state.controlPDataRows.splice(index + 1, 0, { ...state.controlPDataRows[index] });
    setControlPDataStatus('Unsaved changes', true);
    renderControlPData();
  }));
  $$('[data-delete-control-pdata]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.deleteControlPdata);
    if (!confirm('Delete this Control Data row?')) return;
    state.controlPDataRows.splice(index, 1);
    setControlPDataStatus('Unsaved changes', true);
    renderControlPData();
  }));
}

function readStoredJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateMonthsFromToday(months) {
  const date = new Date();
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  return localIsoDate(date);
}

function pepcoOnlineColumns() {
  return window.EWPROS_PEPCO_ONLINE?.columns || [
    { key: 'section', label: 'Online Portal Section' },
    { key: 'field', label: 'Portal Field / Instruction' },
    { key: 'value', label: 'Value / Action' }
  ];
}

function applyPepcoOnlineDateRules(rows) {
  return (rows || []).map(row => {
    const field = String(row.field || '').trim().toLowerCase();
    if (row.dateRule === 'today' || field === 'application date *' || field === 'application date') {
      row.dateRule = 'today';
      row.inputType = 'date';
      row.value = localIsoDate();
    }
    if (row.dateRule === 'twoMonthsFromToday' || field === 'expected completion date') {
      row.dateRule = 'twoMonthsFromToday';
      row.inputType = 'date';
      row.value = dateMonthsFromToday(2);
    }
    return row;
  });
}

function defaultPepcoOnlineRows() {
  return applyPepcoOnlineDateRules(JSON.parse(JSON.stringify(window.EWPROS_PEPCO_ONLINE?.rows || [])));
}

function mergePepcoOnlineDefaults(savedRows) {
  const saved = Array.isArray(savedRows) ? savedRows.map(row => ({ ...row })) : [];
  const defaults = defaultPepcoOnlineRows();
  const keyFor = row => `${String(row.section || '').trim().toLowerCase()}|${String(row.field || '').trim().toLowerCase()}`;
  const keys = new Set(saved.map(keyFor));
  defaults.forEach(row => {
    if (!keys.has(keyFor(row))) saved.push(row);
  });
  return applyPepcoOnlineDateRules(saved);
}

function loadPepcoOnlineRows() {
  try {
    const saved = JSON.parse(localStorage.getItem(PEPCO_ONLINE_STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return mergePepcoOnlineDefaults(saved);
  } catch {}
  return defaultPepcoOnlineRows();
}

function blankPepcoOnlineRow() {
  return { section: '', field: '', value: '', inputType: 'text' };
}

function setPepcoOnlineStatus(message, dirty = false) {
  const status = $('#pepcoOnlineStatus');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('dirty', dirty);
}

function savePepcoOnlineRows(showMessage = true) {
  state.pepcoOnlineRows = applyPepcoOnlineDateRules(state.pepcoOnlineRows);
  localStorage.setItem(PEPCO_ONLINE_STORAGE_KEY, JSON.stringify(state.pepcoOnlineRows));
  setPepcoOnlineStatus(`${state.pepcoOnlineRows.length} rows saved`);
  if (showMessage) toast('PEPCO online worksheet saved on this browser');
}

function renderPepcoOnline() {
  state.pepcoOnlineRows = applyPepcoOnlineDateRules(state.pepcoOnlineRows);
  const container = $('#pepcoOnlineTable');
  if (!container) return;
  const query = ($('#pepcoOnlineSearch')?.value || '').trim().toLowerCase();
  const visible = state.pepcoOnlineRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !query || [row.section, row.field, row.value].join(' ').toLowerCase().includes(query));

  container.innerHTML = visible.length ? `
    <table class="pepco-online-table">
      <thead><tr><th>#</th><th>Online Portal Section</th><th>Portal Field / Instruction</th><th>Value / Action</th><th>Actions</th></tr></thead>
      <tbody>${visible.map(({ row, index }) => {
        const inputType = row.inputType === 'date' ? 'date' : 'text';
        const longField = String(row.field || '').length > 55 || String(row.value || '').length > 45;
        const valueEditor = inputType === 'date'
          ? `<input type="date" ${row.dateRule ? 'readonly title="Automatically calculated"' : ''} data-pepco-online-index="${index}" data-pepco-online-field="value" value="${escapeHtml(row.value || '')}">`
          : longField
            ? `<textarea rows="2" data-pepco-online-index="${index}" data-pepco-online-field="value">${escapeHtml(row.value || '')}</textarea>`
            : `<input data-pepco-online-index="${index}" data-pepco-online-field="value" value="${escapeHtml(row.value || '')}">`;
        return `<tr>
          <td class="pepco-online-row-number">${index + 1}</td>
          <td><input data-pepco-online-index="${index}" data-pepco-online-field="section" value="${escapeHtml(row.section || '')}"></td>
          <td><textarea rows="2" data-pepco-online-index="${index}" data-pepco-online-field="field">${escapeHtml(row.field || '')}</textarea></td>
          <td>${valueEditor}</td>
          <td><div class="pdata-row-actions"><button class="button mini secondary" type="button" data-duplicate-pepco-online="${index}">Duplicate</button><button class="button mini danger-outline" type="button" data-delete-pepco-online="${index}">Delete</button></div></td>
        </tr>`;
      }).join('')}</tbody>
    </table>` : '<div class="empty">No PEPCO online worksheet rows match the current search.</div>';

  $$('[data-pepco-online-field]').forEach(input => input.addEventListener('input', () => {
    const index = Number(input.dataset.pepcoOnlineIndex);
    const field = input.dataset.pepcoOnlineField;
    if (!state.pepcoOnlineRows[index]) return;
    state.pepcoOnlineRows[index][field] = input.value;
    setPepcoOnlineStatus('Unsaved changes', true);
  }));
  $$('[data-duplicate-pepco-online]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.duplicatePepcoOnline);
    state.pepcoOnlineRows.splice(index + 1, 0, { ...state.pepcoOnlineRows[index], dateRule: undefined });
    setPepcoOnlineStatus('Unsaved changes', true);
    renderPepcoOnline();
  }));
  $$('[data-delete-pepco-online]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.deletePepcoOnline);
    if (!confirm('Delete this PEPCO online worksheet row?')) return;
    state.pepcoOnlineRows.splice(index, 1);
    setPepcoOnlineStatus('Unsaved changes', true);
    renderPepcoOnline();
  }));
}

function defaultPepcoTop() {
  return {
    projectName: '', projectAddress: '', city: '', zip: '',
    buildingType: '', heatingFuelType: '',
    companyName: 'EWPros, LLC', contactPerson: 'Mtijan Kamara', phone: '1-800-731-6750', email: 'Support@EWPros.com',
    lightingInventory: true, lightingControlsOnly: false, signLighting: false,
    models: [blankPepcoModelRow(1)]
  };
}

function blankPepcoModelRow(index = 1) {
  return {
    modelId: `M-${String(Math.max(1, index)).padStart(2, '0')}`,
    dlcEnergyStarId: '',
    modelNumber: '',
    reportedLumens: '',
    reportedWattage: '',
    reportedEfficacy: '',
    proposedLedDevice: ''
  };
}

const PEPCO_INVENTORY_COLUMNS = [
  { key: 'location', label: 'Location' },
  { key: 'area', label: 'Interior / Exterior', options: ['', 'Interior', 'Exterior'] },
  { key: 'existingDevicesQty', label: 'Quantity of Existing Devices per Existing Code' },
  { key: 'spaceType', label: 'Space Type', spaceType: true },
  { key: 'over300sf', label: 'Space Greater than 300 sq. ft.?', options: ['', 'Yes', 'No'] },
  { key: 'existingDeviceCategory', label: 'Existing Device Category' },
  { key: 'existingDeviceCode', label: 'Existing Device Code' },
  { key: 'existingWatts', label: 'Existing Watts per Fixture / Device' },
  { key: 'existingQty', label: 'Existing Device Quantity' },
  { key: 'proposeMeasure', label: 'Propose Measure' },
  { key: 'measureType', label: 'Measure Type' },
  { key: 'measureDescription', label: 'Measure Description' },
  { key: 'measureCode', label: 'Measure Code' },
  { key: 'modelId', label: 'Model Select', modelSelect: true },
  { key: 'proposedLedDevice', label: 'Proposed LED Device' },
  { key: 'proposedLedQty', label: 'Proposed LED Fixture Quantity' },
  { key: 'proposedTotalUnits', label: 'Proposed Total Number of Units' },
  { key: 'installedUnitQty', label: 'Installed Unit Quantity' },
  { key: 'incentivizedUnitQty', label: 'Incentivized Unit Quantity' },
  { key: 'minimumWattageReduction', label: 'Minimum Wattage Reduction Met', options: ['', 'Yes', 'No'] },
  { key: 'minimumEfficacy', label: 'Minimum Efficacy Met', options: ['', 'Yes', 'No'] },
  { key: 'incentiveStructure', label: 'Incentive Structure' },
  { key: 'ctrlType', label: 'Ctrl Type', options: ['', 'OS', 'DL', 'O+D', 'Ph'] },
  { key: 'controlType', label: 'Control Type' },
  { key: 'controlSelect', label: 'Control Select' },
  { key: 'otherControlType', label: 'Other Control Type' },
  { key: 'controlMeasureCode', label: 'Control Measure Code' },
  { key: 'qtyControls', label: 'Quantity of Controls' },
  { key: 'controlMounting', label: 'Control Mounting' },
  { key: 'proposedControlManufacturer', label: 'Proposed Control Manufacturer' },
  { key: 'proposedControlModelNumber', label: 'Proposed Control Model Number' },
  { key: 'notes', label: 'Notes' }
];

function blankPepcoInventoryRow() {
  return Object.fromEntries(PEPCO_INVENTORY_COLUMNS.map(column => [column.key, '']));
}

function normalizeCtrlType(value) {
  const raw = String(value || '').trim();
  return raw.toUpperCase() === 'OD' ? 'O+D' : raw;
}

function controlLookupKey(value) {
  return normalizeCtrlType(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function exactPDataMatch(measure) {
  const key = String(measure || '').trim().toLowerCase();
  return state.pDataRows.find(row => String(row.proposeMeasure || '').trim().toLowerCase() === key) || null;
}

function exactControlDataMatch(ctrlType) {
  const key = controlLookupKey(ctrlType);
  return state.controlPDataRows.find(row => controlLookupKey(row.controlDataToMain) === key) || null;
}

function enrichPepcoInventoryRow(row) {
  const pData = exactPDataMatch(row.proposeMeasure);
  if (pData) {
    row.measureType = pData.measureType || '';
    row.measureDescription = pData.measureDescription || '';
    row.measureCode = pData.measureCode || row.measureCode || '';
    row.proposedLedDevice = pData.proposeMeasure || row.proposeMeasure || '';
    row.proposedControlManufacturer = pData.ledManufacturer || '';
  }
  const control = exactControlDataMatch(row.ctrlType);
  if (control) {
    row.controlType = control.controlType || '';
    row.controlSelect = control.controlSelect || '';
    row.otherControlType = control.otherControlType || '';
    row.controlMeasureCode = control.controlMeasureCode || '';
    row.controlMounting = control.controlMounting || '';
  }
  return row;
}

function spaceTypes() {
  return window.EWPROS_SPACE_TYPES?.spaceTypes || [];
}

function suggestSpaceType(location, area) {
  return window.EWPROS_SPACE_TYPES?.suggestSpaceType?.(location, area) || '';
}

function migratePepcoInventoryRow(row) {
  const next = { ...blankPepcoInventoryRow(), ...(row || {}) };
  if (!next.ctrlType && ['OS', 'DL', 'O+D', 'OD', 'Ph'].includes(String(next.controlType || ''))) {
    next.ctrlType = normalizeCtrlType(next.controlType);
    next.controlType = '';
  }
  if (!next.proposeMeasure && next.proposedLedDevice) next.proposeMeasure = next.proposedLedDevice;
  return enrichPepcoInventoryRow(next);
}

function migratePepcoModelRow(row, index) {
  return {
    ...blankPepcoModelRow(index + 1),
    ...(row || {}),
    modelId: row?.modelId || `M-${String(index + 1).padStart(2, '0')}`,
    proposedLedDevice: row?.proposedLedDevice || ''
  };
}

function loadPepcoTop() {
  const value = readStoredJson(PEPCO_TOP_STORAGE_KEY, defaultPepcoTop());
  value.models = Array.isArray(value.models) && value.models.length
    ? value.models.map(migratePepcoModelRow)
    : [blankPepcoModelRow(1)];
  return value;
}

function loadPepcoInventoryRows() {
  const value = readStoredJson(PEPCO_INVENTORY_STORAGE_KEY, [blankPepcoInventoryRow()]);
  return Array.isArray(value) && value.length ? value.map(migratePepcoInventoryRow) : [blankPepcoInventoryRow()];
}

function modelRowForDevice(device) {
  const key = String(device || '').trim().toLowerCase();
  return state.pepcoTop.models.find(row => String(row.proposedLedDevice || '').trim().toLowerCase() === key) || null;
}

function syncPepcoModelsFromInventory() {
  const seen = new Set();
  const models = [];
  state.pepcoInventoryRows.forEach(row => {
    enrichPepcoInventoryRow(row);
    const pData = exactPDataMatch(row.proposeMeasure);
    if (!pData) return;
    const proposedLedDevice = pData.proposeMeasure || row.proposeMeasure || '';
    const key = proposedLedDevice.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    models.push({
      modelId: `M-${String(models.length + 1).padStart(2, '0')}`,
      dlcEnergyStarId: pData.dlcEnergyStarId || '',
      modelNumber: pData.reportedModelNumber || pData.modelNumber || '',
      reportedLumens: pData.reportedLumens || pData.lumensPerFixture || '',
      reportedWattage: pData.reportedWattage || pData.wattsPerFixture || '',
      reportedEfficacy: pData.reportedEfficacy || pData.efficacyPerDevice || '',
      proposedLedDevice
    });
  });
  state.pepcoTop.models = models.length ? models : [blankPepcoModelRow(1)];
  const modelMap = new Map(state.pepcoTop.models.map(row => [String(row.proposedLedDevice || '').trim().toLowerCase(), row.modelId]));
  state.pepcoInventoryRows.forEach(row => {
    const key = String(row.proposedLedDevice || row.proposeMeasure || '').trim().toLowerCase();
    row.modelId = modelMap.get(key) || '';
  });
}

function savePepcoTop() {
  localStorage.setItem(PEPCO_TOP_STORAGE_KEY, JSON.stringify(state.pepcoTop));
  toast('PEPCO upper section saved');
}

function savePepcoInventory() {
  syncPepcoModelsFromInventory();
  localStorage.setItem(PEPCO_INVENTORY_STORAGE_KEY, JSON.stringify(state.pepcoInventoryRows));
  localStorage.setItem(PEPCO_TOP_STORAGE_KEY, JSON.stringify(state.pepcoTop));
  renderPepcoWorkbook();
  toast('PEPCO lighting inventory and model list saved');
}

function dashboardAppointments() {
  const live = state.dashboard?.appointments || [];
  const archived = state.archiveSnapshot?.appointments || [];
  if (!archived.length) return live;
  const seen = new Set(live.map(appointmentProjectKey));
  return [...live, ...archived.filter(item => !seen.has(appointmentProjectKey(item)))];
}

function appointmentProjectKey(item) {
  return String(item?.taskId || item?.appointmentNumber || item?.id || '');
}

function importedProjectByKey(key) {
  return dashboardAppointments().find(item => appointmentProjectKey(item) === String(key || '')) || null;
}

function renderProjectSourceSelectors() {
  const appointments = dashboardAppointments();
  const options = `<option value="">Select an imported appointment…</option>${appointments.map(item => `<option value="${escapeHtml(appointmentProjectKey(item))}">${escapeHtml(item.customer)} — ${escapeHtml(item.date || 'No date')} — ${escapeHtml(item.taskId || '')}</option>`).join('')}`;
  const mappings = [
    ['#pepcoProjectSource', state.selectedPepcoProjectId],
    ['#pepcoOnlineProjectSource', state.selectedPepcoOnlineProjectId],
    ['#invoiceProjectSource', state.selectedInvoiceProjectId]
  ];
  mappings.forEach(([selector, selected]) => {
    const element = $(selector);
    if (!element) return;
    element.innerHTML = options;
    element.value = selected || '';
  });
}

function setOnlineRowValue(fieldPattern, value) {
  const row = state.pepcoOnlineRows.find(item => fieldPattern.test(String(item.field || '').trim()));
  if (row) row.value = value ?? '';
}

function loadPepcoOnlineFromImportedProject(project) {
  if (!project) return false;
  setOnlineRowValue(/^Project Name:?$/i, project.facilityName || project.companyName || project.customer || '');
  setOnlineRowValue(/^First & Last Name:/i, project.contactName || '');
  setOnlineRowValue(/^Company:/i, project.companyName || project.facilityName || project.customer || '');
  setOnlineRowValue(/^Acct #:/i, project.accountNumber || '');
  setOnlineRowValue(/^Meter ID:/i, project.meterId || '');
  setOnlineRowValue(/^Address: \*/i, project.streetAddress || project.address || '');
  setOnlineRowValue(/^Address \(cont\):/i, project.addressCont || '');
  setOnlineRowValue(/^City:/i, project.city || '');
  setOnlineRowValue(/^State\/Province:/i, project.stateCode || '');
  setOnlineRowValue(/^Postal Code:/i, project.zipcode || '');
  setOnlineRowValue(/^Phone: \*/i, project.phone || '');
  setOnlineRowValue(/^eMail:/i, project.email || '');
  setOnlineRowValue(/^Title of Utility Customer/i, project.contactTitle || '');
  setOnlineRowValue(/^Business Sector/i, project.businessSector || project.businessType || '');
  setOnlineRowValue(/^Building Type/i, project.buildingType || project.businessType || '');
  setOnlineRowValue(/^Square Footage By Application/i, project.squareFootage || '');
  setOnlineRowValue(/^Contact Person$/i, 'Mtijan Kamara');
  setOnlineRowValue(/^Phone$/i, '1-800-731-6750');
  state.pepcoOnlineRows = applyPepcoOnlineDateRules(state.pepcoOnlineRows);
  renderPepcoOnline();
  setPepcoOnlineStatus('Imported project data loaded — save worksheet', true);
  return true;
}

function loadPepcoTopFromImportedProject(project) {
  if (!project) return false;
  state.pepcoTop.projectName = project.facilityName || project.companyName || project.customer || '';
  state.pepcoTop.projectAddress = project.streetAddress || project.address || '';
  state.pepcoTop.city = project.city || '';
  state.pepcoTop.zip = project.zipcode || '';
  state.pepcoTop.buildingType = project.buildingType || project.businessType || '';
  state.pepcoTop.heatingFuelType = project.heatingFuelType || '';
  renderPepcoTop();
  return true;
}

function localAuditRows() {
  try {
    const rows = JSON.parse(localStorage.getItem('aw_appointments') || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function localAuditForProject(project) {
  if (!project) return null;
  const keys = new Set([project.taskId, project.appointmentNumber, project.id].filter(Boolean).map(String));
  return localAuditRows().find(item => [item.externalTaskId, item.id, item.databaseId].filter(Boolean).some(value => keys.has(String(value)))) || null;
}

function pepcoInventoryFromAudit(audit) {
  const rows = [];
  ['interior', 'exterior'].forEach(area => {
    (audit?.equipment?.[area] || []).filter(item => item.kind === 'lighting' || item.category === 'Lighting').forEach(item => {
      const row = blankPepcoInventoryRow();
      row.location = item.location || '';
      row.area = area === 'interior' ? 'Interior' : 'Exterior';
      row.existingDevicesQty = Number(item.quantity) || '';
      row.spaceType = item.spaceType || suggestSpaceType(item.location, row.area);
      row.over300sf = item.over300sf || '';
      row.existingDeviceCategory = item.deviceCategory || '';
      row.existingDeviceCode = item.deviceCode || '';
      row.existingQty = Number(item.quantity) || '';
      row.proposeMeasure = item.proposedDevice || item.proposeMeasure || '';
      row.proposedLedQty = Number(item.proposedQty ?? item.quantity) || '';
      row.ctrlType = normalizeCtrlType(item.ctrlType || '');
      row.qtyControls = Number(item.ctrlQty ?? item.ctrlNumber) || '';
      row.notes = item.notes || '';
      rows.push(enrichPepcoInventoryRow(row));
    });
  });
  return rows;
}

function renderPepcoTop() {
  if (!$('#pepcoModelTable')) return;
  $$('[data-pepco-top-field]').forEach(input => {
    const field = input.dataset.pepcoTopField;
    if (input.type === 'checkbox') input.checked = Boolean(state.pepcoTop[field]);
    else input.value = state.pepcoTop[field] || '';
    input.oninput = () => {
      state.pepcoTop[field] = input.type === 'checkbox' ? input.checked : input.value;
    };
    input.onchange = input.oninput;
  });

  $('#pepcoModelTable').innerHTML = state.pepcoTop.models.map((row, index) => `<tr>
    <td><input data-pepco-model-field="modelId" data-pepco-model-index="${index}" value="${escapeHtml(row.modelId || '')}"></td>
    <td><input data-pepco-model-field="dlcEnergyStarId" data-pepco-model-index="${index}" value="${escapeHtml(row.dlcEnergyStarId || '')}"></td>
    <td><input data-pepco-model-field="modelNumber" data-pepco-model-index="${index}" value="${escapeHtml(row.modelNumber || '')}"></td>
    <td><input data-pepco-model-field="reportedLumens" data-pepco-model-index="${index}" value="${escapeHtml(row.reportedLumens || '')}"></td>
    <td><input data-pepco-model-field="reportedWattage" data-pepco-model-index="${index}" value="${escapeHtml(row.reportedWattage || '')}"></td>
    <td><input data-pepco-model-field="reportedEfficacy" data-pepco-model-index="${index}" value="${escapeHtml(row.reportedEfficacy || '')}"></td>
    <td><input data-pepco-model-field="proposedLedDevice" data-pepco-model-index="${index}" value="${escapeHtml(row.proposedLedDevice || '')}"></td>
    <td><div class="sheet-row-actions"><button class="button mini secondary" data-add-pepco-model="${index}" type="button">Add</button><button class="button mini danger-outline" data-delete-pepco-model="${index}" type="button">Delete</button></div></td>
  </tr>`).join('');

  $$('[data-pepco-model-field]').forEach(input => input.addEventListener('input', () => {
    const row = state.pepcoTop.models[Number(input.dataset.pepcoModelIndex)];
    if (row) row[input.dataset.pepcoModelField] = input.value;
  }));
  $$('[data-add-pepco-model]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.addPepcoModel);
    state.pepcoTop.models.splice(index + 1, 0, blankPepcoModelRow(index + 2));
    renderPepcoTop();
  }));
  $$('[data-delete-pepco-model]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.deletePepcoModel);
    if (state.pepcoTop.models.length === 1) return toast('Keep at least one model row');
    state.pepcoTop.models.splice(index, 1);
    renderPepcoTop();
  }));
}

function renderPepcoInventory() {
  const container = $('#pepcoInventoryTable');
  if (!container) return;
  const modelOptionsFor = selected => state.pepcoTop.models
    .filter(row => row.modelId)
    .map(row => `<option value="${escapeHtml(row.modelId)}" ${String(selected || '') === String(row.modelId) ? 'selected' : ''}>${escapeHtml(row.modelId)} — ${escapeHtml(row.proposedLedDevice || row.modelNumber || '')}</option>`)
    .join('');
  container.innerHTML = `<table class="sheet-table pepco-inventory-table"><thead><tr><th>Line #</th>${PEPCO_INVENTORY_COLUMNS.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}<th>Actions</th></tr></thead>
    <tbody>${state.pepcoInventoryRows.map((row, index) => `<tr><td class="sheet-line-number">L${index + 1}</td>${PEPCO_INVENTORY_COLUMNS.map(column => {
      const value = escapeHtml(row[column.key] || '');
      if (column.modelSelect) return `<td><select data-pepco-inventory-index="${index}" data-pepco-inventory-field="${column.key}"><option value="">Select model</option>${modelOptionsFor(row[column.key])}</select></td>`;
      if (column.spaceType) return `<td><select data-pepco-inventory-index="${index}" data-pepco-inventory-field="${column.key}"><option value="">Select space type</option>${spaceTypes().map(option => `<option value="${escapeHtml(option)}" ${row[column.key] === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></td>`;
      if (column.options) return `<td><select data-pepco-inventory-index="${index}" data-pepco-inventory-field="${column.key}">${column.options.map(option => `<option value="${escapeHtml(option)}" ${row[column.key] === option ? 'selected' : ''}>${escapeHtml(option || 'Select')}</option>`).join('')}</select></td>`;
      const longField = ['measureDescription', 'proposedLedDevice', 'controlSelect', 'otherControlType', 'proposedControlModelNumber', 'notes'].includes(column.key);
      return `<td>${longField ? `<textarea rows="2" data-pepco-inventory-index="${index}" data-pepco-inventory-field="${column.key}">${value}</textarea>` : `<input data-pepco-inventory-index="${index}" data-pepco-inventory-field="${column.key}" value="${value}">`}</td>`;
    }).join('')}<td><div class="sheet-row-actions"><button class="button mini secondary" data-add-pepco-inventory="${index}" type="button">Add</button><button class="button mini danger-outline" data-delete-pepco-inventory="${index}" type="button">Delete</button></div></td></tr>`).join('')}</tbody></table>`;

  const updateInventoryField = (input, finalize = false) => {
    const index = Number(input.dataset.pepcoInventoryIndex);
    const row = state.pepcoInventoryRows[index];
    if (!row) return;
    const field = input.dataset.pepcoInventoryField;
    row[field] = input.value;
    if ((field === 'location' || field === 'area') && !row.spaceType) {
      row.spaceType = suggestSpaceType(row.location, row.area);
      const select = document.querySelector(`[data-pepco-inventory-index="${index}"][data-pepco-inventory-field="spaceType"]`);
      if (select && row.spaceType) select.value = row.spaceType;
    }
    if (field === 'modelId') {
      const model = state.pepcoTop.models.find(item => item.modelId === row.modelId);
      if (model) row.proposedLedDevice = model.proposedLedDevice || row.proposedLedDevice;
    }
    if (finalize && field === 'proposeMeasure') {
      enrichPepcoInventoryRow(row);
      syncPepcoModelsFromInventory();
      renderPepcoWorkbook();
      return;
    }
    if (finalize && field === 'ctrlType') {
      enrichPepcoInventoryRow(row);
      renderPepcoInventory();
    }
  };
  $$('[data-pepco-inventory-field]').forEach(input => input.addEventListener('input', () => updateInventoryField(input, false)));
  $$('[data-pepco-inventory-field]').forEach(input => input.addEventListener('change', () => updateInventoryField(input, true)));
  $$('[data-add-pepco-inventory]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.addPepcoInventory);
    state.pepcoInventoryRows.splice(index + 1, 0, blankPepcoInventoryRow());
    renderPepcoInventory();
  }));
  $$('[data-delete-pepco-inventory]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.deletePepcoInventory);
    if (state.pepcoInventoryRows.length === 1) return toast('Keep at least one inventory row');
    state.pepcoInventoryRows.splice(index, 1);
    syncPepcoModelsFromInventory();
    renderPepcoWorkbook();
  }));
}

function renderPepcoWorkbook() {
  renderPepcoTop();
  renderPepcoInventory();
}

function normalizeUtilityProgram(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text.includes('BGE') || text.includes('BALTIMORE GAS')) return 'BGE';
  if (text.includes('PEPCO') || text.includes('POTOMAC ELECTRIC')) return 'PEPCO';
  return text || 'PEPCO';
}

function loadInvoiceSequence() {
  const value = readStoredJson(INVOICE_SEQUENCE_STORAGE_KEY, { lastNumber: 1000000, assignments: {} });
  value.lastNumber = Math.max(1000000, Number(value.lastNumber) || 1000000);
  value.assignments = value.assignments && typeof value.assignments === 'object' ? value.assignments : {};
  return value;
}

function ensureInvoiceNumber(invoice, sourceKey = 'current') {
  const existing = String(invoice.invoiceNumber || '').replace(/\D/g, '');
  const sequence = loadInvoiceSequence();
  const key = String(sourceKey || 'current');
  if (existing.length === 7) {
    invoice.invoiceNumber = existing;
    if (!sequence.assignments[key]) sequence.assignments[key] = existing;
    sequence.lastNumber = Math.max(sequence.lastNumber, Number(existing) || sequence.lastNumber);
    localStorage.setItem(INVOICE_SEQUENCE_STORAGE_KEY, JSON.stringify(sequence));
    return existing;
  }
  if (!sequence.assignments[key]) {
    sequence.lastNumber += 1;
    if (sequence.lastNumber > 9999999) sequence.lastNumber = 1000001;
    sequence.assignments[key] = String(sequence.lastNumber).padStart(7, '0');
    localStorage.setItem(INVOICE_SEQUENCE_STORAGE_KEY, JSON.stringify(sequence));
  }
  invoice.invoiceNumber = sequence.assignments[key];
  return invoice.invoiceNumber;
}

function defaultInvoice() {
  const today = new Date().toISOString().slice(0, 10);
  const invoice = {
    completionDate: '', invoiceDate: today, invoiceNumber: '',
    invoiceToName: '', invoiceToAddress: '', invoiceToCityStateZip: '', invoiceToPhone: '', invoiceToEmail: '',
    notes: '', projectCost: '0.00', incentiveAmount: '0.00', materialCost: '0.00', installationCost: '0.00', balanceDue: '0.00',
    authorizedPersonnel: 'Mtijan Kamara', customerSignatureImage: '', customerSignatureName: '', customerSignatureDate: '',
    sourceAuditId: '', sourceProjectId: '', utilityProgram: 'PEPCO',
    lines: [blankInvoiceLine()]
  };
  ensureInvoiceNumber(invoice, 'current');
  return invoice;
}

function blankInvoiceLine() {
  return {
    location: '',
    existingDeviceCategory: '',
    measureDescription: '',
    modelNumber: '',
    quantity: 1,
    unitPrice: '',
    lineTotal: '0.00',
    reportedWattage: '',
    deviceIncentiveUnit: '',
    deviceIncentive: '0.00',
    controlQty: '',
    controlIncentiveUnit: '',
    controlIncentive: '0.00'
  };
}

function migrateInvoiceLine(line = {}) {
  return {
    ...blankInvoiceLine(),
    ...line,
    existingDeviceCategory: line.existingDeviceCategory ?? line.existing ?? '',
    measureDescription: line.measureDescription ?? line.measure ?? '',
    modelNumber: line.modelNumber ?? line.model ?? '',
    quantity: line.quantity ?? line.qty ?? 1
  };
}

function loadInvoice() {
  const invoice = readStoredJson(INVOICE_STORAGE_KEY, defaultInvoice());
  invoice.lines = Array.isArray(invoice.lines) && invoice.lines.length ? invoice.lines.map(migrateInvoiceLine) : [blankInvoiceLine()];
  invoice.authorizedPersonnel = invoice.authorizedPersonnel || 'Mtijan Kamara';
  invoice.utilityProgram = normalizeUtilityProgram(invoice.utilityProgram);
  ensureInvoiceNumber(invoice, invoice.sourceProjectId || invoice.sourceAuditId || 'current');
  recalculateInvoiceObject(invoice);
  return invoice;
}

function localSignedAudits() {
  try {
    const rows = JSON.parse(localStorage.getItem('aw_appointments') || '[]');
    return Array.isArray(rows) ? rows.filter(item => item.signatureImage || item.signatureName) : [];
  } catch {
    return [];
  }
}

function pDataModelForMeasure(measure) {
  return exactPDataMatch(measure) || {};
}

function splitInvoiceAddress(address) {
  const parts = String(address || '').split(',').map(value => value.trim()).filter(Boolean);
  if (parts.length >= 3) return { street: parts[0], cityStateZip: parts.slice(1).join(', ') };
  return { street: String(address || ''), cityStateZip: '' };
}

function selectedWorkbookProject() {
  return importedProjectByKey(state.selectedInvoiceProjectId || state.selectedPepcoProjectId || $('#invoiceProjectSource')?.value || $('#pepcoProjectSource')?.value);
}

function invoiceLineFromWorkbookRow(row, utilityProgram) {
  const pData = exactPDataMatch(row.proposeMeasure) || {};
  const controlData = exactControlDataMatch(row.ctrlType) || {};
  const model = state.pepcoTop.models.find(item => item.modelId === row.modelId)
    || modelRowForDevice(row.proposedLedDevice)
    || {};
  const quantity = Number(row.proposedLedQty || row.existingQty || row.existingDevicesQty) || 0;
  const controlQty = Number(row.qtyControls) || 0;
  const unitPrice = moneyNumber(pData.unitPrice);
  const deviceIncentiveUnit = utilityProgram === 'BGE'
    ? moneyNumber(pData.bgeIncentives)
    : moneyNumber(pData.pepcoIncentives);
  const controlIncentiveUnit = utilityProgram === 'BGE'
    ? moneyNumber(controlData.bgeCtrlIncentives)
    : moneyNumber(controlData.pepcoCtrlIncentives);
  return {
    location: row.location || '',
    existingDeviceCategory: row.existingDeviceCategory || '',
    measureDescription: row.measureDescription || pData.measureDescription || row.proposeMeasure || '',
    modelNumber: model.modelNumber || pData.reportedModelNumber || pData.modelNumber || '',
    quantity,
    unitPrice: unitPrice ? unitPrice.toFixed(2) : '',
    lineTotal: '0.00',
    reportedWattage: model.reportedWattage || pData.reportedWattage || pData.wattsPerFixture || '',
    deviceIncentiveUnit: deviceIncentiveUnit ? deviceIncentiveUnit.toFixed(2) : '',
    deviceIncentive: '0.00',
    controlQty,
    controlIncentiveUnit: controlIncentiveUnit ? controlIncentiveUnit.toFixed(2) : '',
    controlIncentive: '0.00'
  };
}

function invoiceFromPepcoWorkbook(project) {
  if (!project) return false;
  syncPepcoModelsFromInventory();
  const audit = localAuditForProject(project);
  const utilityProgram = normalizeUtilityProgram(project.utility || project.utilityProgram || audit?.utilityProgram || audit?.utility);
  const meaningfulRows = state.pepcoInventoryRows.filter(row => [
    row.location, row.existingDeviceCategory, row.proposeMeasure, row.measureDescription, row.modelId, row.proposedLedQty
  ].some(value => String(value ?? '').trim()));
  const lines = meaningfulRows.map(row => invoiceLineFromWorkbookRow(row, utilityProgram));
  const cityStateZip = [
    project.city || state.pepcoTop.city,
    project.stateCode || '',
    project.zipcode || state.pepcoTop.zip
  ].filter(Boolean).join(', ').replace(/,\s([^,]+)$/, ' $1');
  const sourceKey = appointmentProjectKey(project) || state.pepcoTop.projectName || `project-${Date.now()}`;
  const current = state.invoice || defaultInvoice();
  state.invoice = {
    ...current,
    invoiceNumber: current.sourceProjectId && current.sourceProjectId !== sourceKey ? '' : current.invoiceNumber,
    completionDate: audit?.completedAt ? String(audit.completedAt).slice(0, 10) : (audit?.date || project.date || ''),
    invoiceDate: current.invoiceDate || new Date().toISOString().slice(0, 10),
    invoiceToName: project.companyName || project.facilityName || project.customer || state.pepcoTop.projectName || '',
    invoiceToAddress: project.streetAddress || project.address || state.pepcoTop.projectAddress || '',
    invoiceToCityStateZip: cityStateZip,
    invoiceToPhone: project.phone || audit?.phone || '',
    invoiceToEmail: project.email || audit?.email || '',
    customerSignatureImage: audit?.signatureImage || current.customerSignatureImage || '',
    customerSignatureName: audit?.signatureName || project.contactName || project.customer || current.customerSignatureName || '',
    customerSignatureDate: audit?.signatureDate ? String(audit.signatureDate).slice(0, 10) : (current.customerSignatureDate || ''),
    sourceAuditId: audit?.id || audit?.externalTaskId || '',
    sourceProjectId: sourceKey,
    utilityProgram,
    authorizedPersonnel: current.authorizedPersonnel || 'Mtijan Kamara',
    lines: lines.length ? lines : [blankInvoiceLine()]
  };
  ensureInvoiceNumber(state.invoice, sourceKey);
  recalculateInvoice();
  renderInvoice();
  toast(`Invoice populated from PEPCO workbook (${utilityProgram})`);
  return true;
}

function invoiceFromAudit(audit) {
  const project = dashboardAppointments().find(item => {
    const auditKeys = new Set([audit.id, audit.externalTaskId, audit.databaseId].filter(Boolean).map(String));
    return [item.id, item.taskId, item.appointmentNumber].filter(Boolean).some(value => auditKeys.has(String(value)));
  });
  if (project) {
    state.selectedInvoiceProjectId = appointmentProjectKey(project);
    return invoiceFromPepcoWorkbook(project);
  }

  const address = splitInvoiceAddress(audit.address);
  const utilityProgram = normalizeUtilityProgram(audit.utilityProgram || audit.utility);
  const lines = [];
  ['interior', 'exterior'].forEach(area => {
    (audit.equipment?.[area] || []).forEach(item => {
      const isLighting = item.kind === 'lighting' || item.category === 'Lighting';
      const pData = isLighting ? pDataModelForMeasure(item.proposedDevice || item.proposeMeasure) : {};
      const controlData = isLighting ? exactControlDataMatch(item.ctrlType) || {} : {};
      const quantity = Number(isLighting ? (item.proposedQty ?? item.quantity) : item.quantity) || 1;
      const controlQty = Number(item.ctrlQty ?? item.ctrlNumber) || 0;
      lines.push({
        location: item.location || area,
        existingDeviceCategory: isLighting ? (item.deviceCategory || '') : (item.category || item.type || ''),
        measureDescription: isLighting ? (pData.measureDescription || item.proposedDevice || '') : (item.notes || ''),
        modelNumber: isLighting ? (pData.reportedModelNumber || pData.modelNumber || '') : (item.model || ''),
        quantity,
        unitPrice: moneyNumber(pData.unitPrice) ? moneyNumber(pData.unitPrice).toFixed(2) : '',
        lineTotal: '0.00',
        reportedWattage: pData.reportedWattage || pData.wattsPerFixture || '',
        deviceIncentiveUnit: moneyNumber(utilityProgram === 'BGE' ? pData.bgeIncentives : pData.pepcoIncentives).toFixed(2),
        deviceIncentive: '0.00',
        controlQty,
        controlIncentiveUnit: moneyNumber(utilityProgram === 'BGE' ? controlData.bgeCtrlIncentives : controlData.pepcoCtrlIncentives).toFixed(2),
        controlIncentive: '0.00'
      });
    });
  });
  const current = state.invoice || defaultInvoice();
  const sourceKey = audit.id || audit.externalTaskId || `audit-${Date.now()}`;
  state.invoice = {
    ...current,
    invoiceNumber: (current.sourceAuditId || current.sourceProjectId) && (current.sourceAuditId || current.sourceProjectId) !== sourceKey ? '' : current.invoiceNumber,
    completionDate: audit.completedAt ? String(audit.completedAt).slice(0, 10) : (audit.date || ''),
    invoiceToName: audit.customer || '',
    invoiceToAddress: address.street,
    invoiceToCityStateZip: address.cityStateZip,
    invoiceToPhone: audit.phone || '',
    invoiceToEmail: audit.email || '',
    customerSignatureImage: audit.signatureImage || '',
    customerSignatureName: audit.signatureName || audit.customer || '',
    customerSignatureDate: audit.signatureDate ? String(audit.signatureDate).slice(0, 10) : '',
    sourceAuditId: sourceKey,
    sourceProjectId: '',
    utilityProgram,
    lines: lines.length ? lines : [blankInvoiceLine()]
  };
  ensureInvoiceNumber(state.invoice, sourceKey);
  recalculateInvoice();
  renderInvoice();
  toast('Invoice populated from the signed audit');
  return true;
}

function moneyNumber(value) {
  const number = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function recalculateInvoiceObject(invoice) {
  let projectCost = 0;
  let incentiveAmount = 0;
  invoice.lines.forEach(line => {
    const quantity = Number(line.quantity) || 0;
    const price = moneyNumber(line.unitPrice);
    const controlQty = Number(line.controlQty) || 0;
    const deviceIncentiveUnit = moneyNumber(line.deviceIncentiveUnit);
    const controlIncentiveUnit = moneyNumber(line.controlIncentiveUnit);
    line.lineTotal = (quantity * price).toFixed(2);
    line.deviceIncentive = (quantity * deviceIncentiveUnit).toFixed(2);
    line.controlIncentive = (controlQty * controlIncentiveUnit).toFixed(2);
    projectCost += quantity * price;
    incentiveAmount += quantity * deviceIncentiveUnit + controlQty * controlIncentiveUnit;
  });
  invoice.projectCost = projectCost.toFixed(2);
  invoice.incentiveAmount = incentiveAmount.toFixed(2);
  invoice.materialCost = (projectCost * 0.35).toFixed(2);
  invoice.installationCost = (projectCost * 0.65).toFixed(2);
  invoice.balanceDue = (projectCost - incentiveAmount).toFixed(2);
  return invoice;
}

function recalculateInvoice() {
  if (!state.invoice) return;
  recalculateInvoiceObject(state.invoice);
}

function saveInvoice(showMessage = true) {
  recalculateInvoice();
  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(state.invoice));
  if (showMessage) toast('Invoice saved on this browser');
}

function renderInvoiceAuditOptions() {
  const select = $('#invoiceAuditSource');
  if (!select) return;
  const audits = localSignedAudits();
  const current = select.value || state.invoice?.sourceAuditId || '';
  select.innerHTML = `<option value="">Select a locally signed audit…</option>${audits.map(audit => `<option value="${escapeHtml(audit.id || audit.externalTaskId || '')}" ${current === (audit.id || audit.externalTaskId) ? 'selected' : ''}>${escapeHtml(audit.customer || 'Customer')} — ${escapeHtml(audit.id || audit.externalTaskId || '')}</option>`).join('')}`;
}

function updateInvoiceSummaryFields() {
  ['projectCost', 'incentiveAmount', 'materialCost', 'installationCost', 'balanceDue'].forEach(field => {
    const input = $(`[data-invoice-field="${field}"]`);
    if (input) input.value = state.invoice[field] || '0.00';
  });
}

function renderInvoiceLines() {
  const container = $('#invoiceLinesTable');
  if (!container) return;
  const utility = normalizeUtilityProgram(state.invoice.utilityProgram);
  const deviceIncentiveLabel = `${utility} Incentives`;
  const controlIncentiveLabel = `${utility} Ctrl Incentives`;
  container.innerHTML = `<table class="invoice-lines-table"><thead><tr>
    <th>Location</th><th>Existing Device Category</th><th>Measure Description</th><th>Model Number</th><th>Quantity</th><th>Unit Price</th><th>Line Total</th>
    <th class="admin-reference">${escapeHtml('Reported Wattage')}</th>
    <th class="admin-reference">${escapeHtml(deviceIncentiveLabel)}</th>
    <th class="admin-reference">${escapeHtml(controlIncentiveLabel)}</th>
    <th>Actions</th>
  </tr></thead><tbody>${state.invoice.lines.map((line, index) => `<tr>
    <td><input data-invoice-line-index="${index}" data-invoice-line-field="location" value="${escapeHtml(line.location || '')}"></td>
    <td><textarea rows="2" data-invoice-line-index="${index}" data-invoice-line-field="existingDeviceCategory">${escapeHtml(line.existingDeviceCategory || '')}</textarea></td>
    <td><textarea rows="2" data-invoice-line-index="${index}" data-invoice-line-field="measureDescription">${escapeHtml(line.measureDescription || '')}</textarea></td>
    <td><textarea rows="2" data-invoice-line-index="${index}" data-invoice-line-field="modelNumber">${escapeHtml(line.modelNumber || '')}</textarea></td>
    <td><input type="number" min="0" data-invoice-line-index="${index}" data-invoice-line-field="quantity" value="${escapeHtml(line.quantity || 0)}"></td>
    <td><input type="number" step="0.01" min="0" data-invoice-line-index="${index}" data-invoice-line-field="unitPrice" value="${escapeHtml(line.unitPrice || '')}"></td>
    <td><input data-invoice-line-total="${index}" readonly value="${escapeHtml(line.lineTotal || '0.00')}"></td>
    <td class="admin-reference"><input readonly value="${escapeHtml(line.reportedWattage || '')}"></td>
    <td class="admin-reference"><input readonly value="${escapeHtml(line.deviceIncentive || '0.00')}"></td>
    <td class="admin-reference"><input readonly value="${escapeHtml(line.controlIncentive || '0.00')}"></td>
    <td><div class="sheet-row-actions"><button class="button mini secondary" data-add-invoice-line="${index}" type="button">Add</button><button class="button mini danger-outline" data-delete-invoice-line="${index}" type="button">Delete</button></div></td>
  </tr>`).join('')}</tbody></table>`;

  $$('[data-invoice-line-field]').forEach(input => input.addEventListener('input', () => {
    const index = Number(input.dataset.invoiceLineIndex);
    const row = state.invoice.lines[index];
    if (!row) return;
    row[input.dataset.invoiceLineField] = input.value;
    recalculateInvoice();
    const totalInput = $(`[data-invoice-line-total="${index}"]`);
    if (totalInput) totalInput.value = row.lineTotal;
    updateInvoiceSummaryFields();
    if (['quantity'].includes(input.dataset.invoiceLineField)) renderInvoiceLines();
  }));
  $$('[data-add-invoice-line]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.addInvoiceLine);
    state.invoice.lines.splice(index + 1, 0, blankInvoiceLine());
    recalculateInvoice();
    renderInvoice();
  }));
  $$('[data-delete-invoice-line]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.deleteInvoiceLine);
    if (state.invoice.lines.length === 1) return toast('Keep at least one invoice line');
    state.invoice.lines.splice(index, 1);
    recalculateInvoice();
    renderInvoice();
  }));
}

function renderInvoiceFields() {
  $$('[data-invoice-field]').forEach(input => {
    const field = input.dataset.invoiceField;
    input.value = state.invoice[field] ?? '';
    input.readOnly = ['invoiceNumber', 'projectCost', 'incentiveAmount', 'materialCost', 'installationCost', 'balanceDue'].includes(field);
    input.oninput = () => {
      state.invoice[field] = input.value;
    };
  });

  const utility = $('#invoiceUtilityProgram');
  if (utility) utility.textContent = normalizeUtilityProgram(state.invoice.utilityProgram);

  const signature = $('#invoiceCustomerSignature');
  if (signature) {
    signature.innerHTML = state.invoice.customerSignatureImage
      ? `<img src="${state.invoice.customerSignatureImage}" alt="Customer signature"><small>${escapeHtml(state.invoice.customerSignatureDate || '')}</small>`
      : 'No customer signature loaded';
  }
  const label = $('#invoiceCustomerSignatureLabel');
  if (label) label.textContent = state.invoice.customerSignatureName
    ? `${state.invoice.customerSignatureName} — Representative/Owner (Customer)`
    : 'Representative/Owner (Customer)';
}

function renderInvoice() {
  if (!$('#invoiceDocument')) return;
  ensureInvoiceNumber(state.invoice, state.invoice.sourceProjectId || state.invoice.sourceAuditId || 'current');
  recalculateInvoice();
  renderInvoiceAuditOptions();
  renderInvoiceFields();
  renderInvoiceLines();
}

function archiveLocalStorageSnapshot() {
  const keys = [
    'aw_appointments', 'aw_email_queue', 'aw_notifications', 'aw_queue',
    INVOICE_SEQUENCE_STORAGE_KEY
  ];
  return Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
}

function buildProjectArchive() {
  return {
    kind: 'EWPros Project Archive',
    version: ADMIN_ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    selected: {
      pepcoProjectId: state.selectedPepcoProjectId,
      pepcoOnlineProjectId: state.selectedPepcoOnlineProjectId,
      invoiceProjectId: state.selectedInvoiceProjectId
    },
    admin: {
      pDataRows: state.pDataRows,
      controlPDataRows: state.controlPDataRows,
      pepcoTop: state.pepcoTop,
      pepcoInventoryRows: state.pepcoInventoryRows,
      pepcoOnlineRows: state.pepcoOnlineRows,
      invoice: state.invoice
    },
    dashboard: state.dashboard || state.archiveSnapshot || { appointments: [], batches: [], metrics: {} },
    localStorage: archiveLocalStorageSnapshot()
  };
}

function archiveFilename() {
  const project = selectedWorkbookProject();
  const base = String(project?.customer || state.pepcoTop?.projectName || 'EWPros_Project')
    .replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'EWPros_Project';
  return `${base}_${localIsoDate()}_EWPros_Project_Archive.json`;
}

function downloadProjectArchive() {
  savePDataRows(false);
  saveControlPDataRows(false);
  savePepcoOnlineRows(false);
  savePepcoInventory();
  saveInvoice(false);
  const archive = buildProjectArchive();
  downloadTextFile(archiveFilename(), JSON.stringify(archive, null, 2), 'application/json;charset=utf-8');
  toast('Complete project archive downloaded');
}

function restoreProjectArchive(archive) {
  if (!archive || archive.kind !== 'EWPros Project Archive' || !archive.admin) {
    throw new Error('This is not a valid EWPros project archive.');
  }
  const stored = archive.localStorage || {};
  Object.entries(stored).forEach(([key, value]) => {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  });
  state.pDataRows = (archive.admin.pDataRows || defaultPDataRows()).map(migratePDataRow);
  state.controlPDataRows = (archive.admin.controlPDataRows || defaultControlPDataRows()).map(migrateControlPDataRow);
  state.pepcoTop = archive.admin.pepcoTop || defaultPepcoTop();
  state.pepcoTop.models = (state.pepcoTop.models || []).length
    ? state.pepcoTop.models.map(migratePepcoModelRow)
    : [blankPepcoModelRow(1)];
  state.pepcoInventoryRows = (archive.admin.pepcoInventoryRows || [blankPepcoInventoryRow()]).map(migratePepcoInventoryRow);
  state.pepcoOnlineRows = applyPepcoOnlineDateRules(archive.admin.pepcoOnlineRows || defaultPepcoOnlineRows());
  state.invoice = archive.admin.invoice || defaultInvoice();
  state.invoice.lines = (state.invoice.lines || []).map(migrateInvoiceLine);
  state.selectedPepcoProjectId = archive.selected?.pepcoProjectId || '';
  state.selectedPepcoOnlineProjectId = archive.selected?.pepcoOnlineProjectId || '';
  state.selectedInvoiceProjectId = archive.selected?.invoiceProjectId || '';
  state.archiveSnapshot = archive.dashboard || null;
  localStorage.setItem(ADMIN_ARCHIVE_STORAGE_KEY, JSON.stringify(state.archiveSnapshot));
  localStorage.setItem(PDATA_STORAGE_KEY, JSON.stringify(state.pDataRows));
  localStorage.setItem(CONTROL_PDATA_STORAGE_KEY, JSON.stringify(state.controlPDataRows));
  localStorage.setItem(PEPCO_TOP_STORAGE_KEY, JSON.stringify(state.pepcoTop));
  localStorage.setItem(PEPCO_INVENTORY_STORAGE_KEY, JSON.stringify(state.pepcoInventoryRows));
  localStorage.setItem(PEPCO_ONLINE_STORAGE_KEY, JSON.stringify(state.pepcoOnlineRows));
  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(state.invoice));
  renderPData();
  renderControlPData();
  renderPepcoWorkbook();
  renderPepcoOnline();
  renderInvoice();
  renderProjectSourceSelectors();
  if (state.archiveSnapshot?.appointments) {
    state.dashboard = state.archiveSnapshot;
    renderDashboard();
  }
}

function importProjectArchiveFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      restoreProjectArchive(JSON.parse(String(reader.result || '')));
      toast('Project archive restored with all saved sections');
    } catch (error) {
      showAlert(error.message || 'Could not restore that project archive.');
    }
  };
  reader.readAsText(file);
}

function showWorkspaceTab(name) {
  state.workspaceTab = name;
  $$('.workbook-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.workspaceTab === name));
  $$('.workspace-view').forEach(view => view.classList.toggle('active', view.id === `workspace-${name}`));
  if (name === 'pdata') { renderPData(); renderControlPData(); }
  if (name === 'pepco-workbook') renderPepcoWorkbook();
  if (name === 'pepco-online') renderPepcoOnline();
  if (name === 'invoice') renderInvoice();
}

state.pDataRows = loadPDataRows();
state.controlPDataRows = loadControlPDataRows();
state.pepcoTop = loadPepcoTop();
state.pepcoInventoryRows = loadPepcoInventoryRows();
if (state.pepcoInventoryRows.some(row => String(row.proposeMeasure || '').trim())) syncPepcoModelsFromInventory();
state.pepcoOnlineRows = loadPepcoOnlineRows();
state.invoice = loadInvoice();
state.archiveSnapshot = readStoredJson(ADMIN_ARCHIVE_STORAGE_KEY, null);

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
  if (!response.ok) {
    const error = new Error(body.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
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
  renderPData();
  renderControlPData();
  renderPepcoWorkbook();
  renderPepcoOnline();
  renderInvoice();
  renderProjectSourceSelectors();
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
  const titles = {
    'business-dashboard':'Business Dashboard', crm:'CRM', projects:'Projects', banking:'Banking', accounting:'Accounting',
    team:'Team & Timesheets', mileage:'Mileage', reports:'Reports', workspace:'Audit Workspace', import:'Asana Import', appointments:'Appointments', history:'Import History'
  };
  $('#pageTitle').textContent = titles[name] || 'Dashboard';
  if (name === 'workspace') showWorkspaceTab(state.workspaceTab || 'main');
  window.EWPROS_BUSINESS?.activate(name);
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
    <table><thead><tr><th>Action</th><th>Date</th><th>Customer</th><th>Utility</th><th>Address</th><th>Assignee</th><th>Fields</th></tr></thead>
    <tbody>${data.changes.map(change => `<tr><td><span class="tag ${escapeHtml(change.action)}">${escapeHtml(change.action)}</span></td><td>${formatDate(change.date)}</td><td><strong>${escapeHtml(change.customer)}</strong><small>${escapeHtml(change.taskId)}</small></td><td><strong>${escapeHtml(change.utility || 'Not identified')}</strong></td><td>${escapeHtml(change.address)}</td><td>${escapeHtml(change.assignee || '—')}</td><td><small>${escapeHtml((change.changedFields || []).join(', ') || 'New record')}</small></td></tr>`).join('')}</tbody></table>`
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
  state.password = $('#adminPassword').value.trim();
  const loginError = $('#loginError');
  loginError.classList.add('hidden');
  loginError.textContent = '';

  try {
    const login = await api(ENDPOINTS.login, { method: 'POST' });
    sessionStorage.setItem('ewpros_admin_password', state.password);
    $('#loginPanel').classList.add('hidden');
    $('#dashboard').classList.remove('hidden');

    if (!login.databaseConfigured) {
      showAlert(`Administrator login succeeded. Netlify is missing: ${login.missingDatabaseVariables.join(', ')}.`);
      return;
    }

    try {
      await loadDashboard(false);
      window.EWPROS_BUSINESS?.activate('business-dashboard');
    } catch (error) {
      // The administrator is authenticated. Keep the dashboard visible and
      // show the database/configuration problem instead of appearing to ignore login.
      showAlert(error.message);
    }
  } catch (error) {
    loginError.textContent = error.message;
    loginError.classList.remove('hidden');
  }
});

$$('.nav-item').forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
$$('.workbook-tab').forEach(tab => tab.addEventListener('click', () => showWorkspaceTab(tab.dataset.workspaceTab)));
$$('[data-open-admin-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.openAdminView)));
$('#pdataSearch')?.addEventListener('input', renderPData);
$('#addPDataRow')?.addEventListener('click', () => {
  state.pDataRows.push(blankPDataRow());
  setPDataStatus('Unsaved changes', true);
  renderPData();
  const wrap = $('#pdataTable');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
});
$('#savePData')?.addEventListener('click', () => savePDataRows(true));
$('#exportPData')?.addEventListener('click', () => {
  const columns = pDataColumns();
  const csv = [
    columns.map(column => csvValue(column.label)).join(','),
    ...state.pDataRows.map(row => columns.map(column => csvValue(row[column.key])).join(','))
  ].join('\r\n');
  downloadTextFile('EWPros_PData.csv', `\ufeff${csv}`, 'text/csv;charset=utf-8');
  toast('PData CSV exported');
});
$('#resetPData')?.addEventListener('click', () => {
  if (!confirm('Reset PData to the 47 built-in rows? Your browser edits will be replaced.')) return;
  localStorage.removeItem(PDATA_STORAGE_KEY);
  state.pDataRows = defaultPDataRows();
  savePDataRows(false);
  renderPData();
  toast('PData reset to project defaults');
});

$('#controlPdataSearch')?.addEventListener('input', renderControlPData);
$('#addControlPDataRow')?.addEventListener('click', () => {
  state.controlPDataRows.push(blankControlPDataRow());
  setControlPDataStatus('Unsaved changes', true);
  renderControlPData();
});
$('#saveControlPData')?.addEventListener('click', () => saveControlPDataRows(true));
$('#exportControlPData')?.addEventListener('click', () => {
  const columns = controlPDataColumns();
  const csv = [
    columns.map(column => csvValue(column.label)).join(','),
    ...state.controlPDataRows.map(row => columns.map(column => csvValue(row[column.key])).join(','))
  ].join('\r\n');
  downloadTextFile('EWPros_Control_Data.csv', `\ufeff${csv}`, 'text/csv;charset=utf-8');
  toast('Control Data CSV exported');
});
$('#resetControlPData')?.addEventListener('click', () => {
  if (!confirm('Reset Control Data to the 4 built-in rows?')) return;
  localStorage.removeItem(CONTROL_PDATA_STORAGE_KEY);
  state.controlPDataRows = defaultControlPDataRows();
  saveControlPDataRows(false);
  renderControlPData();
  toast('Control Data reset to defaults');
});

$('#pepcoProjectSource')?.addEventListener('change', event => {
  state.selectedPepcoProjectId = event.target.value;
  if (!state.selectedInvoiceProjectId) state.selectedInvoiceProjectId = event.target.value;
  const online = $('#pepcoOnlineProjectSource');
  const invoice = $('#invoiceProjectSource');
  if (online && !state.selectedPepcoOnlineProjectId) online.value = event.target.value;
  if (invoice && state.selectedInvoiceProjectId) invoice.value = state.selectedInvoiceProjectId;
});
$('#loadPepcoProjectData')?.addEventListener('click', () => {
  const project = importedProjectByKey($('#pepcoProjectSource')?.value);
  if (!project) return toast('Select an imported appointment first');
  state.selectedPepcoProjectId = appointmentProjectKey(project);
  state.selectedInvoiceProjectId = state.selectedInvoiceProjectId || state.selectedPepcoProjectId;
  loadPepcoTopFromImportedProject(project);
  $('#pepcoProjectLoadStatus').textContent = 'CSV project data loaded';
  toast('Project information filled from imported CSV');
});
$('#loadPepcoAuditData')?.addEventListener('click', () => {
  const project = importedProjectByKey($('#pepcoProjectSource')?.value);
  if (!project) return toast('Select an imported appointment first');
  const audit = localAuditForProject(project);
  if (!audit) {
    $('#pepcoProjectLoadStatus').textContent = 'No local audit found';
    return toast('No matching auditor data is stored in this browser');
  }
  const rows = pepcoInventoryFromAudit(audit);
  if (!rows.length) return toast('The matching audit has no lighting lines');
  state.pepcoInventoryRows = rows;
  syncPepcoModelsFromInventory();
  renderPepcoWorkbook();
  $('#pepcoProjectLoadStatus').textContent = `${rows.length} audit lighting line(s) loaded`;
  toast('Lighting inventory filled from auditor data');
});
$('#pepcoOnlineProjectSource')?.addEventListener('change', event => {
  state.selectedPepcoOnlineProjectId = event.target.value;
});
$('#loadPepcoOnlineProjectData')?.addEventListener('click', () => {
  const project = importedProjectByKey($('#pepcoOnlineProjectSource')?.value);
  if (!project) return toast('Select an imported appointment first');
  state.selectedPepcoOnlineProjectId = appointmentProjectKey(project);
  loadPepcoOnlineFromImportedProject(project);
  $('#pepcoOnlineProjectStatus').textContent = 'Imported CSV data loaded';
  toast('PEPCO Online worksheet filled from imported CSV');
});

$('#addPepcoModelRow')?.addEventListener('click', () => {
  state.pepcoTop.models.push(blankPepcoModelRow(state.pepcoTop.models.length + 1));
  renderPepcoTop();
});
$('#savePepcoTop')?.addEventListener('click', savePepcoTop);
$('#resetPepcoTop')?.addEventListener('click', () => {
  if (!confirm('Reset the independent PEPCO upper section?')) return;
  state.pepcoTop = defaultPepcoTop();
  localStorage.removeItem(PEPCO_TOP_STORAGE_KEY);
  renderPepcoTop();
});
$('#addPepcoInventoryRow')?.addEventListener('click', () => {
  state.pepcoInventoryRows.push(blankPepcoInventoryRow());
  renderPepcoInventory();
});
$('#savePepcoInventory')?.addEventListener('click', savePepcoInventory);
$('#resetPepcoInventory')?.addEventListener('click', () => {
  if (!confirm('Reset the independent PEPCO lighting inventory?')) return;
  state.pepcoInventoryRows = [blankPepcoInventoryRow()];
  localStorage.removeItem(PEPCO_INVENTORY_STORAGE_KEY);
  renderPepcoInventory();
});

$('#pepcoOnlineSearch')?.addEventListener('input', renderPepcoOnline);
$('#addPepcoOnlineRow')?.addEventListener('click', () => {
  state.pepcoOnlineRows.push(blankPepcoOnlineRow());
  setPepcoOnlineStatus('Unsaved changes', true);
  renderPepcoOnline();
  const wrap = $('#pepcoOnlineTable');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
});
$('#savePepcoOnline')?.addEventListener('click', () => savePepcoOnlineRows(true));
$('#exportPepcoOnline')?.addEventListener('click', () => {
  const columns = pepcoOnlineColumns();
  const csv = [
    columns.map(column => csvValue(column.label)).join(','),
    ...state.pepcoOnlineRows.map(row => columns.map(column => csvValue(row[column.key])).join(','))
  ].join('\r\n');
  downloadTextFile('EWPros_PEPCO_Online_Worksheet.csv', `\ufeff${csv}`, 'text/csv;charset=utf-8');
  toast('PEPCO online worksheet CSV exported');
});
$('#resetPepcoOnline')?.addEventListener('click', () => {
  if (!confirm('Reset the PEPCO online worksheet to the supplied defaults?')) return;
  localStorage.removeItem(PEPCO_ONLINE_STORAGE_KEY);
  state.pepcoOnlineRows = defaultPepcoOnlineRows();
  savePepcoOnlineRows(false);
  renderPepcoOnline();
  toast('PEPCO online worksheet reset to defaults');
});

$('#invoiceProjectSource')?.addEventListener('change', event => {
  state.selectedInvoiceProjectId = event.target.value;
});
$('#loadInvoiceWorkbook')?.addEventListener('click', () => {
  const project = importedProjectByKey($('#invoiceProjectSource')?.value || state.selectedPepcoProjectId);
  if (!project) return toast('Select an imported appointment first');
  state.selectedInvoiceProjectId = appointmentProjectKey(project);
  invoiceFromPepcoWorkbook(project);
});
$('#syncInvoiceBusiness')?.addEventListener('click', async () => {
  try {
    saveInvoice(false);
    const result = await api('/.netlify/functions/business-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_invoice', invoice: state.invoice, status: 'draft', sourceProjectId: state.invoice.sourceProjectId || state.selectedInvoiceProjectId || '' })
    });
    toast(`Invoice ${result.data?.invoice_number || state.invoice.invoiceNumber} synced to CRM / Accounting`);
    window.EWPROS_BUSINESS?.refresh?.();
  } catch (error) {
    showAlert(error.message);
  }
});
$('#downloadProjectArchive')?.addEventListener('click', downloadProjectArchive);
$('#uploadProjectArchive')?.addEventListener('change', event => {
  importProjectArchiveFile(event.target.files?.[0]);
  event.target.value = '';
});

$('#loadInvoiceAudit')?.addEventListener('click', () => {
  const id = $('#invoiceAuditSource')?.value;
  const audit = localSignedAudits().find(item => String(item.id || item.externalTaskId || '') === String(id || ''));
  if (!audit) return toast('Choose a locally signed audit first');
  invoiceFromAudit(audit);
});
$('#invoiceSignatureUpload')?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.invoice.customerSignatureImage = String(reader.result || '');
    renderInvoiceFields();
    toast('Customer signature loaded');
  };
  reader.readAsDataURL(file);
});
$('#addInvoiceLine')?.addEventListener('click', () => {
  state.invoice.lines.push(blankInvoiceLine());
  renderInvoiceLines();
});
$('#saveInvoice')?.addEventListener('click', () => saveInvoice(true));
$('#printInvoice')?.addEventListener('click', () => {
  saveInvoice(false);
  document.body.classList.add('invoice-printing');
  window.print();
  setTimeout(() => document.body.classList.remove('invoice-printing'), 500);
});

$('#refreshDashboard').addEventListener('click', () => {
  loadDashboard(true).catch(() => {});
  const activeView = $('.nav-item.active')?.dataset.view || '';
  if (['business-dashboard','crm','projects','banking','accounting','team','mileage','reports'].includes(activeView)) window.EWPROS_BUSINESS?.refresh?.();
});
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

renderPData();
renderControlPData();
renderPepcoWorkbook();
renderPepcoOnline();
renderInvoice();
showWorkspaceTab('main');

if (state.password) {
  $('#loginPanel').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  loadDashboard(false).catch(() => {});
}
