const { verifyAdminPassword } = require('./_admin-auth');
const { getSupabaseAdmin, json, fetchAll } = require('./_supabase');
const { customerMatch, parseCustomerCsv, mergePatch } = require('./_crm-csv');

async function buildPlan(supabase, csvText, defaults) {
  const [businessLines, existing] = await Promise.all([
    fetchAll(supabase,'business_lines','id,code,name,active',q=>q.eq('active',true).order('name')),
    fetchAll(supabase,'customers','id,display_name,company_name,contact_name,phone,email,service_address,city,state_code,zipcode,customer_type,primary_business_line_id,notes,active',q=>q.order('updated_at',{ascending:false}))
  ]);
  const parsed = parseCustomerCsv(csvText, defaults, businessLines);
  const valid=[], invalid=[], duplicates=[];
  for (const item of parsed.rows) {
    if (item.errors.length) { invalid.push(item); continue; }
    const match=customerMatch(existing,item.customer);
    if (match) duplicates.push({...item,existing:match.customer,matchedBy:match.customer._preview?'same file':match.matchedBy,patch:match.customer._preview?{}:mergePatch(match.customer,item.customer)});
    else { valid.push(item); existing.push({...item.customer,id:`preview-${item.rowNumber}`,active:true,_preview:true}); }
  }
  return { businessLines, headers:parsed.headers, recognized:parsed.recognized, valid, invalid, duplicates };
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed.'});
  const auth=verifyAdminPassword(event); if(!auth.ok)return json(auth.statusCode,{error:auth.message});
  let body; try{body=JSON.parse(event.body||'{}');}catch{return json(400,{error:'The request body is invalid.'});}
  const csvText=String(body.csvText||'').trim();
  if(!csvText)return json(400,{error:'Choose a customer CSV file first.'});
  if(!body.default_business_line_id)return json(400,{error:'Choose the default business line for the import.'});
  try{
    const supabase=getSupabaseAdmin();
    const plan=await buildPlan(supabase,csvText,{default_business_line_id:body.default_business_line_id,default_customer_type:body.default_customer_type||'customer'});
    const summary={totalRows:plan.valid.length+plan.invalid.length+plan.duplicates.length,newRows:plan.valid.length,duplicateRows:plan.duplicates.length,errorRows:plan.invalid.length,updateRows:body.update_existing?plan.duplicates.filter(d=>!d.existing._preview&&Object.keys(d.patch).length).length:0};
    const changes=[
      ...plan.valid.slice(0,50).map(i=>({row:i.rowNumber,action:'new',customer:i.customer.display_name,email:i.customer.email,phone:i.customer.phone,address:i.customer.service_address})),
      ...plan.duplicates.slice(0,50).map(i=>({row:i.rowNumber,action:body.update_existing&&Object.keys(i.patch).length?'update':'duplicate',customer:i.customer.display_name,matchedBy:i.matchedBy,email:i.customer.email,phone:i.customer.phone,address:i.customer.service_address})),
      ...plan.invalid.slice(0,30).map(i=>({row:i.rowNumber,action:'error',customer:i.customer.display_name,error:i.errors.join(' ')}))
    ].slice(0,100);
    if(body.previewOnly)return json(200,{ok:true,preview:true,headers:plan.headers,recognizedHeaders:plan.recognized,summary,changes});

    if(plan.valid.length){
      const payload=plan.valid.map(i=>{
        const { business_line, ...customer } = i.customer;
        return {...customer,source:customer.source||'crm_import',active:true};
      });
      const {error}=await supabase.from('customers').insert(payload); if(error)throw error;
    }
    let updated=0;
    if(body.update_existing){
      for(const item of plan.duplicates){
        if(item.existing._preview||!Object.keys(item.patch).length)continue;
        const {error}=await supabase.from('customers').update({...item.patch,updated_at:new Date().toISOString()}).eq('id',item.existing.id); if(error)throw error;
        updated++;
      }
    }
    return json(200,{ok:true,imported:true,summary:{...summary,updateRows:updated},changes});
  }catch(error){console.error('[crm-import]',error);return json(400,{error:error.message||'Customer import failed.'});}
};

