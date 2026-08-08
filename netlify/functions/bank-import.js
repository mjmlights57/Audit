const { json } = require('./_supabase');
const { requireAdmin, parseBody, sha256, money, isMissingBusinessSchema, applyRules } = require('./_business-core');
const { statementRows, stableTransactionHash } = require('./_bank-parser');

async function duplicateHashes(supabase, accountId, hashes) {
  const existing = new Set();
  for (let i=0; i<hashes.length; i+=200) {
    const { data, error } = await supabase.from('bank_transactions').select('external_hash').eq('financial_account_id',accountId).in('external_hash',hashes.slice(i,i+200));
    if (error) throw error;
    for (const row of data || []) existing.add(row.external_hash);
  }
  return existing;
}

async function prepare(supabase, body) {
  const accountId = body.financial_account_id;
  if (!accountId) throw new Error('Choose the bank or credit-card account first.');
  const text = String(body.file_text || '');
  if (!text.trim()) throw new Error('The statement file is empty.');
  const rawRows = statementRows(text, body.filename || 'statement.csv', body.format);
  const hashes = rawRows.map(row => stableTransactionHash(accountId,row));
  const duplicates = await duplicateHashes(supabase, accountId, hashes);
  const withHashes = rawRows.map((row,index) => ({...row,external_hash:hashes[index],duplicate:duplicates.has(hashes[index])}));
  const ruled = await applyRules(supabase, withHashes, body.default_business_line_id || null);
  return { rows:ruled, file_hash:sha256(text), file_type:(body.format || body.filename?.split('.').pop() || 'csv').toLowerCase() };
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed.'});
  const auth = requireAdmin(event); if (auth.error) return auth.error;
  const { supabase } = auth;
  try {
    const body = parseBody(event); const mode=body.mode||'preview';
    const prepared = await prepare(supabase,body);
    const duplicates=prepared.rows.filter(r=>r.duplicate).length;
    const newRows=prepared.rows.filter(r=>!r.duplicate);
    if (mode==='preview') return json(200,{ok:true,preview:true,summary:{total:prepared.rows.length,newRows:newRows.length,duplicates,rulesMatched:prepared.rows.filter(r=>r.matched_rule_id).length},rows:prepared.rows.slice(0,500)});
    if (mode!=='confirm') throw new Error('Import mode must be preview or confirm.');

    const accountId=body.financial_account_id;
    const { data:existingBatch } = await supabase.from('bank_import_batches').select('*').eq('financial_account_id',accountId).eq('file_hash',prepared.file_hash).maybeSingle();
    if (existingBatch?.status==='completed') return json(200,{ok:true,alreadyImported:true,batch:existingBatch,summary:{total:prepared.rows.length,imported:0,duplicates:prepared.rows.length}});

    let batch=existingBatch;
    if (!batch) {
      const { data,error }=await supabase.from('bank_import_batches').insert({financial_account_id:accountId,filename:body.filename||'statement',file_type:prepared.file_type,file_hash:prepared.file_hash,total_rows:prepared.rows.length,duplicate_rows:duplicates,status:'preview',imported_by:'Administrator'}).select('*').single();
      if(error)throw error; batch=data;
    }
    const payload=newRows.map(row=>({
      financial_account_id:accountId,import_batch_id:batch.id,transaction_date:row.transaction_date,posted_date:row.posted_date||null,description:row.description,original_description:row.original_description||row.description,
      amount:row.amount,external_id:row.external_id||null,external_hash:row.external_hash,category_id:row.category_id||null,business_line_id:row.business_line_id||null,customer_id:row.customer_id||null,project_id:row.project_id||null,matched_rule_id:row.matched_rule_id||null,review_status:'pending'
    }));
    let imported=0;
    for (let i=0;i<payload.length;i+=500) {
      const { data,error }=await supabase.from('bank_transactions').upsert(payload.slice(i,i+500),{onConflict:'financial_account_id,external_hash',ignoreDuplicates:true}).select('id');
      if(error)throw error; imported += (data||[]).length;
    }
    const { data:done,error:doneError }=await supabase.from('bank_import_batches').update({status:'completed',imported_rows:imported,duplicate_rows:prepared.rows.length-imported,completed_at:new Date().toISOString()}).eq('id',batch.id).select('*').single();
    if(doneError)throw doneError;
    return json(200,{ok:true,batch:done,summary:{total:prepared.rows.length,imported,duplicates:prepared.rows.length-imported,rulesMatched:prepared.rows.filter(r=>r.matched_rule_id).length}});
  } catch(error) {
    console.error('[bank-import]',error);
    if(isMissingBusinessSchema(error))return json(409,{error:'Banking requires the v3.0 Supabase schema. Run EWPROS-BUSINESS-SYSTEM-SCHEMA.sql first.',setupRequired:true});
    return json(400,{error:error.message||'Bank import failed.'});
  }
};

