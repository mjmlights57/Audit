(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
  const num = value => Number(value)||0;
  const fmtDate = value => {
    if (!value) return '—';
    const d = new Date(`${String(value).slice(0,10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  };
  const state = { lookups:null, dashboard:null, customers:null, projects:null, banking:null, accounting:null, team:null, mileage:null, reports:null, bankPreview:null, bankFile:null, editingRuleId:null };

  async function api(path, options={}) {
    const password = sessionStorage.getItem('ewpros_admin_password') || '';
    const response = await fetch(path,{...options,headers:{'X-Admin-Password':password,'Cache-Control':'no-cache','Content-Type':'application/json',...(options.headers||{})}});
    let body={}; try{body=await response.json();}catch{}
    if(!response.ok){const error=new Error(body.error||`Request failed (${response.status}).`);error.status=response.status;error.setupRequired=body.setupRequired;throw error;}
    return body;
  }
  const get = view => api(`/.netlify/functions/business-data?view=${encodeURIComponent(view)}`);
  const action = payload => api('/.netlify/functions/business-action',{method:'POST',body:JSON.stringify(payload)});
  function toast(message){const el=$('#toast');if(!el)return;el.textContent=message;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),2600);}
  function setupError(error){
    const el=$('#businessSetupNotice'); if(!el)return;
    el.innerHTML=`<strong>Business database setup needed.</strong> ${esc(error.message)} <div style="margin-top:7px">Run <code>EWPROS-BUSINESS-SYSTEM-SCHEMA.sql</code> once in Supabase SQL Editor.</div>`;
    el.className='setup-card';
  }
  function clearSetup(){const el=$('#businessSetupNotice');if(el){el.className='alert hidden';el.textContent='';}}

  function formData(form){
    const out=Object.fromEntries(new FormData(form).entries());
    for(const box of form.querySelectorAll('input[type="checkbox"]')) out[box.name]=box.checked;
    return out;
  }
  const option = (value,label,selected='') => `<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`;
  function fillSelect(select, rows, labelFn, preserveBlank=true){
    if(!select)return;
    const current=select.value;
    const first = preserveBlank && select.querySelector('option[value=""]') ? select.querySelector('option[value=""]').outerHTML : '';
    select.innerHTML = first + rows.map(row=>option(row.id,labelFn(row),current)).join('');
  }
  function populateLookups(){
    if(!state.lookups)return;
    $$('[data-business-options="business-lines"]').forEach(s=>fillSelect(s,state.lookups.businessLines,r=>r.name,true));
    $$('[data-business-options="categories"]').forEach(s=>fillSelect(s,state.lookups.categories,r=>r.name,true));
    $$('[data-business-options="customers"]').forEach(s=>fillSelect(s,state.lookups.customers,r=>r.display_name,true));
    $$('[data-business-options="projects"]').forEach(s=>fillSelect(s,state.lookups.projects,r=>r.name,true));
    $$('[data-business-options="workers"]').forEach(s=>fillSelect(s,state.lookups.workers,r=>`${r.first_name} ${r.last_name}`,true));
    $$('[data-business-options="vendors"]').forEach(s=>fillSelect(s,state.lookups.vendors,r=>r.name,true));
    $$('[data-business-options="financial-accounts"]').forEach(s=>fillSelect(s,state.lookups.accounts,r=>`${r.name}${r.last4?` ••••${r.last4}`:''}`,true));
    fillSelect($('#bankImportAccount'),state.lookups.accounts,r=>`${r.name}${r.last4?` ••••${r.last4}`:''}`,false);
    fillSelect($('#bankImportBusinessLine'),state.lookups.businessLines,r=>r.name,true);
    fillSelect($('#reportBusinessLine'),state.lookups.businessLines,r=>r.name,true);
    fillSelect($('#timeWorker'),state.lookups.workers,r=>`${r.first_name} ${r.last_name}`,false);
    fillSelect($('#timeProject'),state.lookups.projects,r=>r.name,true);
    fillSelect($('#timeBusinessLine'),state.lookups.businessLines,r=>r.name,false);
  }
  async function loadLookups(force=false){
    if(state.lookups&&!force)return state.lookups;
    const data=await get('lookups'); state.lookups=data; clearSetup(); populateLookups(); return data;
  }
  function metric(label,value){return `<div class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;}
  function status(value){const v=String(value||'').toLowerCase();return `<span class="tag ${esc(v)}">${esc(value||'—')}</span>`;}
  function table(headers,rows,empty='No records yet.'){
    if(!rows.length)return `<div class="empty">${esc(empty)}</div>`;
    return `<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }

  async function loadDashboard(){
    const data=await get('dashboard'); state.dashboard=data;
    const m=data.metrics;
    $('#businessMetricCards').innerHTML=[metric('Income YTD',money(m.income)),metric('Expenses YTD',money(m.expenses)),metric('Net profit',money(m.netProfit)),metric('Accounts receivable',money(m.outstanding)),metric('Pending bank review',m.pendingBank),metric('Open reminders',m.openReminders)].join('');
    $('#businessLineSummary').innerHTML=table(['Business line','Income','Expenses','Net profit'],data.byLine.map(r=>`<tr><td><strong>${esc(r.name)}</strong></td><td>${money(r.income)}</td><td>${money(r.expenses)}</td><td class="${r.profit>=0?'money-positive':'money-negative'}">${money(r.profit)}</td></tr>`),'No business-line activity recorded yet.');
    $('#businessCashBalances').innerHTML=data.cashBalances.length?data.cashBalances.map(r=>`<div class="mini-list-item"><span>${esc(r.name)}</span><strong>${money(r.balance)}</strong></div>`).join(''):'<div class="empty">Add a bank account to begin.</div>';
    $('#businessRecentBank').innerHTML=table(['Date','Description','Amount','Status'],data.bankTransactions.map(r=>`<tr><td>${fmtDate(r.transaction_date)}</td><td>${esc(r.description)}</td><td class="${num(r.amount)>=0?'money-positive':'money-negative'}">${money(r.amount)}</td><td>${status(r.review_status)}</td></tr>`));
    const openInvoices=data.invoices.filter(i=>!['paid','void'].includes(i.status)&&num(i.balance_due));
    $('#businessOutstandingInvoices').innerHTML=table(['Invoice','Customer','Date','Balance'],openInvoices.map(i=>`<tr><td><strong>${esc(i.invoice_number)}</strong></td><td>${esc(i.customer||'')}</td><td>${fmtDate(i.invoice_date)}</td><td class="money-neutral">${money(i.balance_due)}</td></tr>`),'No outstanding invoices.');
    $('#businessProjectProfitability').innerHTML=table(['Project','Revenue','Cost','Profit'],data.profitability.map(p=>`<tr><td>${esc(p.project_name)}</td><td>${money(p.cash_revenue)}</td><td>${money(p.totalCost)}</td><td class="${p.profit>=0?'money-positive':'money-negative'}">${money(p.profit)}</td></tr>`),'No project-cost data yet.');
    $('#businessReminders').innerHTML=data.reminders.length?data.reminders.map(r=>`<div class="detail-item"><strong>${esc(r.title)}</strong><div class="muted-cell">${r.due_at?new Date(r.due_at).toLocaleString():'No due date'}</div></div>`).join(''):'<div class="empty">No open reminders.</div>';
    const max=Math.max(1,...data.trends.map(t=>num(t.revenue)));
    $('#businessRevenueTrend').innerHTML=data.trends.length?data.trends.map(t=>`<div class="trend-item"><div class="trend-column" style="height:${Math.max(3,(num(t.revenue)/max)*115)}px"></div><strong>${money(t.revenue)}</strong><span>${esc(t.month)}</span></div>`).join(''):'<div class="empty">Revenue trend will appear after transactions are posted.</div>';
  }

  function renderCustomerList(){
    const q=($('#crmSearch')?.value||'').toLowerCase().trim();
    const rows=(state.customers?.customers||[]).filter(c=>!q||[c.display_name,c.company_name,c.contact_name,c.phone,c.email,c.service_address].join(' ').toLowerCase().includes(q));
    const lineMap=mapBy(state.lookups?.businessLines||[]);
    $('#crmCustomerTable').innerHTML=table(['Name','Stage','Primary line','Contact','Phone / Email','Address','Source'],rows.map(c=>`<tr class="customer-row" data-customer-id="${c.id}"><td><strong>${esc(c.display_name)}</strong>${c.company_name&&c.company_name!==c.display_name?`<div class="muted-cell">${esc(c.company_name)}</div>`:''}</td><td>${status(c.customer_type)}</td><td>${esc(lineMap.get(c.primary_business_line_id)?.name||'—')}</td><td>${esc(c.contact_name||'—')}</td><td>${esc(c.phone||'—')}<div class="muted-cell">${esc(c.email||'')}</div></td><td>${esc(c.service_address||'—')}</td><td>${esc(c.source||'manual')}</td></tr>`));
    $$('.customer-row').forEach(row=>row.addEventListener('click',()=>openCustomer(row.dataset.customerId)));
  }
  async function loadCustomers(){state.customers=await get('customers');renderCustomerList();}
  async function openCustomer(id){
    const data=await api(`/.netlify/functions/business-data?view=customers&id=${encodeURIComponent(id)}`); const c=data.customer;
    const revenue=(data.transactions||[]).filter(t=>['income','customer_payment'].includes(t.transaction_type)&&!t.personal).reduce((a,t)=>a+num(t.amount),0);
    const cost=(data.transactions||[]).filter(t=>['expense','vendor_payment'].includes(t.transaction_type)&&!t.personal).reduce((a,t)=>a+num(t.amount),0);
    $('#crmDetailPanel').classList.remove('hidden');
    $('#crmDetail').innerHTML=`<div class="detail-header"><div><h2>${esc(c.display_name)}</h2><div class="detail-meta">${status(c.customer_type)}<span>${esc(c.phone||'')}</span><span>${esc(c.email||'')}</span></div><div class="muted-cell">${esc(c.service_address||'')}</div></div><div><strong>Revenue ${money(revenue)}</strong><div class="muted-cell">Recorded cost ${money(cost)} · Profit ${money(revenue-cost)}</div></div></div>
      <div class="detail-grid"><div class="detail-card"><h3>Projects</h3><div class="detail-list">${data.projects.length?data.projects.map(p=>`<div class="detail-item"><strong>${esc(p.name)}</strong><div class="muted-cell">${esc(p.businessLine||'')} · ${esc(p.status)}</div></div>`).join(''):'No projects'}</div></div>
      <div class="detail-card"><h3>Invoices</h3><div class="detail-list">${data.invoices.length?data.invoices.map(i=>`<div class="detail-item"><strong>${esc(i.invoice_number)}</strong> — ${money(i.total)}<div class="muted-cell">${esc(i.status)} · balance ${money(i.balance_due)}</div></div>`).join(''):'No invoices'}</div></div>
      <div class="detail-card"><h3>Notes</h3><div class="detail-list">${data.notes.length?data.notes.map(n=>`<div class="detail-item">${esc(n.note)}<div class="muted-cell">${new Date(n.created_at).toLocaleString()}</div></div>`).join(''):'No notes'}</div><form id="customerNoteQuick" class="quick-entry"><input name="note" placeholder="Add note…" required><button class="button secondary" type="submit">Add</button></form></div>
      <div class="detail-card"><h3>Follow-up reminders</h3><div class="detail-list">${data.reminders.length?data.reminders.map(r=>`<div class="detail-item"><strong>${esc(r.title)}</strong><div class="muted-cell">${r.due_at?new Date(r.due_at).toLocaleString():'No due date'} · ${esc(r.status)}</div>${r.status==='open'?`<button class="button micro secondary" data-complete-reminder="${r.id}">Complete</button>`:''}</div>`).join(''):'No reminders'}</div><form id="customerReminderQuick" class="business-form compact-form"><input name="title" placeholder="Follow-up" required><input name="due_at" type="datetime-local"><button class="button secondary" type="submit">Add reminder</button></form></div></div>
      <div class="detail-card" style="margin-top:18px"><h3>Transaction history</h3>${table(['Date','Type','Description','Amount'],data.transactions.map(t=>`<tr><td>${fmtDate(t.transaction_date)}</td><td>${esc(t.transaction_type)}</td><td>${esc(t.description||'')}</td><td>${money(t.amount)}</td></tr>`),'No transactions')}</div>`;
    $('#customerNoteQuick').addEventListener('submit',async e=>{e.preventDefault();const d=formData(e.currentTarget);await action({action:'add_customer_note',customer_id:id,note:d.note});toast('Note added');openCustomer(id);});
    $('#customerReminderQuick').addEventListener('submit',async e=>{e.preventDefault();const d=formData(e.currentTarget);await action({action:'add_reminder',customer_id:id,title:d.title,due_at:d.due_at||null});toast('Reminder added');openCustomer(id);});
    $$('[data-complete-reminder]').forEach(b=>b.addEventListener('click',async()=>{await action({action:'complete_reminder',id:b.dataset.completeReminder});toast('Reminder completed');openCustomer(id);}));
    $('#crmDetailPanel').scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function loadProjects(){
    state.projects=await get('projects');
    const q=($('#projectSearch')?.value||'').toLowerCase().trim(); const rows=state.projects.projects.filter(p=>!q||[p.name,p.project_number,p.customer,p.businessLine,p.status].join(' ').toLowerCase().includes(q));
    $('#projectTable').innerHTML=table(['Project','Customer','Business line','Status','Revenue','Direct cost','Labor','Profit'],rows.map(p=>`<tr><td><strong>${esc(p.name)}</strong><div class="muted-cell">${esc(p.project_number||'')}</div></td><td>${esc(p.customer||'—')}</td><td>${esc(p.businessLine)}</td><td>${status(p.status)}</td><td>${money(p.revenue)}</td><td>${money(p.directExpense)}</td><td>${money(p.laborCost)}</td><td class="${p.profit>=0?'money-positive':'money-negative'}">${money(p.profit)}</td></tr>`));
  }

  function mapBy(rows,key='id'){return new Map((rows||[]).map(r=>[r[key],r]));}
  function renderBanking(){
    const d=state.banking;if(!d)return;
    const cat=mapBy(d.categories), lines=mapBy(d.businessLines), customers=mapBy(d.customers), projects=mapBy(d.projects), accounts=mapBy(d.accounts);
    $('#bankAccountList').innerHTML=d.accounts.length?d.accounts.map(a=>`<div class="mini-list-item"><span><strong>${esc(a.name)}</strong><small>${esc(a.institution||'')} ${a.last4?`••••${esc(a.last4)}`:''}</small></span><span>${esc(a.account_type)}</span></div>`).join(''):'<div class="empty">No accounts yet.</div>';
    const filter=$('#bankReviewFilter')?.value||'pending'; const txs=d.transactions.filter(t=>filter==='all'||t.review_status===filter);
    $('#bankTransactionTable').innerHTML=table(['Date','Description','Amount','Category','Business line','Customer','Project','Counter account','Rule','Actions'],txs.map(t=>`<tr class="bank-review-row ${esc(t.review_status)}" data-bank-row="${t.id}"><td>${fmtDate(t.transaction_date)}</td><td><strong>${esc(t.description)}</strong><div class="muted-cell">${esc(accounts.get(t.financial_account_id)?.name||'')}</div></td><td class="${num(t.amount)>=0?'money-positive':'money-negative'}">${money(t.amount)}</td><td><select class="inline-select" data-bank-field="category_id"><option value="">Choose…</option>${d.categories.map(r=>option(r.id,r.name,t.category_id)).join('')}</select></td><td><select class="inline-select" data-bank-field="business_line_id"><option value="">Choose…</option>${d.businessLines.map(r=>option(r.id,r.name,t.business_line_id)).join('')}</select></td><td><select class="inline-select" data-bank-field="customer_id"><option value="">—</option>${d.customers.map(r=>option(r.id,r.display_name,t.customer_id)).join('')}</select></td><td><select class="inline-select" data-bank-field="project_id"><option value="">—</option>${d.projects.map(r=>option(r.id,r.name,t.project_id)).join('')}</select></td><td><select class="inline-select" data-bank-field="counter_financial_account_id"><option value="">—</option>${d.accounts.filter(a=>a.id!==t.financial_account_id).map(r=>option(r.id,r.name,'')).join('')}</select></td><td>${t.matched_rule_id?'<span class="tag update">Matched</span>':'—'}</td><td><div class="inline-actions">${t.review_status==='pending'?`<button class="button micro success" data-bank-post="${t.id}">Post</button><button class="button micro warn" data-bank-ignore="${t.id}">Ignore</button>`:'<span class="audit-trail">'+esc(t.review_status)+'</span>'}</div></td></tr>`),'No transactions in this filter.');
    $$('[data-bank-post]').forEach(b=>b.addEventListener('click',()=>postBankRow(b.dataset.bankPost,'posted'))); $$('[data-bank-ignore]').forEach(b=>b.addEventListener('click',()=>postBankRow(b.dataset.bankIgnore,'ignored')));
    $('#ruleTable').innerHTML=table(['Priority','Rule','Keywords','Category','Business line','Status','Actions'],d.rules.map(r=>`<tr class="${r.active?'':'rule-disabled'}"><td>${r.priority}</td><td><strong>${esc(r.name)}</strong></td><td>${esc((r.keywords||[]).join(', '))}</td><td>${esc(cat.get(r.category_id)?.name||'—')}</td><td>${esc(lines.get(r.business_line_id)?.name||'—')}</td><td>${r.active?'Enabled':'Disabled'}</td><td><div class="inline-actions"><button class="button micro secondary" data-edit-rule="${r.id}">Edit</button><button class="button micro ${r.active?'warn':'success'}" data-toggle-rule="${r.id}" data-rule-active="${r.active?'0':'1'}">${r.active?'Disable':'Enable'}</button></div></td></tr>`));
    $$('[data-toggle-rule]').forEach(b=>b.addEventListener('click',async()=>{await action({action:'toggle_rule',id:b.dataset.toggleRule,active:b.dataset.ruleActive==='1'});toast('Rule updated');await loadBanking();}));
    $$('[data-edit-rule]').forEach(b=>b.addEventListener('click',()=>editRule(b.dataset.editRule)));
    $('#bankBatchTable').innerHTML=table(['Imported','File','Rows','Imported','Duplicates','Status'],d.batches.map(b=>`<tr><td>${new Date(b.created_at).toLocaleString()}</td><td><strong>${esc(b.filename)}</strong><div class="muted-cell">${esc(b.file_type)}</div></td><td>${b.total_rows}</td><td>${b.imported_rows}</td><td>${b.duplicate_rows}</td><td>${status(b.status)}</td></tr>`),'No statement imports yet.');
  }
  async function loadBanking(){state.banking=await get('banking');renderBanking();}
  function bankRowPayload(id,statusValue){
    const row=$(`[data-bank-row="${id}"]`); const p={action:'review_bank_transaction',id,status:statusValue};
    row?.querySelectorAll('[data-bank-field]').forEach(el=>p[el.dataset.bankField]=el.value||null); return p;
  }
  async function postBankRow(id,statusValue){try{await action(bankRowPayload(id,statusValue));toast(statusValue==='posted'?'Transaction posted':'Transaction ignored');await loadBanking();state.dashboard=null;}catch(e){alert(e.message);}}
  function editRule(id){
    const r=state.banking.rules.find(x=>x.id===id); if(!r)return; const f=$('#ruleForm');state.editingRuleId=id;
    for(const [k,v] of Object.entries({name:r.name,keywords:(r.keywords||[]).join(', '),match_mode:r.match_mode,category_id:r.category_id||'',business_line_id:r.business_line_id||'',priority:r.priority}))if(f.elements[k])f.elements[k].value=v;
    f.querySelector('button[type="submit"]').textContent='Save rule'; f.scrollIntoView({behavior:'smooth',block:'center'});
  }

  async function loadAccounting(){
    state.accounting=await get('accounting'); state.lookups={businessLines:state.accounting.businessLines,categories:state.accounting.categories,accounts:state.accounting.accounts,customers:state.accounting.customers,projects:state.accounting.projects,workers:state.accounting.workers,vendors:state.accounting.vendors};populateLookups();
    const cats=mapBy(state.accounting.categories), lines=mapBy(state.accounting.businessLines), accts=mapBy(state.accounting.accounts);
    const openInvoices=(state.accounting.invoices||[]).filter(i=>!['paid','void'].includes(i.status)&&num(i.balance_due)>0);
    fillSelect($('#paymentInvoice'),openInvoices,i=>`${i.invoice_number} — ${money(i.balance_due)} due`,false);
    fillSelect($('#paymentAccount'),state.accounting.accounts,a=>`${a.name}${a.last4?` ••••${a.last4}`:''}`,false);
    $('#accountingTransactions').innerHTML=table(['Date','Type','Description','Category','Business line','Account','Amount'],state.accounting.transactions.map(t=>`<tr><td>${fmtDate(t.transaction_date)}</td><td>${esc(t.transaction_type)}</td><td>${esc(t.description||'')}</td><td>${esc(cats.get(t.category_id)?.name||'')}</td><td>${esc(lines.get(t.business_line_id)?.name||'—')}</td><td>${esc(accts.get(t.financial_account_id)?.name||'')}</td><td>${money(t.amount)}${t.personal?' <span class="tag archive">personal/equity</span>':''}</td></tr>`));
    $('#accountingInvoices').innerHTML=table(['Invoice','Date','Status','Total','Paid','Balance'],(state.accounting.invoices||[]).map(i=>`<tr><td><strong>${esc(i.invoice_number)}</strong></td><td>${fmtDate(i.invoice_date)}</td><td>${status(i.status)}</td><td>${money(i.total)}</td><td>${money(i.amount_paid)}</td><td>${money(i.balance_due)}</td></tr>`),'No synchronized invoices yet.');
  }

  async function loadTeam(){
    state.team=await get('team'); fillSelect($('#timeWorker'),state.team.workers,r=>`${r.first_name} ${r.last_name}`,false);fillSelect($('#timeProject'),state.team.projects,r=>r.name,true);fillSelect($('#timeBusinessLine'),state.team.businessLines,r=>r.name,false);
    fillSelect($('#workerPaymentWorker'),state.team.workers,r=>`${r.first_name} ${r.last_name}`,false);fillSelect($('#workerPaymentProject'),state.team.projects,r=>r.name,true);fillSelect($('#workerPaymentLine'),state.team.businessLines,r=>r.name,true);fillSelect($('#workerPaymentAccount'),state.team.accounts||[],r=>r.name,true);
    const workers=mapBy(state.team.workers), projects=mapBy(state.team.projects), lines=mapBy(state.team.businessLines), accounts=mapBy(state.team.accounts||[]);
    $('#workerTable').innerHTML=table(['Worker','Class','Pay type','Rate','Contact'],state.team.workers.map(w=>`<tr><td><strong>${esc(w.first_name)} ${esc(w.last_name)}</strong></td><td>${esc(w.worker_type)}</td><td>${esc(w.pay_type)}</td><td>${money(w.pay_rate)}</td><td>${esc(w.email||w.phone||'—')}</td></tr>`));
    $('#timeEntryTable').innerHTML=table(['Date','Worker','Project','Business line','Regular','OT','Labor cost','Status','Action'],state.team.timeEntries.map(t=>{const w=workers.get(t.worker_id)||{};const cost=num(t.regular_hours)*num(w.pay_rate)+num(t.overtime_hours)*num(w.overtime_rate||num(w.pay_rate)*1.5);return `<tr><td>${fmtDate(t.work_date)}</td><td>${esc(`${w.first_name||''} ${w.last_name||''}`.trim())}</td><td>${esc(projects.get(t.project_id)?.name||'—')}</td><td>${esc(lines.get(t.business_line_id)?.name||'')}</td><td>${t.regular_hours}</td><td>${t.overtime_hours}</td><td>${money(cost)}</td><td>${status(t.approval_status)}</td><td>${t.approval_status==='submitted'?`<button class="button micro success" data-approve-time="${t.id}">Approve</button>`:'—'}</td></tr>`;}));
    $$('[data-approve-time]').forEach(b=>b.addEventListener('click',async()=>{await action({action:'update_time_status',id:b.dataset.approveTime,status:'approved'});toast('Timesheet approved');loadTeam();}));
    $('#workerPaymentTable').innerHTML=table(['Date','Worker','Project','Business line','Account','Type','Amount','Reference'],(state.team.workerPayments||[]).map(p=>{const w=workers.get(p.worker_id)||{};return `<tr><td>${fmtDate(p.payment_date)}</td><td>${esc(`${w.first_name||''} ${w.last_name||''}`.trim())}</td><td>${esc(projects.get(p.project_id)?.name||'—')}</td><td>${esc(lines.get(p.business_line_id)?.name||'—')}</td><td>${esc(accounts.get(p.financial_account_id)?.name||'—')}</td><td>${esc(p.payment_type)}</td><td>${money(p.amount)}</td><td>${esc(p.reference||'')}</td></tr>`;}),'No worker payments recorded yet.');
  }

  async function loadMileage(){
    state.mileage=await get('mileage'); const workers=mapBy(state.mileage.workers), projects=mapBy(state.mileage.projects), lines=mapBy(state.mileage.businessLines);
    const total=state.mileage.trips.reduce((a,t)=>a+num(t.miles),0); const reimbursement=state.mileage.trips.reduce((a,t)=>a+num(t.miles)*num(t.reimbursement_rate),0);
    $('#mileageSummary').innerHTML=[metric('Trips',state.mileage.trips.length),metric('Total miles',total.toFixed(1)),metric('Reimbursement value',money(reimbursement))].join('');
    $('#mileageTable').innerHTML=table(['Date','Worker','Route','Project','Business line','Miles','Purpose','Reimbursement'],state.mileage.trips.map(t=>`<tr><td>${fmtDate(t.trip_date)}</td><td>${esc(workers.get(t.worker_id)?`${workers.get(t.worker_id).first_name} ${workers.get(t.worker_id).last_name}`:'Owner / unassigned')}</td><td><strong>${esc(t.origin)}</strong> → ${esc(t.destination)}</td><td>${esc(projects.get(t.project_id)?.name||'—')}</td><td>${esc(lines.get(t.business_line_id)?.name||'')}</td><td>${num(t.miles).toFixed(1)}</td><td>${esc(t.purpose||'')}</td><td>${t.reimbursable?money(num(t.miles)*num(t.reimbursement_rate)):'—'}</td></tr>`));
  }

  function reportAccountTable(rows,type){
    const filtered=rows.filter(r=>r.accountType===type); return filtered.map(r=>`<tr><td>${esc(r.code)} · ${esc(r.name)}</td><td style="text-align:right">${money(r.amount)}</td></tr>`).join('');
  }
  async function loadReports(params={}){
    const start=params.start||$('#reportStart')?.value; const end=params.end||$('#reportEnd')?.value; const line=params.business_line_id??$('#reportBusinessLine')?.value??'';
    const qs=new URLSearchParams({view:'reports'});if(start)qs.set('start',start);if(end)qs.set('end',end);if(line)qs.set('business_line_id',line);
    const d=await api(`/.netlify/functions/business-data?${qs}`);state.reports=d;
    $('#reportMetrics').innerHTML=[metric('Income',money(d.summary.income)),metric('Expenses',money(d.summary.expenses)),metric('Net profit',money(d.summary.netProfit)),metric('Cash change',money(d.cashFlow.netChange))].join('');
    $('#pnlPeriod').textContent=`${fmtDate(d.start)} through ${fmtDate(d.end)}`;
    const incomeRows=reportAccountTable(d.pnl,'income'),expenseRows=reportAccountTable(d.pnl,'expense');
    $('#pnlTable').innerHTML=`<table><tbody><tr class="report-subtotal"><td colspan="2">Income</td></tr>${incomeRows||'<tr><td>No income posted</td><td></td></tr>'}<tr class="report-total"><td>Total income</td><td style="text-align:right">${money(d.summary.income)}</td></tr><tr class="report-subtotal"><td colspan="2">Expenses</td></tr>${expenseRows||'<tr><td>No expenses posted</td><td></td></tr>'}<tr class="report-total"><td>Total expenses</td><td style="text-align:right">${money(d.summary.expenses)}</td></tr><tr class="report-total"><td>Net profit</td><td style="text-align:right">${money(d.summary.netProfit)}</td></tr></tbody></table>`;
    $('#cashFlowTable').innerHTML=`<div class="cash-flow-cards"><div class="cash-flow-row"><span>Operating activities</span><strong>${money(d.cashFlow.operating)}</strong></div><div class="cash-flow-row"><span>Investing activities</span><strong>${money(d.cashFlow.investing)}</strong></div><div class="cash-flow-row"><span>Financing activities</span><strong>${money(d.cashFlow.financing)}</strong></div><div class="cash-flow-row total"><span>Net change in cash</span><strong>${money(d.cashFlow.netChange)}</strong></div></div>`;
    $('#balanceSheetTable').innerHTML=table(['Account','Type','Balance'],d.balanceSheet.map(r=>`<tr><td>${esc(r.code)} · <strong>${esc(r.name)}</strong></td><td>${esc(r.accountType)}</td><td>${money(r.amount)}</td></tr>`),'No balance-sheet activity yet.');
    $('#reportBusinessLines').innerHTML=table(['Business line','Revenue','Expense','Profit'],d.byLine.map(r=>`<tr><td>${esc(r.name)}</td><td>${money(r.revenue)}</td><td>${money(r.expense)}</td><td class="${r.profit>=0?'money-positive':'money-negative'}">${money(r.profit)}</td></tr>`));
    $('#reportProjectProfitability').innerHTML=table(['Project','Revenue','Direct expense','Labor','Profit'],(d.projectProfitability||[]).map(p=>{const profit=num(p.cash_revenue)-num(p.direct_expense)-num(p.labor_cost);return `<tr><td>${esc(p.project_name)}</td><td>${money(p.cash_revenue)}</td><td>${money(p.direct_expense)}</td><td>${money(p.labor_cost)}</td><td>${money(profit)}</td></tr>`;}));
    $('#reportCustomerRevenue').innerHTML=table(['Customer','Revenue','Direct expense','Labor','Profit'],(d.customerProfitability||[]).map(r=>`<tr><td>${esc(r.name)}</td><td>${money(r.revenue)}</td><td>${money(r.directExpense)}</td><td>${money(r.laborCost)}</td><td class="${r.profit>=0?'money-positive':'money-negative'}">${money(r.profit)}</td></tr>`),'No customer profitability activity in this period.');
    $('#reportVendorSpending').innerHTML=table(['Vendor','Spending'],(d.vendorSpending||[]).map(r=>`<tr><td>${esc(r.name)}</td><td>${money(r.amount)}</td></tr>`),'No vendor spending in this period.');
    $('#reportExpenseCategories').innerHTML=table(['Expense category','Amount'],(d.expenseByCategory||[]).map(r=>`<tr><td>${esc(r.name)}</td><td>${money(r.amount)}</td></tr>`),'No categorized expenses in this period.');
    $('#reportIncomeStreams').innerHTML=table(['Income stream','Amount'],(d.revenueByIncomeStream||[]).map(r=>`<tr><td>${esc(r.name)}</td><td>${money(r.amount)}</td></tr>`),'No categorized revenue in this period.');
    $('#reportMonthly').innerHTML=table(['Month','Revenue','Expense','Net'],(d.monthly||[]).map(r=>`<tr><td>${esc(r.month)}</td><td>${money(r.revenue)}</td><td>${money(r.expense)}</td><td>${money(r.profit)}</td></tr>`),'No monthly activity in this period.');
    $('#reportYearly').innerHTML=table(['Year','Revenue','Expense','Net'],(d.yearly||[]).map(r=>`<tr><td>${esc(r.month)}</td><td>${money(r.revenue)}</td><td>${money(r.expense)}</td><td>${money(r.profit)}</td></tr>`),'No yearly activity in this period.');
  }

  async function activate(view){
    if(!['business-dashboard','crm','projects','banking','accounting','team','mileage','reports'].includes(view))return;
    try{
      await loadLookups();
      if(view==='business-dashboard')await loadDashboard();
      else if(view==='crm')await loadCustomers();
      else if(view==='projects')await loadProjects();
      else if(view==='banking')await loadBanking();
      else if(view==='accounting')await loadAccounting();
      else if(view==='team')await loadTeam();
      else if(view==='mileage')await loadMileage();
      else if(view==='reports')await loadReports();
    }catch(error){console.error(error);setupError(error);}
  }

  // Static navigation shortcuts on business dashboard.
  $$('[data-open-business-view]').forEach(b=>b.addEventListener('click',()=>document.querySelector(`.nav-item[data-view="${b.dataset.openBusinessView}"]`)?.click()));
  $('#crmSearch')?.addEventListener('input',renderCustomerList); $('#projectSearch')?.addEventListener('input',()=>loadProjects()); $('#bankReviewFilter')?.addEventListener('change',renderBanking);

  $('#customerForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'create_customer',...formData(e.currentTarget)});e.currentTarget.reset();toast('Customer saved');await loadLookups(true);await loadCustomers();}catch(err){alert(err.message);}});
  $('#projectForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'create_project',...formData(e.currentTarget)});e.currentTarget.reset();toast('Project created');await loadLookups(true);await loadProjects();}catch(err){alert(err.message);}});
  $('#bankAccountForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'create_account',...formData(e.currentTarget)});e.currentTarget.reset();toast('Account added');await loadLookups(true);await loadBanking();}catch(err){alert(err.message);}});
  $('#ruleForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const d=formData(e.currentTarget);if(state.editingRuleId){await action({action:'update_rule',id:state.editingRuleId,patch:d});state.editingRuleId=null;e.currentTarget.querySelector('button[type="submit"]').textContent='Add rule';toast('Rule saved');}else{await action({action:'create_rule',...d});toast('Rule added');}e.currentTarget.reset();await loadBanking();}catch(err){alert(err.message);}});
  $('#transactionForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'record_transaction',...formData(e.currentTarget)});e.currentTarget.reset();e.currentTarget.elements.transaction_date.value=new Date().toISOString().slice(0,10);toast('Transaction posted');await loadAccounting();}catch(err){alert(err.message);}});
  $('#vendorForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'create_vendor',...formData(e.currentTarget)});e.currentTarget.reset();toast('Vendor added');await loadLookups(true);await loadAccounting();}catch(err){alert(err.message);}});
  $('#invoicePaymentForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'record_invoice_payment',...formData(e.currentTarget)});e.currentTarget.reset();e.currentTarget.elements.payment_date.value=new Date().toISOString().slice(0,10);toast('Invoice payment recorded');await loadAccounting();}catch(err){alert(err.message);}});
  $('#workerForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'create_worker',...formData(e.currentTarget)});e.currentTarget.reset();toast('Worker added');await loadLookups(true);await loadTeam();}catch(err){alert(err.message);}});
  $('#timeEntryForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'add_time_entry',...formData(e.currentTarget)});e.currentTarget.reset();e.currentTarget.elements.work_date.value=new Date().toISOString().slice(0,10);toast('Timesheet submitted');await loadTeam();}catch(err){alert(err.message);}});
  $('#workerPaymentForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'add_worker_payment',...formData(e.currentTarget)});e.currentTarget.reset();e.currentTarget.elements.payment_date.value=new Date().toISOString().slice(0,10);toast('Worker payment recorded');await loadTeam();}catch(err){alert(err.message);}});
  $('#mileageForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await action({action:'add_mileage',...formData(e.currentTarget)});e.currentTarget.reset();e.currentTarget.elements.trip_date.value=new Date().toISOString().slice(0,10);toast('Mileage saved');await loadMileage();}catch(err){alert(err.message);}});
  $('#reportFilterForm')?.addEventListener('submit',e=>{e.preventDefault();loadReports(formData(e.currentTarget)).catch(err=>alert(err.message));});

  $('#bankImportForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=$('#bankStatementFile').files?.[0];if(!f)return alert('Choose a CSV, OFX, or QFX file.');try{const text=await f.text();const d=formData(e.currentTarget);state.bankFile={file_text:text,filename:f.name,format:f.name.split('.').pop(),financial_account_id:d.financial_account_id,default_business_line_id:d.default_business_line_id||null};const result=await api('/.netlify/functions/bank-import',{method:'POST',body:JSON.stringify({mode:'preview',...state.bankFile})});state.bankPreview=result;$('#bankImportPreview').innerHTML=`<div class="bank-preview-summary"><span class="preview-pill">${result.summary.total} rows</span><span class="preview-pill">${result.summary.newRows} new</span><span class="preview-pill">${result.summary.duplicates} duplicates ignored</span><span class="preview-pill">${result.summary.rulesMatched} rule matches</span></div>${table(['Date','Description','Amount','Rule','Duplicate'],result.rows.slice(0,25).map(r=>`<tr><td>${fmtDate(r.transaction_date)}</td><td>${esc(r.description)}</td><td>${money(r.amount)}</td><td>${esc(r.matched_rule_name||'—')}</td><td>${r.duplicate?'Yes':'No'}</td></tr>`))}${result.rows.length>25?'<div class="muted-cell">Showing first 25 rows.</div>':''}`;$('#confirmBankImport').disabled=result.summary.newRows===0;toast('Statement preview ready');}catch(err){alert(err.message);}});
  $('#confirmBankImport')?.addEventListener('click',async()=>{if(!state.bankFile)return;try{const result=await api('/.netlify/functions/bank-import',{method:'POST',body:JSON.stringify({mode:'confirm',...state.bankFile})});toast(`${result.summary.imported} transaction(s) imported`);state.bankFile=null;state.bankPreview=null;$('#confirmBankImport').disabled=true;$('#bankImportPreview').innerHTML='';$('#bankImportForm').reset();await loadBanking();}catch(err){alert(err.message);}});

  $('#exportMileageCsv')?.addEventListener('click',()=>{if(!state.mileage)return;const headers=['Date','Worker','Business Line','Customer','Project','Origin','Destination','Miles','Purpose','Reimbursable','Rate'];const workers=mapBy(state.mileage.workers),lines=mapBy(state.mileage.businessLines),customers=mapBy(state.mileage.customers),projects=mapBy(state.mileage.projects);const q=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[headers.join(','),...state.mileage.trips.map(t=>[t.trip_date,workers.get(t.worker_id)?`${workers.get(t.worker_id).first_name} ${workers.get(t.worker_id).last_name}`:'',lines.get(t.business_line_id)?.name||'',customers.get(t.customer_id)?.display_name||'',projects.get(t.project_id)?.name||'',t.origin,t.destination,t.miles,t.purpose,t.reimbursable,t.reimbursement_rate].map(q).join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='EWPros_Mileage_Report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});

  // Smart defaults.
  const today=new Date().toISOString().slice(0,10);if($('#transactionForm')?.elements.transaction_date)$('#transactionForm').elements.transaction_date.value=today;if($('#invoicePaymentForm')?.elements.payment_date)$('#invoicePaymentForm').elements.payment_date.value=today;if($('#timeEntryForm')?.elements.work_date)$('#timeEntryForm').elements.work_date.value=today;if($('#workerPaymentForm')?.elements.payment_date)$('#workerPaymentForm').elements.payment_date.value=today;if($('#mileageForm')?.elements.trip_date)$('#mileageForm').elements.trip_date.value=today;
  const yearStart=`${today.slice(0,4)}-01-01`;if($('#reportStart'))$('#reportStart').value=yearStart;if($('#reportEnd'))$('#reportEnd').value=today;

  window.EWPROS_BUSINESS={activate,refresh:()=>loadLookups(true).then(()=>activate(document.querySelector('.nav-item.active')?.dataset.view||'business-dashboard'))};
  if(!$('#dashboard')?.classList.contains('hidden')) setTimeout(()=>activate('business-dashboard'),0);
})();
