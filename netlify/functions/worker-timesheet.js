const crypto = require('crypto');
const { getSupabaseAdmin, json } = require('./_supabase');

const clean = value => value === undefined || value === null ? '' : String(value).trim();
const money = value => { const n=Number(value); return Number.isFinite(n) ? Math.round(n*100)/100 : 0; };

function hashPin(salt,pin) {
  return crypto.createHash('sha256').update(`${salt}|${pin}`).digest('hex');
}
function sameHash(a,b) {
  try { const aa=Buffer.from(String(a),'hex'), bb=Buffer.from(String(b),'hex'); return aa.length===bb.length && aa.length>0 && crypto.timingSafeEqual(aa,bb); }
  catch { return false; }
}
async function authenticate(supabase,email,pin) {
  const normalized=clean(email).toLowerCase();
  if (!normalized || !clean(pin)) throw new Error('Enter your email and timesheet PIN.');
  const {data:worker,error}=await supabase.from('workers').select('id,worker_type,first_name,last_name,email,active,timesheet_pin_salt,timesheet_pin_hash,timesheet_access_enabled').ilike('email',normalized).maybeSingle();
  if (error) throw error;
  if (!worker || !worker.active || !worker.timesheet_access_enabled || !worker.timesheet_pin_salt || !sameHash(worker.timesheet_pin_hash,hashPin(worker.timesheet_pin_salt,clean(pin)))) throw new Error('Email or timesheet PIN is incorrect.');
  return worker;
}
async function loadPortal(supabase,worker) {
  const since=new Date(); since.setDate(since.getDate()-60);
  const [{data:projects,error:pe},{data:lines,error:be},{data:entries,error:te}] = await Promise.all([
    supabase.from('projects').select('id,name,project_number,business_line_id,customer_id,status,customers(display_name),business_lines(name)').in('status',['lead','active','on_hold']).order('name'),
    supabase.from('business_lines').select('id,name,code,active').eq('active',true).order('name'),
    supabase.from('time_entries').select('id,work_date,regular_hours,overtime_hours,notes,approval_status,project_id,business_line_id,projects(name,project_number),business_lines(name)').eq('worker_id',worker.id).gte('work_date',since.toISOString().slice(0,10)).order('work_date',{ascending:false}).limit(100)
  ]);
  if(pe)throw pe;if(be)throw be;if(te)throw te;
  return {worker:{id:worker.id,worker_type:worker.worker_type,first_name:worker.first_name,last_name:worker.last_name,email:worker.email},projects:projects||[],businessLines:lines||[],entries:entries||[]};
}
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  try{
    const supabase=getSupabaseAdmin();
    const body=JSON.parse(event.body||'{}');
    const worker=await authenticate(supabase,body.email,body.pin);
    if((body.action||'login')==='submit'){
      const regular=money(body.regular_hours), overtime=money(body.overtime_hours);
      if(regular<0||overtime<0||regular+overtime<=0||regular+overtime>24)throw new Error('Enter valid hours greater than 0 and no more than 24 total.');
      let businessLineId=clean(body.business_line_id)||null; let projectId=clean(body.project_id)||null;
      if(projectId){
        const {data:project,error}=await supabase.from('projects').select('id,business_line_id').eq('id',projectId).maybeSingle();
        if(error)throw error;if(!project)throw new Error('Project was not found.'); businessLineId=project.business_line_id;
      }
      if(!businessLineId)throw new Error('Choose a business line.');
      const date=clean(body.work_date); if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Choose a valid work date.');
      const {error}=await supabase.from('time_entries').insert({worker_id:worker.id,project_id:projectId,business_line_id:businessLineId,work_date:date,regular_hours:regular,overtime_hours:overtime,notes:clean(body.notes)||null,approval_status:'submitted'});
      if(error)throw error;
    }
    return json(200,{ok:true,...await loadPortal(supabase,worker)});
  }catch(error){console.error('[worker-timesheet]',error);return json(400,{error:error.message||'Unable to access timesheets.'});}
};
