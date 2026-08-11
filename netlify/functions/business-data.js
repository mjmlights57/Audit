const { json, fetchAll } = require('./_supabase');
const { requireAdmin, isMissingBusinessSchema, money } = require('./_business-core');

const monthKey = value => String(value || '').slice(0, 7);
const sum = (rows, selector) => rows.reduce((total, row) => total + money(selector(row)), 0);

async function baseLookups(supabase) {
  const [businessLines, categories, accounts, customers, projects, workers, vendors] = await Promise.all([
    fetchAll(supabase, 'business_lines', 'id,code,name,active', q => q.eq('active', true).order('name')),
    fetchAll(supabase, 'transaction_categories', 'id,name,behavior,ledger_account_id,active', q => q.eq('active', true).order('name')),
    fetchAll(supabase, 'financial_accounts', 'id,name,institution,account_type,last4,ledger_account_id,opening_balance,opening_balance_date,active', q => q.eq('active', true).order('name')),
    fetchAll(supabase, 'customers', 'id,customer_type,primary_business_line_id,display_name,company_name,contact_name,phone,email,service_address,city,state_code,zipcode,tags,source,active,updated_at', q => q.eq('active', true).order('display_name')),
    fetchAll(supabase, 'projects', 'id,customer_id,business_line_id,project_number,name,project_type,status,start_date,end_date,service_address,quoted_amount,external_key,legacy_appointment_id,updated_at', q => q.neq('status', 'archived').order('updated_at', { ascending: false })),
    fetchAll(supabase, 'workers', 'id,worker_type,first_name,last_name,email,phone,pay_type,pay_rate,overtime_rate,active', q => q.eq('active', true).order('last_name')),
    fetchAll(supabase, 'vendors', 'id,name,phone,email,active', q => q.eq('active', true).order('name'))
  ]);
  return { businessLines, categories, accounts, customers, projects, workers, vendors };
}

function joinCustomer(rows, customers) {
  const map = new Map(customers.map(item => [item.id, item]));
  return rows.map(row => ({ ...row, customer: map.get(row.customer_id)?.display_name || '' }));
}
function joinBusinessLine(rows, lines) {
  const map = new Map(lines.map(item => [item.id, item]));
  return rows.map(row => ({ ...row, businessLine: map.get(row.business_line_id)?.name || '' }));
}

async function dashboard(supabase, lookups) {
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const today = now.toISOString().slice(0, 10);
  const [transactions, invoices, allBankTransactions, reminders, profitability] = await Promise.all([
    fetchAll(supabase, 'financial_transactions', 'id,transaction_date,transaction_type,amount,description,business_line_id,project_id,customer_id,financial_account_id,personal,voided_at', q => q.is('voided_at', null).order('transaction_date', { ascending: false })),
    fetchAll(supabase, 'invoices', 'id,invoice_number,customer_id,project_id,business_line_id,invoice_date,due_date,status,total,amount_paid,balance_due', q => q.neq('status', 'void').order('invoice_date', { ascending: false })),
    fetchAll(supabase, 'bank_transactions', 'id,transaction_date,description,amount,review_status,financial_account_id,category_id,business_line_id', q => q.order('transaction_date', { ascending: false })),
    fetchAll(supabase, 'reminders', 'id,customer_id,project_id,title,details,due_at,status', q => q.eq('status', 'open').order('due_at', { ascending: true, nullsFirst: false }).limit(20)),
    fetchAll(supabase, 'v_project_profitability', 'project_id,project_name,customer_id,business_line_id,cash_revenue,direct_expense,labor_cost', q => q.order('project_name'))
  ]);
  const bankTransactions = allBankTransactions.slice(0, 15);

  const business = transactions.filter(t => !t.personal && t.transaction_date >= yearStart);
  const income = sum(business.filter(t => ['income','customer_payment'].includes(t.transaction_type)), t => t.amount);
  const expenses = sum(business.filter(t => ['expense','vendor_payment'].includes(t.transaction_type)), t => t.amount);
  const outstanding = sum(invoices.filter(i => !['paid','void'].includes(i.status)), i => i.balance_due);
  const pendingBank = allBankTransactions.filter(t => t.review_status === 'pending').length;

  const byLine = lookups.businessLines.map(line => {
    const rows = business.filter(t => t.business_line_id === line.id);
    const lineIncome = sum(rows.filter(t => ['income','customer_payment'].includes(t.transaction_type)), t => t.amount);
    const lineExpense = sum(rows.filter(t => ['expense','vendor_payment'].includes(t.transaction_type)), t => t.amount);
    return { id: line.id, name: line.name, income: lineIncome, expenses: lineExpense, profit: lineIncome - lineExpense };
  });

  const trendMap = new Map();
  for (const t of business.filter(t => ['income','customer_payment'].includes(t.transaction_type))) {
    const key = monthKey(t.transaction_date);
    trendMap.set(key, (trendMap.get(key) || 0) + money(t.amount));
  }
  const trends = [...trendMap.entries()].sort(([a],[b]) => a.localeCompare(b)).slice(-12).map(([month, revenue]) => ({ month, revenue }));

  const cashAccounts = lookups.accounts.filter(account => account.account_type !== 'credit_card' && account.ledger_account_id);
  let cashLedgerLines = [];
  if (cashAccounts.length) {
    const { data: ledgerRows, error: ledgerError } = await supabase.from('journal_lines').select('ledger_account_id,debit,credit').in('ledger_account_id', cashAccounts.map(a => a.ledger_account_id));
    if (ledgerError) throw ledgerError;
    cashLedgerLines = ledgerRows || [];
  }
  const cashBalances = cashAccounts.map(account => {
    const rows = cashLedgerLines.filter(line => line.ledger_account_id === account.ledger_account_id);
    return { id: account.id, name: account.name, balance: sum(rows, line => money(line.debit) - money(line.credit)) };
  });

  return {
    metrics: { income, expenses, netProfit: income - expenses, outstanding, pendingBank, openReminders: reminders.length },
    byLine, trends, bankTransactions, invoices: joinCustomer(invoices.slice(0, 20), lookups.customers), reminders,
    profitability: profitability.map(p => ({ ...p, totalCost: money(p.direct_expense) + money(p.labor_cost), profit: money(p.cash_revenue) - money(p.direct_expense) - money(p.labor_cost) })).sort((a,b) => b.profit - a.profit).slice(0, 12),
    cashBalances, today
  };
}

async function customersView(supabase, lookups, customerId) {
  if (!customerId) return { customers: lookups.customers };
  const customer = lookups.customers.find(c => c.id === customerId);
  if (!customer) throw new Error('Customer not found.');
  const [projects, invoices, transactions, notes, reminders] = await Promise.all([
    fetchAll(supabase, 'projects', '*', q => q.eq('customer_id', customerId).order('updated_at', { ascending: false })),
    fetchAll(supabase, 'invoices', '*', q => q.eq('customer_id', customerId).order('invoice_date', { ascending: false })),
    fetchAll(supabase, 'financial_transactions', '*', q => q.eq('customer_id', customerId).is('voided_at', null).order('transaction_date', { ascending: false })),
    fetchAll(supabase, 'customer_notes', '*', q => q.eq('customer_id', customerId).order('created_at', { ascending: false })),
    fetchAll(supabase, 'reminders', '*', q => q.eq('customer_id', customerId).order('due_at', { ascending: true, nullsFirst: false }))
  ]);
  return { customer, projects: joinBusinessLine(projects, lookups.businessLines), invoices, transactions, notes, reminders };
}

async function projectsView(supabase, lookups) {
  const profitability = await fetchAll(supabase, 'v_project_profitability', '*', q => q.order('project_name'));
  const profitabilityMap = new Map(profitability.map(p => [p.project_id, p]));
  const customerMap = new Map(lookups.customers.map(c => [c.id, c.display_name]));
  const lineMap = new Map(lookups.businessLines.map(l => [l.id, l.name]));
  return {
    projects: lookups.projects.map(project => {
      const p = profitabilityMap.get(project.id) || {};
      const revenue = money(p.cash_revenue), directExpense = money(p.direct_expense), laborCost = money(p.labor_cost);
      return { ...project, customer: customerMap.get(project.customer_id) || '', businessLine: lineMap.get(project.business_line_id) || '', revenue, directExpense, laborCost, totalCost: directExpense + laborCost, profit: revenue - directExpense - laborCost };
    })
  };
}

async function bankingView(supabase, lookups) {
  const [transactions, rules, batches, allCategories] = await Promise.all([
    fetchAll(supabase, 'bank_transactions', '*', q => q.order('transaction_date', { ascending: false }).limit(300)),
    fetchAll(supabase, 'transaction_rules', '*', q => q.order('priority', { ascending: true })),
    fetchAll(supabase, 'bank_import_batches', '*', q => q.order('created_at', { ascending: false }).limit(50)),
    fetchAll(supabase, 'transaction_categories', 'id,name,behavior,active', q => q.order('name'))
  ]);
  return { accounts: lookups.accounts, categories: lookups.categories, allCategories, businessLines: lookups.businessLines, customers: lookups.customers, projects: lookups.projects, transactions, rules, batches };
}

async function accountingView(supabase, lookups) {
  const [transactions, invoices, payments, allCategories] = await Promise.all([
    fetchAll(supabase, 'financial_transactions', '*', q => q.is('voided_at', null).order('transaction_date', { ascending: false }).limit(400)),
    fetchAll(supabase, 'invoices', '*', q => q.neq('status','void').order('invoice_date', { ascending: false }).limit(300)),
    fetchAll(supabase, 'payments', '*', q => q.order('payment_date', { ascending: false }).limit(300)),
    fetchAll(supabase, 'transaction_categories', 'id,name,behavior,ledger_account_id,active,created_at', q => q.order('name'))
  ]);
  return { ...lookups, transactions, invoices, payments, allCategories };
}

async function teamView(supabase, lookups) {
  const [timeEntries, workerPayments] = await Promise.all([
    fetchAll(supabase, 'time_entries', '*', q => q.order('work_date', { ascending: false }).limit(500)),
    fetchAll(supabase, 'worker_payments', '*', q => q.order('payment_date', { ascending: false }).limit(500))
  ]);
  return { workers: lookups.workers, projects: lookups.projects, businessLines: lookups.businessLines, accounts: lookups.accounts, timeEntries, workerPayments };
}

async function mileageView(supabase, lookups) {
  const trips = await fetchAll(supabase, 'mileage_trips', '*', q => q.order('trip_date', { ascending: false }).limit(500));
  return { trips, workers: lookups.workers, customers: lookups.customers, projects: lookups.projects, businessLines: lookups.businessLines };
}

async function reportsView(supabase, lookups, params) {
  const end = params.get('end') || new Date().toISOString().slice(0,10);
  const start = params.get('start') || `${end.slice(0,4)}-01-01`;
  const businessLineId = params.get('business_line_id') || '';

  const entries = await fetchAll(supabase, 'journal_entries', 'id,entry_date,status', q => q.eq('status','posted').lte('entry_date', end).order('entry_date'));
  const entryIds = entries.map(e => e.id);
  let lines = [];
  if (entryIds.length) {
    for (let i=0; i<entryIds.length; i+=250) {
      const chunk = entryIds.slice(i,i+250);
      const { data, error } = await supabase.from('journal_lines').select('id,journal_entry_id,ledger_account_id,debit,credit,business_line_id,customer_id,project_id,vendor_id').in('journal_entry_id', chunk);
      if (error) throw error;
      lines.push(...(data || []));
    }
  }
  if (businessLineId) lines = lines.filter(line => line.business_line_id === businessLineId);
  const entryMap = new Map(entries.map(e => [e.id, e]));
  const accounts = await fetchAll(supabase, 'chart_accounts', 'id,code,name,account_type,subtype,active', q => q.eq('active', true).order('code'));
  const accountMap = new Map(accounts.map(a => [a.id,a]));

  const pnlRows = lines.filter(line => {
    const entry = entryMap.get(line.journal_entry_id);
    const acc = accountMap.get(line.ledger_account_id);
    return entry && entry.entry_date >= start && ['income','expense'].includes(acc?.account_type);
  });
  const pnl = accounts.filter(a => ['income','expense'].includes(a.account_type)).map(a => {
    const rows = pnlRows.filter(l => l.ledger_account_id === a.id);
    const amount = a.account_type === 'income' ? sum(rows,l=>l.credit-l.debit) : sum(rows,l=>l.debit-l.credit);
    return { code:a.code, name:a.name, accountType:a.account_type, amount };
  }).filter(r => Math.abs(r.amount) > 0.004);
  const income = sum(pnl.filter(r=>r.accountType==='income'), r=>r.amount);
  const expenses = sum(pnl.filter(r=>r.accountType==='expense'), r=>r.amount);

  const bs = accounts.filter(a => ['asset','liability','equity'].includes(a.account_type)).map(a => {
    const rows = lines.filter(l => l.ledger_account_id === a.id);
    const amount = a.account_type === 'asset' ? sum(rows,l=>l.debit-l.credit) : sum(rows,l=>l.credit-l.debit);
    return { code:a.code, name:a.name, accountType:a.account_type, amount };
  }).filter(r => Math.abs(r.amount) > 0.004);
  // Revenue and expense accounts are not formally closed each month/year in this lightweight ledger.
  // Add cumulative earnings to equity so Assets = Liabilities + Equity on the Balance Sheet.
  const cumulativeIncome = sum(lines.filter(l=>accountMap.get(l.ledger_account_id)?.account_type==='income'), l=>l.credit-l.debit);
  const cumulativeExpense = sum(lines.filter(l=>accountMap.get(l.ledger_account_id)?.account_type==='expense'), l=>l.debit-l.credit);
  const currentEarnings = cumulativeIncome - cumulativeExpense;
  if (Math.abs(currentEarnings) > 0.004) bs.push({ code:'3999', name:'Current Earnings', accountType:'equity', amount:currentEarnings });
  const balanceSheetTotals = {
    assets: sum(bs.filter(r=>r.accountType==='asset'),r=>r.amount),
    liabilities: sum(bs.filter(r=>r.accountType==='liability'),r=>r.amount),
    equity: sum(bs.filter(r=>r.accountType==='equity'),r=>r.amount)
  };
  balanceSheetTotals.difference = balanceSheetTotals.assets - balanceSheetTotals.liabilities - balanceSheetTotals.equity;

  const transactions = await fetchAll(supabase, 'financial_transactions', 'transaction_date,transaction_type,amount,category_id,business_line_id,customer_id,project_id,vendor_id,financial_account_id,personal,voided_at', q => q.is('voided_at', null).gte('transaction_date', start).lte('transaction_date', end));
  const filteredTransactions = businessLineId ? transactions.filter(t=>t.business_line_id===businessLineId) : transactions;
  const byLine = lookups.businessLines.map(line => {
    const rows = filteredTransactions.filter(t=>t.business_line_id===line.id && !t.personal);
    const revenue = sum(rows.filter(t=>['income','customer_payment'].includes(t.transaction_type)), t=>t.amount);
    const expense = sum(rows.filter(t=>['expense','vendor_payment'].includes(t.transaction_type)), t=>t.amount);
    return { name:line.name, revenue, expense, profit:revenue-expense };
  });
  const [reportProjects, reportWorkers, periodTimeEntries, reportCustomers, reportVendors, reportCategories, reportFinancialAccounts] = await Promise.all([
    fetchAll(supabase, 'projects', 'id,name,customer_id,business_line_id', q => q.order('name')),
    fetchAll(supabase, 'workers', 'id,pay_rate,overtime_rate', q => q.order('id')),
    fetchAll(supabase, 'time_entries', 'worker_id,project_id,business_line_id,work_date,regular_hours,overtime_hours,approval_status', q => q.gte('work_date',start).lte('work_date',end).in('approval_status',['approved','paid'])),
    fetchAll(supabase, 'customers', 'id,display_name', q => q.order('display_name')),
    fetchAll(supabase, 'vendors', 'id,name', q => q.order('name')),
    fetchAll(supabase, 'transaction_categories', 'id,name', q => q.order('name')),
    fetchAll(supabase, 'financial_accounts', 'id,account_type', q => q.order('id'))
  ]);
  const projectMap = new Map(reportProjects.map(p=>[p.id,p]));
  const workerRateMap = new Map(reportWorkers.map(w=>[w.id,w]));
  const laborEntries = businessLineId ? periodTimeEntries.filter(t=>t.business_line_id===businessLineId) : periodTimeEntries;

  const customerMap = new Map(reportCustomers.map(c => [c.id, c.display_name]));
  const vendorMap = new Map(reportVendors.map(v => [v.id, v.name]));
  const categoryMap = new Map(reportCategories.map(c => [c.id, c.name]));
  const accountTypeMap = new Map(reportFinancialAccounts.map(a => [a.id, a.account_type]));
  const businessTransactions = filteredTransactions.filter(t => !t.personal);
  const revenueTransactions = businessTransactions.filter(t => ['income','customer_payment'].includes(t.transaction_type));
  const expenseTransactions = businessTransactions.filter(t => ['expense','vendor_payment'].includes(t.transaction_type));

  const aggregate = (rows, keyFn, labelFn) => {
    const m = new Map();
    for (const row of rows) {
      const k = keyFn(row); if (!k) continue;
      if (!m.has(k)) m.set(k, { name: labelFn(k), amount: 0 });
      m.get(k).amount += money(row.amount);
    }
    return [...m.values()].sort((a,b) => b.amount-a.amount);
  };
  const customerRevenue = aggregate(revenueTransactions, t => t.customer_id, id => customerMap.get(id) || 'Unknown customer');
  const customerProfitMap = new Map();
  for (const c of reportCustomers) customerProfitMap.set(c.id,{name:c.display_name,revenue:0,directExpense:0,laborCost:0,profit:0});
  for (const t of revenueTransactions) if(t.customer_id && customerProfitMap.has(t.customer_id)) customerProfitMap.get(t.customer_id).revenue += money(t.amount);
  for (const t of expenseTransactions) if(t.customer_id && customerProfitMap.has(t.customer_id)) customerProfitMap.get(t.customer_id).directExpense += money(t.amount);
  for (const t of laborEntries) {
    const project=projectMap.get(t.project_id); const worker=workerRateMap.get(t.worker_id); const customerId=project?.customer_id;
    if (!customerId || !worker || !customerProfitMap.has(customerId)) continue;
    const labor=money(t.regular_hours)*money(worker.pay_rate)+money(t.overtime_hours)*money(worker.overtime_rate ?? money(worker.pay_rate)*1.5);
    customerProfitMap.get(customerId).laborCost += labor;
  }
  const customerProfitability=[...customerProfitMap.values()].map(r=>({...r,profit:r.revenue-r.directExpense-r.laborCost})).filter(r=>r.revenue||r.directExpense||r.laborCost).sort((a,b)=>b.profit-a.profit);

  const projectProfitMap = new Map();
  const ensureProject = id => {
    const p=projectMap.get(id); if(!p)return null;
    if(!projectProfitMap.has(id))projectProfitMap.set(id,{project_id:id,project_name:p.name,customer_id:p.customer_id,business_line_id:p.business_line_id,cash_revenue:0,direct_expense:0,labor_cost:0});
    return projectProfitMap.get(id);
  };
  for(const t of revenueTransactions){const p=ensureProject(t.project_id);if(p)p.cash_revenue+=money(t.amount);}
  for(const t of expenseTransactions){const p=ensureProject(t.project_id);if(p)p.direct_expense+=money(t.amount);}
  for(const t of laborEntries){const p=ensureProject(t.project_id),w=workerRateMap.get(t.worker_id);if(p&&w)p.labor_cost+=money(t.regular_hours)*money(w.pay_rate)+money(t.overtime_hours)*money(w.overtime_rate ?? money(w.pay_rate)*1.5);}
  const projectProfitability=[...projectProfitMap.values()].sort((a,b)=>(money(b.cash_revenue)-money(b.direct_expense)-money(b.labor_cost))-(money(a.cash_revenue)-money(a.direct_expense)-money(a.labor_cost)));
  const vendorSpending = aggregate(expenseTransactions, t => t.vendor_id, id => vendorMap.get(id) || 'Unknown vendor');
  const expenseByCategory = aggregate(expenseTransactions, t => t.category_id, id => categoryMap.get(id) || 'Uncategorized');
  const revenueByIncomeStream = aggregate(revenueTransactions, t => t.category_id, id => categoryMap.get(id) || 'Uncategorized');

  const monthMap = new Map();
  const yearMap = new Map();
  for (const t of businessTransactions) {
    const month = String(t.transaction_date).slice(0,7), year = String(t.transaction_date).slice(0,4);
    const isRevenue = ['income','customer_payment'].includes(t.transaction_type);
    const isExpense = ['expense','vendor_payment'].includes(t.transaction_type);
    for (const [key, map] of [[month,monthMap],[year,yearMap]]) {
      if (!map.has(key)) map.set(key,{month:key,revenue:0,expense:0,profit:0});
      const r=map.get(key); if(isRevenue)r.revenue+=money(t.amount); if(isExpense)r.expense+=money(t.amount); r.profit=r.revenue-r.expense;
    }
  }
  const monthly=[...monthMap.values()].sort((a,b)=>a.month.localeCompare(b.month));
  const yearly=[...yearMap.values()].sort((a,b)=>a.month.localeCompare(b.month));

  // Cash flow uses only cash/bank accounts. Credit-card purchases affect P&L and liabilities, not cash until paid.
  const cashTx = filteredTransactions.filter(t => accountTypeMap.get(t.financial_account_id) !== 'credit_card');
  const operating = sum(cashTx.filter(t => ['income','customer_payment'].includes(t.transaction_type)), t=>t.amount)
    - sum(cashTx.filter(t => ['expense','vendor_payment','sales_tax_payment'].includes(t.transaction_type)), t=>t.amount);
  const financing = sum(cashTx.filter(t => t.transaction_type==='owner_contribution'), t=>t.amount)
    - sum(cashTx.filter(t => ['owner_draw','credit_card_payment','loan_principal_payment'].includes(t.transaction_type)), t=>t.amount);
  const cashFlow = { operating, investing:0, financing, netChange:operating+financing };

  return { start,end,businessLineId,pnl,summary:{income,expenses,netProfit:income-expenses},balanceSheet:bs,balanceSheetTotals,cashFlow,byLine,projectProfitability,customerRevenue,customerProfitability,vendorSpending,expenseByCategory,revenueByIncomeStream,monthly,yearly };
}

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' });
  const auth = requireAdmin(event);
  if (auth.error) return auth.error;
  const { supabase } = auth;
  const params = new URLSearchParams(event.rawQuery || event.rawUrl?.split('?')[1] || '');
  const view = params.get('view') || 'dashboard';

  try {
    const lookups = await baseLookups(supabase);
    let data;
    if (view === 'dashboard') data = await dashboard(supabase, lookups);
    else if (view === 'customers') data = await customersView(supabase, lookups, params.get('id'));
    else if (view === 'projects') data = await projectsView(supabase, lookups);
    else if (view === 'banking') data = await bankingView(supabase, lookups);
    else if (view === 'accounting') data = await accountingView(supabase, lookups);
    else if (view === 'team') data = await teamView(supabase, lookups);
    else if (view === 'mileage') data = await mileageView(supabase, lookups);
    else if (view === 'reports') data = await reportsView(supabase, lookups, params);
    else if (view === 'lookups') data = lookups;
    else return json(400, { error: `Unknown business view: ${view}` });
    return json(200, { ok:true, setupRequired:false, ...data });
  } catch (error) {
    console.error('[business-data]', error);
    if (isMissingBusinessSchema(error)) {
      return json(409, { error: 'Business modules are ready, but the Supabase v3.0 schema has not been installed yet. Run EWPROS-BUSINESS-SYSTEM-SCHEMA.sql in Supabase SQL Editor.', setupRequired:true });
    }
    return json(500, { error: error.message || 'Unable to load EWPros business data.' });
  }
};
