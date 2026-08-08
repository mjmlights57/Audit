const crypto = require('crypto');
const { json } = require('./_supabase');
const { requireAdmin, parseBody, money, isMissingBusinessSchema, lookupByCode, createJournal, postOperationalTransaction } = require('./_business-core');

const clean = value => value === '' || value === undefined ? null : value;
const required = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error(`${label} is required.`);
  return value;
};

async function inheritProjectDimensions(supabase, body) {
  if (!body.project_id) return body;
  const { data: project, error } = await supabase.from('projects').select('customer_id,business_line_id').eq('id', body.project_id).maybeSingle();
  if (error) throw error;
  if (!project) return body;
  return { ...body, customer_id: body.customer_id || project.customer_id || null, business_line_id: body.business_line_id || project.business_line_id || null };
}

async function createCustomer(supabase, body) {
  const payload = {
    customer_type: body.customer_type || 'customer',
    primary_business_line_id: required(body.primary_business_line_id, 'Primary business line'),
    display_name: required(body.display_name, 'Customer name'),
    company_name: clean(body.company_name), contact_name: clean(body.contact_name), phone: clean(body.phone), email: clean(body.email),
    service_address: clean(body.service_address), mailing_address: clean(body.mailing_address), city: clean(body.city), state_code: clean(body.state_code), zipcode: clean(body.zipcode),
    source: body.source || 'manual', tags: Array.isArray(body.tags) ? body.tags : [], notes: clean(body.notes), active: body.active !== false
  };
  const { data, error } = await supabase.from('customers').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

async function createProject(supabase, body) {
  required(body.business_line_id, 'Business line');
  required(body.name, 'Project name');
  const payload = {
    customer_id: clean(body.customer_id), business_line_id: body.business_line_id, project_number: clean(body.project_number), name: body.name,
    project_type: clean(body.project_type), status: body.status || 'lead', start_date: clean(body.start_date), end_date: clean(body.end_date),
    service_address: clean(body.service_address), description: clean(body.description), quoted_amount: money(body.quoted_amount)
  };
  const { data, error } = await supabase.from('projects').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

function pinFields(pin) {
  const value = String(pin || '').trim();
  if (!value) return {};
  if (!/^\d{4,10}$/.test(value)) throw new Error('Timesheet PIN must be 4–10 digits.');
  const salt = crypto.randomBytes(16).toString('hex');
  return { timesheet_pin_salt:salt, timesheet_pin_hash:crypto.createHash('sha256').update(`${salt}|${value}`).digest('hex') };
}

async function createWorker(supabase, body) {
  const payload = {
    worker_type: required(body.worker_type, 'Worker classification'), first_name: required(body.first_name, 'First name'), last_name: required(body.last_name, 'Last name'),
    email: clean(body.email)?.toLowerCase() || null, phone: clean(body.phone), pay_type: body.pay_type || 'hourly', pay_rate: money(body.pay_rate),
    overtime_rate: body.overtime_rate === '' || body.overtime_rate == null ? null : money(body.overtime_rate), active: body.active !== false,
    timesheet_access_enabled: body.timesheet_access_enabled !== false, ...pinFields(body.timesheet_pin)
  };
  if (!payload.email && body.timesheet_pin) throw new Error('Worker email is required when assigning a timesheet PIN.');
  const { data, error } = await supabase.from('workers').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

async function createAccount(supabase, body) {
  const accountType = body.account_type || 'bank';
  let ledger = null;
  let createdLedgerId = null;
  if (body.ledger_account_id) {
    const { data, error } = await supabase.from('chart_accounts').select('*').eq('id', body.ledger_account_id).single();
    if (error) throw error;
    ledger = data;
  } else {
    const { data: existingCodes, error: codeError } = await supabase.from('chart_accounts').select('code');
    if (codeError) throw codeError;
    const used = new Set((existingCodes || []).map(row => Number(row.code)).filter(Number.isFinite));
    const rangeStart = accountType === 'credit_card' ? 2020 : 1020;
    const rangeEnd = accountType === 'credit_card' ? 2999 : 1999;
    let code = rangeStart;
    while (used.has(code) && code <= rangeEnd) code += 1;
    if (code > rangeEnd) throw new Error('No available ledger account codes remain for this account type.');
    const chartPayload = {
      code: String(code),
      name: required(body.name, 'Account name'),
      account_type: accountType === 'credit_card' ? 'liability' : 'asset',
      subtype: accountType === 'credit_card' ? 'credit_card' : 'bank',
      active: true
    };
    const { data: created, error: ledgerError } = await supabase.from('chart_accounts').insert(chartPayload).select('*').single();
    if (ledgerError) throw ledgerError;
    ledger = created;
    createdLedgerId = created.id;
  }
  const payload = {
    name: required(body.name, 'Account name'), institution: clean(body.institution), account_type: accountType, last4: clean(body.last4),
    ledger_account_id: ledger?.id || null, opening_balance: money(body.opening_balance), opening_balance_date: clean(body.opening_balance_date), active: true
  };
  const { data, error } = await supabase.from('financial_accounts').insert(payload).select('*').single();
  if (error) {
    if (createdLedgerId) await supabase.from('chart_accounts').delete().eq('id', createdLedgerId);
    throw error;
  }
  const opening = money(body.opening_balance);
  if (Math.abs(opening) > 0.004 && ledger?.id) {
    try {
      const equity = await lookupByCode(supabase, 'chart_accounts', 'code', '3200');
      const amount = Math.abs(opening);
      const assetIncrease = accountType !== 'credit_card' ? opening > 0 : opening < 0;
      const lines = assetIncrease
        ? [{ledger_account_id:ledger.id,debit:amount,credit:0},{ledger_account_id:equity.id,debit:0,credit:amount}]
        : [{ledger_account_id:equity.id,debit:amount,credit:0},{ledger_account_id:ledger.id,debit:0,credit:amount}];
      await createJournal(supabase,{entry_date:body.opening_balance_date||new Date().toISOString().slice(0,10),memo:`Opening balance — ${data.name}`,source_type:'opening_balance',source_id:data.id},lines);
    } catch (journalError) {
      await supabase.from('financial_accounts').delete().eq('id', data.id);
      if (createdLedgerId) await supabase.from('chart_accounts').delete().eq('id', createdLedgerId);
      throw journalError;
    }
  }
  return data;
}

async function createRule(supabase, body) {
  const keywords = Array.isArray(body.keywords) ? body.keywords : String(body.keywords || '').split(/[\n,]+/).map(v => v.trim()).filter(Boolean);
  if (!keywords.length) throw new Error('Enter at least one keyword.');
  const payload = {
    name: required(body.name, 'Rule name'), keywords, match_mode: body.match_mode || 'any', category_id: clean(body.category_id),
    business_line_id: clean(body.business_line_id), customer_id: clean(body.customer_id), project_id: clean(body.project_id),
    active: body.active !== false, priority: Number(body.priority) || 100
  };
  const { data, error } = await supabase.from('transaction_rules').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

async function recordTransaction(supabase, body) {
  body = await inheritProjectDimensions(supabase, body);
  required(body.transaction_date, 'Transaction date');
  required(body.financial_account_id, 'Financial account');
  required(body.category_id, 'Category');
  const amount = Math.abs(money(body.amount));
  if (!amount) throw new Error('Amount must be greater than zero.');
  const { data: category, error: categoryError } = await supabase.from('transaction_categories').select('id,behavior').eq('id', body.category_id).single();
  if (categoryError) throw categoryError;
  const transactionType = body.transaction_type || category.behavior;
  if (['income','expense','customer_payment','vendor_payment'].includes(transactionType) && !body.business_line_id) throw new Error('Choose a business line for income or expense activity.');
  const payload = {
    transaction_date: body.transaction_date, transaction_type: transactionType, amount, description: body.description || '', category_id: body.category_id,
    business_line_id: clean(body.business_line_id), customer_id: clean(body.customer_id), project_id: clean(body.project_id), vendor_id: clean(body.vendor_id),
    financial_account_id: body.financial_account_id, personal: transactionType === 'owner_draw', source: body.source || 'manual'
  };
  const { data: inserted, error } = await supabase.from('financial_transactions').insert(payload).select('*').single();
  if (error) throw error;
  try {
    const posted = await postOperationalTransaction(supabase, inserted, { source_id: inserted.id, counter_financial_account_id: clean(body.counter_financial_account_id) });
    return { ...inserted, journal_id: posted.journalId };
  } catch (postingError) {
    await supabase.from('financial_transactions').delete().eq('id', inserted.id);
    throw postingError;
  }
}

async function reviewBankTransaction(supabase, body) {
  body = await inheritProjectDimensions(supabase, body);
  required(body.id, 'Bank transaction');
  const patch = {
    category_id: clean(body.category_id), business_line_id: clean(body.business_line_id), customer_id: clean(body.customer_id), project_id: clean(body.project_id), vendor_id: clean(body.vendor_id),
    review_notes: clean(body.review_notes)
  };
  if (body.status === 'ignored') {
    patch.review_status = 'ignored'; patch.reviewed_at = new Date().toISOString();
    const { data, error } = await supabase.from('bank_transactions').update(patch).eq('id', body.id).select('*').single();
    if (error) throw error;
    return data;
  }
  if (body.status !== 'posted') {
    const { data, error } = await supabase.from('bank_transactions').update(patch).eq('id', body.id).select('*').single();
    if (error) throw error;
    return data;
  }
  if (!patch.category_id) throw new Error('Choose a category before posting.');
  const { data: existing } = await supabase.from('financial_transactions').select('id').eq('bank_transaction_id', body.id).maybeSingle();
  if (existing) throw new Error('This bank transaction has already been posted.');
  const { data: bankTx, error: bankError } = await supabase.from('bank_transactions').select('*').eq('id', body.id).single();
  if (bankError) throw bankError;
  const { data: category, error: categoryError } = await supabase.from('transaction_categories').select('id,behavior').eq('id', patch.category_id).single();
  if (categoryError) throw categoryError;
  const amount = Math.abs(money(bankTx.amount));
  const type = category.behavior;
  if (['income','expense','customer_payment','vendor_payment'].includes(type) && !patch.business_line_id) throw new Error('Choose a business line before posting this income or expense.');
  const ft = {
    transaction_date: bankTx.transaction_date, transaction_type: type, amount, description: bankTx.description, category_id: patch.category_id,
    business_line_id: patch.business_line_id, customer_id: patch.customer_id, project_id: patch.project_id, vendor_id: patch.vendor_id,
    financial_account_id: bankTx.financial_account_id, bank_transaction_id: bankTx.id, personal: type === 'owner_draw', source: 'bank_import'
  };
  const { data: inserted, error: insertError } = await supabase.from('financial_transactions').insert(ft).select('*').single();
  if (insertError) throw insertError;
  try {
    const posted = await postOperationalTransaction(supabase, inserted, { source_id: inserted.id, counter_financial_account_id: clean(body.counter_financial_account_id), direction: money(bankTx.amount) > 0 ? 'in' : 'out' });
    patch.review_status = 'posted'; patch.personal = type === 'owner_draw'; patch.reviewed_at = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase.from('bank_transactions').update(patch).eq('id', body.id).select('*').single();
    if (updateError) throw updateError;
    return { ...updated, journal_id: posted.journalId };
  } catch (postingError) {
    await supabase.from('financial_transactions').delete().eq('id', inserted.id);
    throw postingError;
  }
}

async function recordInvoicePayment(supabase, body) {
  const invoiceId = required(body.invoice_id, 'Invoice');
  const accountId = required(body.financial_account_id, 'Financial account');
  const amount = Math.abs(money(body.amount));
  if (!amount) throw new Error('Payment amount must be greater than zero.');
  const { data: invoice, error: invoiceError } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
  if (invoiceError) throw invoiceError;
  if (invoice.status === 'void') throw new Error('A void invoice cannot receive a payment.');
  const balance = money(invoice.balance_due);
  if (amount > balance + 0.009) throw new Error(`Payment exceeds the current balance of ${balance.toFixed(2)}.`);

  let categoryName = 'Other Income';
  if (invoice.business_line_id) {
    const { data: line } = await supabase.from('business_lines').select('code').eq('id', invoice.business_line_id).maybeSingle();
    categoryName = ({
      strikecheck_inspections: 'Inspection Income', strikecheck_referrals: 'Referral Income', utility_programs: 'Utility Revenue',
      ewpros_electrical: 'Electrical Revenue', ewpros_renovation: 'Renovation Revenue'
    })[line?.code] || 'Other Income';
  }
  const { data: category, error: categoryError } = await supabase.from('transaction_categories').select('id,behavior').eq('name', categoryName).single();
  if (categoryError) throw categoryError;
  const paymentDate = body.payment_date || new Date().toISOString().slice(0,10);
  const { data: payment, error: paymentError } = await supabase.from('payments').insert({
    invoice_id:invoice.id, customer_id:invoice.customer_id, project_id:invoice.project_id, business_line_id:invoice.business_line_id,
    financial_account_id:accountId, payment_date:paymentDate, amount, payment_method:clean(body.payment_method), reference:clean(body.reference), notes:clean(body.notes)
  }).select('*').single();
  if (paymentError) throw paymentError;

  const ftPayload = {
    transaction_date:paymentDate, transaction_type:'income', amount, description:`Invoice ${invoice.invoice_number} payment${body.reference?` — ${body.reference}`:''}`,
    category_id:category.id, business_line_id:invoice.business_line_id, customer_id:invoice.customer_id, project_id:invoice.project_id,
    financial_account_id:accountId, personal:false, source:'invoice_payment'
  };
  const { data: tx, error: txError } = await supabase.from('financial_transactions').insert(ftPayload).select('*').single();
  if (txError) { await supabase.from('payments').delete().eq('id',payment.id); throw txError; }
  try {
    await postOperationalTransaction(supabase, tx, { source_id: tx.id });
    const newPaid = money(invoice.amount_paid) + amount;
    const newBalance = Math.max(0, money(invoice.total) - newPaid);
    const newStatus = newBalance <= 0.009 ? 'paid' : 'partial';
    const { data: updated, error: updateError } = await supabase.from('invoices').update({amount_paid:newPaid,balance_due:newBalance,status:newStatus}).eq('id',invoice.id).select('*').single();
    if (updateError) throw updateError;
    return { payment, invoice:updated, transaction:tx };
  } catch (error) {
    await supabase.from('financial_transactions').delete().eq('id',tx.id);
    await supabase.from('payments').delete().eq('id',payment.id);
    throw error;
  }
}

async function saveInvoice(supabase, body) {
  const invoice = body.invoice || {};
  const number = required(invoice.invoiceNumber || invoice.invoice_number, 'Invoice number');
  let project = null;
  const sourceProjectId = invoice.sourceProjectId || body.sourceProjectId;
  if (sourceProjectId) {
    const { data: byExternal, error: externalError } = await supabase.from('projects').select('*').eq('external_key', String(sourceProjectId)).limit(1).maybeSingle();
    if (externalError) throw externalError;
    project = byExternal || null;
    if (!project) {
      const { data: byNumber, error: numberError } = await supabase.from('projects').select('*').eq('project_number', String(sourceProjectId)).limit(1).maybeSingle();
      if (numberError) throw numberError;
      project = byNumber || null;
    }
  }
  let customerId = project?.customer_id || clean(body.customer_id);
  let businessLineId = project?.business_line_id || clean(body.business_line_id);
  if (!businessLineId) {
    const code = String(invoice.utilityProgram || '').toUpperCase().match(/BGE|PEPCO/) ? 'utility_programs' : 'ewpros_electrical';
    businessLineId = (await lookupByCode(supabase, 'business_lines', 'code', code))?.id || null;
  }
  if (!customerId && invoice.invoiceToName) {
    const { data: existing } = await supabase.from('customers').select('id').ilike('display_name', invoice.invoiceToName).limit(1).maybeSingle();
    if (existing) customerId = existing.id;
    else {
      const { data: created, error } = await supabase.from('customers').insert({ display_name: invoice.invoiceToName, primary_business_line_id:businessLineId, phone: clean(invoice.invoiceToPhone), email: clean(invoice.invoiceToEmail), service_address: clean(invoice.invoiceToAddress), source:'invoice' }).select('id').single();
      if (error) throw error;
      customerId = created.id;
    }
  }
  const total = money(invoice.projectCost || invoice.total || invoice.balanceDue);
  const balance = money(invoice.balanceDue ?? total);
  const payload = {
    invoice_number: String(number), customer_id: customerId, project_id: project?.id || clean(body.project_id), business_line_id: businessLineId,
    invoice_date: invoice.invoiceDate || new Date().toISOString().slice(0,10), completion_date: clean(invoice.completionDate), due_date: clean(body.due_date), status: body.status || 'draft',
    subtotal: total, incentive_amount: money(invoice.incentiveAmount), total, amount_paid: Math.max(0,total-balance), balance_due: balance,
    notes: clean(invoice.notes), legacy_payload: invoice
  };
  const { data: saved, error } = await supabase.from('invoices').upsert(payload, { onConflict:'invoice_number' }).select('*').single();
  if (error) throw error;
  await supabase.from('invoice_items').delete().eq('invoice_id', saved.id);
  const lines = (invoice.lines || []).filter(line => String(line.measureDescription || line.description || '').trim() || money(line.lineTotal));
  if (lines.length) {
    const items = lines.map((line, index) => ({ invoice_id:saved.id, description:line.measureDescription || line.description || line.modelNumber || `Invoice line ${index+1}`, quantity:money(line.quantity || 1), unit_price:money(line.unitPrice), line_total:money(line.lineTotal), sort_order:index }));
    const { error: itemError } = await supabase.from('invoice_items').insert(items);
    if (itemError) throw itemError;
  }
  return saved;
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error:'Method not allowed.' });
  const auth = requireAdmin(event); if (auth.error) return auth.error;
  const { supabase } = auth;
  try {
    const body = parseBody(event); const action = body.action;
    let data;
    if (action === 'create_customer') data = await createCustomer(supabase, body);
    else if (action === 'update_customer') { const id=required(body.id,'Customer'); const { data:d,error }=await supabase.from('customers').update(body.patch || {}).eq('id',id).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'add_customer_note') { const {data:d,error}=await supabase.from('customer_notes').insert({customer_id:required(body.customer_id,'Customer'),note:required(body.note,'Note'),created_by:'Administrator'}).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'add_reminder') { const {data:d,error}=await supabase.from('reminders').insert({customer_id:clean(body.customer_id),project_id:clean(body.project_id),title:required(body.title,'Reminder title'),details:clean(body.details),due_at:clean(body.due_at)}).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'complete_reminder') { const {data:d,error}=await supabase.from('reminders').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',required(body.id,'Reminder')).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'create_project') data = await createProject(supabase, body);
    else if (action === 'update_project') { const {data:d,error}=await supabase.from('projects').update(body.patch || {}).eq('id',required(body.id,'Project')).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'create_worker') data = await createWorker(supabase, body);
    else if (action === 'set_worker_timesheet_pin') { const id=required(body.id,'Worker'); const patch={...pinFields(required(body.timesheet_pin,'Timesheet PIN')),timesheet_access_enabled:body.timesheet_access_enabled!==false}; const {data:d,error}=await supabase.from('workers').update(patch).eq('id',id).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'add_time_entry') { const p={worker_id:required(body.worker_id,'Worker'),project_id:clean(body.project_id),business_line_id:required(body.business_line_id,'Business line'),work_date:required(body.work_date,'Work date'),regular_hours:money(body.regular_hours),overtime_hours:money(body.overtime_hours),notes:clean(body.notes),approval_status:body.approval_status||'submitted'}; const {data:d,error}=await supabase.from('time_entries').insert(p).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'update_time_status') { const status=required(body.status,'Status'); const patch={approval_status:status,approved_at:status==='approved'?new Date().toISOString():null}; const {data:d,error}=await supabase.from('time_entries').update(patch).eq('id',required(body.id,'Time entry')).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'add_worker_payment') { const p={worker_id:required(body.worker_id,'Worker'),project_id:clean(body.project_id),business_line_id:clean(body.business_line_id),financial_account_id:clean(body.financial_account_id),payment_date:required(body.payment_date,'Payment date'),amount:Math.abs(money(body.amount)),payment_type:body.payment_type||'labor_payment',reference:clean(body.reference),notes:clean(body.notes)}; if(!p.amount)throw new Error('Payment amount must be greater than zero.'); const {data:d,error}=await supabase.from('worker_payments').insert(p).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'add_mileage') { const p={trip_date:required(body.trip_date,'Trip date'),worker_id:clean(body.worker_id),customer_id:clean(body.customer_id),project_id:clean(body.project_id),business_line_id:required(body.business_line_id,'Business line'),origin:required(body.origin,'Origin'),destination:required(body.destination,'Destination'),miles:money(body.miles),purpose:clean(body.purpose),reimbursement_rate:body.reimbursement_rate===''?null:money(body.reimbursement_rate),reimbursable:!!body.reimbursable}; const {data:d,error}=await supabase.from('mileage_trips').insert(p).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'create_account') data = await createAccount(supabase, body);
    else if (action === 'create_rule') data = await createRule(supabase, body);
    else if (action === 'update_rule') { const patch={...body.patch}; if(typeof patch.keywords==='string')patch.keywords=patch.keywords.split(/[\n,]+/).map(v=>v.trim()).filter(Boolean); const {data:d,error}=await supabase.from('transaction_rules').update(patch).eq('id',required(body.id,'Rule')).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'toggle_rule') { const {data:d,error}=await supabase.from('transaction_rules').update({active:!!body.active}).eq('id',required(body.id,'Rule')).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'create_vendor') { const {data:d,error}=await supabase.from('vendors').insert({name:required(body.name,'Vendor name'),phone:clean(body.phone),email:clean(body.email),address:clean(body.address)}).select('*').single(); if(error)throw error; data=d; }
    else if (action === 'record_transaction') data = await recordTransaction(supabase, body);
    else if (action === 'review_bank_transaction') data = await reviewBankTransaction(supabase, body);
    else if (action === 'save_invoice') data = await saveInvoice(supabase, body);
    else if (action === 'record_invoice_payment') data = await recordInvoicePayment(supabase, body);
    else throw new Error(`Unknown business action: ${action || '(missing)'}`);
    return json(200, {ok:true,data});
  } catch (error) {
    console.error('[business-action]', error);
    if (isMissingBusinessSchema(error)) return json(409,{error:'Business modules require the v3.0 Supabase schema. Run EWPROS-BUSINESS-SYSTEM-SCHEMA.sql first.',setupRequired:true});
    return json(400,{error:error.message||'Business action failed.'});
  }
};
