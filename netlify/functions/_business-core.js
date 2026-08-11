const crypto = require('crypto');
const { verifyAdminPassword } = require('./_admin-auth');
const { getSupabaseAdmin, json, fetchAll } = require('./_supabase');

const money = value => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function requireAdmin(event) {
  const auth = verifyAdminPassword(event);
  if (!auth.ok) return { error: json(auth.statusCode, { error: auth.message }) };
  try {
    return { supabase: getSupabaseAdmin() };
  } catch (error) {
    return { error: json(500, { error: error.message }) };
  }
}

function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); }
  catch { throw new Error('Request body must be valid JSON.'); }
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function isMissingBusinessSchema(error) {
  return /relation .* does not exist|could not find the table|schema cache|business_lines/i.test(error?.message || '');
}

async function lookupByCode(supabase, table, column, value, select = '*') {
  if (!value) return null;
  const { data, error } = await supabase.from(table).select(select).eq(column, value).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function ledgerAccountForFinancialAccount(supabase, financialAccount) {
  if (financialAccount?.ledger_account_id) {
    const { data, error } = await supabase.from('chart_accounts').select('*').eq('id', financialAccount.ledger_account_id).single();
    if (error) throw error;
    return data;
  }
  const fallbackCode = financialAccount?.account_type === 'credit_card' ? '2000' : '1000';
  return lookupByCode(supabase, 'chart_accounts', 'code', fallbackCode);
}

async function categoryWithLedger(supabase, categoryId) {
  if (!categoryId) return null;
  const { data, error } = await supabase
    .from('transaction_categories')
    .select('id,name,behavior,ledger_account_id,chart_accounts(id,code,name,account_type,subtype)')
    .eq('id', categoryId)
    .single();
  if (error) throw error;
  return data;
}

async function createJournal(supabase, entry, lines) {
  const totalDebit = lines.reduce((sum, line) => sum + money(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + money(line.credit), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.009 || totalDebit <= 0) {
    throw new Error(`Journal entry is not balanced (debits ${totalDebit.toFixed(2)}, credits ${totalCredit.toFixed(2)}).`);
  }

  const { data: journal, error: journalError } = await supabase
    .from('journal_entries')
    .insert({
      entry_date: entry.entry_date,
      memo: entry.memo || '',
      source_type: entry.source_type || 'manual',
      source_id: entry.source_id || null,
      status: 'posted'
    })
    .select('id')
    .single();
  if (journalError) throw journalError;

  const payload = lines.map(line => ({
    journal_entry_id: journal.id,
    ledger_account_id: line.ledger_account_id,
    debit: money(line.debit),
    credit: money(line.credit),
    business_line_id: line.business_line_id || null,
    customer_id: line.customer_id || null,
    project_id: line.project_id || null,
    vendor_id: line.vendor_id || null
  }));
  const { error: lineError } = await supabase.from('journal_lines').insert(payload);
  if (lineError) {
    await supabase.from('journal_entries').delete().eq('id', journal.id);
    throw lineError;
  }
  return journal.id;
}

async function postOperationalTransaction(supabase, transaction, options = {}) {
  const amount = Math.abs(money(transaction.amount));
  if (!amount) throw new Error('Transaction amount must be greater than zero.');

  const { data: financialAccount, error: accountError } = await supabase
    .from('financial_accounts').select('*').eq('id', transaction.financial_account_id).single();
  if (accountError) throw accountError;
  const accountLedger = await ledgerAccountForFinancialAccount(supabase, financialAccount);
  if (!accountLedger) throw new Error('The financial account is not linked to a ledger account.');

  const category = await categoryWithLedger(supabase, transaction.category_id);
  const type = transaction.transaction_type || category?.behavior;
  if (!type) throw new Error('Choose a transaction category/type before posting.');

  let counterLedger = category?.chart_accounts || null;
  if (['transfer', 'credit_card_payment'].includes(type) && options.counter_financial_account_id) {
    const { data: counterAccount, error } = await supabase.from('financial_accounts').select('*').eq('id', options.counter_financial_account_id).single();
    if (error) throw error;
    counterLedger = await ledgerAccountForFinancialAccount(supabase, counterAccount);
  }
  if (!counterLedger && type === 'customer_payment') counterLedger = await lookupByCode(supabase, 'chart_accounts', 'code', '1100');
  if (!counterLedger && type === 'vendor_payment') counterLedger = await lookupByCode(supabase, 'chart_accounts', 'code', '2100');
  if (!counterLedger && type === 'credit_card_payment') counterLedger = await lookupByCode(supabase, 'chart_accounts', 'code', '2000');
  if (!counterLedger && type === 'owner_contribution') counterLedger = await lookupByCode(supabase, 'chart_accounts', 'code', '3000');
  if (!counterLedger && type === 'owner_draw') counterLedger = await lookupByCode(supabase, 'chart_accounts', 'code', '3100');
  if (!counterLedger) throw new Error('This transaction needs a category linked to a ledger account.');

  const dims = {
    business_line_id: transaction.business_line_id || null,
    customer_id: transaction.customer_id || null,
    project_id: transaction.project_id || null,
    vendor_id: transaction.vendor_id || null
  };

  const moneyInTypes = new Set(['income', 'customer_payment', 'owner_contribution']);
  const moneyOutTypes = new Set(['expense', 'vendor_payment', 'owner_draw', 'credit_card_payment']);
  const isTransfer = type === 'transfer';
  let lines;

  if (isTransfer) {
    if (!options.counter_financial_account_id) throw new Error('Choose the other account for a transfer.');
    lines = options.direction === 'in'
      ? [
          { ledger_account_id: accountLedger.id, debit: amount, credit: 0, ...dims },
          { ledger_account_id: counterLedger.id, debit: 0, credit: amount, ...dims }
        ]
      : [
          { ledger_account_id: counterLedger.id, debit: amount, credit: 0, ...dims },
          { ledger_account_id: accountLedger.id, debit: 0, credit: amount, ...dims }
        ];
  } else if (type === 'credit_card_payment' && financialAccount.account_type === 'credit_card') {
    if (!options.counter_financial_account_id) throw new Error('Choose the bank account used to pay this credit card.');
    lines = [
      { ledger_account_id: accountLedger.id, debit: amount, credit: 0, ...dims },
      { ledger_account_id: counterLedger.id, debit: 0, credit: amount, ...dims }
    ];
  } else if (moneyInTypes.has(type)) {
    lines = [
      { ledger_account_id: accountLedger.id, debit: amount, credit: 0, ...dims },
      { ledger_account_id: counterLedger.id, debit: 0, credit: amount, ...dims }
    ];
  } else if (moneyOutTypes.has(type)) {
    lines = [
      { ledger_account_id: counterLedger.id, debit: amount, credit: 0, ...dims },
      { ledger_account_id: accountLedger.id, debit: 0, credit: amount, ...dims }
    ];
  } else {
    throw new Error(`Unsupported transaction type: ${type}`);
  }

  const journalId = await createJournal(supabase, {
    entry_date: transaction.transaction_date,
    memo: transaction.description,
    source_type: transaction.source || 'manual',
    source_id: options.source_id || null
  }, lines);

  return { journalId, transactionType: type, personal: type === 'owner_draw' };
}

async function applyRules(supabase, rows, defaultBusinessLineId = null) {
  const rules = await fetchAll(
    supabase,
    'transaction_rules',
    'id,name,keywords,match_mode,category_id,business_line_id,customer_id,project_id,priority,active',
    query => query.eq('active', true).order('priority', { ascending: true })
  );
  return rows.map(row => {
    const text = String(row.description || '').toLowerCase();
    const rule = rules.find(item => {
      const keywords = (item.keywords || []).map(k => String(k).trim().toLowerCase()).filter(Boolean);
      if (!keywords.length) return false;
      return item.match_mode === 'all'
        ? keywords.every(keyword => text.includes(keyword))
        : keywords.some(keyword => text.includes(keyword));
    });
    return {
      ...row,
      category_id: rule?.category_id || null,
      business_line_id: rule?.business_line_id || defaultBusinessLineId || null,
      customer_id: rule?.customer_id || null,
      project_id: rule?.project_id || null,
      matched_rule_id: rule?.id || null,
      matched_rule_name: rule?.name || ''
    };
  });
}

module.exports = {
  requireAdmin,
  parseBody,
  sha256,
  money,
  isMissingBusinessSchema,
  lookupByCode,
  createJournal,
  postOperationalTransaction,
  applyRules
};
