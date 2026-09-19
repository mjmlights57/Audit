const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p), 'utf8');

// Exercise the actual business-action request handler with a small fake Supabase RPC.
// This does not touch the live database and does not claim to test PostgreSQL execution.
function handlerWithRpc(rpc) {
  const supabase = {rpc};
  const exports = {};
  const js = read('netlify/functions/business-action.js');
  vm.runInNewContext(js, {
    require(name) {
      if (name === 'crypto') return require('node:crypto');
      if (name === './_supabase') return {json:(statusCode, body)=>({statusCode, body:JSON.stringify(body)})};
      if (name === './_business-core') return {
        requireAdmin:()=>({supabase}), parseBody:e=>JSON.parse(e.body || '{}'),
        isMissingBusinessSchema:()=>false, money:Number,
      };
      throw new Error('Unexpected dependency: ' + name);
    },
    exports,
    console: {error:()=>{}},
  }, {filename:'business-action.js'});
  return exports.handler;
}
const req = data => ({httpMethod:'POST',body:JSON.stringify(data)});

test('archived projects have a separate permanent deletion action and a typed confirmation', () => {
  const js=read('admin/business.js');
  for(const htmlName of ['admin.html','admin/index.html'])
    assert.match(read(htmlName),/Administrator · v3\.1\.3/);
  assert.match(js,/data-restore-project="\$\{p\.id\}"/);
  assert.match(js,/data-purge-project="\$\{p\.id\}"/);
  assert.match(js,/action:'purge_archived_project'/);
  assert.match(js,/confirm:'DELETE'/);
  assert.match(js,/requireText:'DELETE'/);
  assert.match(js,/confirmButton\.disabled=input\.value!==requireText/);
});

test('permanent project delete refuses an unconfirmed API request', async () => {
  let called=0;
  const handler=handlerWithRpc(async()=>{called++;return {data:{mode:'permanently_deleted'},error:null};});
  const response=await handler(req({action:'purge_archived_project',id:'test-project'}));
  assert.equal(response.statusCode,400);
  assert.match(JSON.parse(response.body).error,/Type DELETE/);
  assert.equal(called,0);
});

test('permanent project delete calls the atomic stored procedure and returns its result', async () => {
  let args;
  const handler=handlerWithRpc(async (...value)=>{
    args=value;
    return {data:{mode:'permanently_deleted',project_id:'test-project',removed:{appointments:1}},error:null};
  });
  const response=await handler(req({action:'purge_archived_project',id:'test-project',confirm:'DELETE'}));
  assert.equal(response.statusCode,200);
  assert.equal(args[0],'ewpros_purge_archived_project');
  assert.equal(args[1].p_project_id,'test-project');
  assert.equal(JSON.parse(response.body).data.removed.appointments,1);
});

test('database errors do not produce a false deletion success', async () => {
  const handler=handlerWithRpc(async()=>({data:null,error:{message:'Only archived projects can be permanently deleted.'}}));
  const response=await handler(req({action:'purge_archived_project',id:'active-project',confirm:'DELETE'}));
  assert.equal(response.statusCode,400);
  assert.match(JSON.parse(response.body).error,/Only archived/);
});

test('project purge SQL is restricted, atomic, removes linked entries and retains original bank statements', () => {
  const sql=read('EWPROS-V3.1.3-MIGRATION.sql');
  assert.match(sql,/begin;[\s\S]*commit;/i);
  assert.match(sql,/for update/i);
  assert.match(sql,/v_project\.status is distinct from 'archived'/);
  for(const table of ['appointments','reminders','invoices','payments','financial_transactions','journal_entries','worker_payments','time_entries','mileage_trips','projects'])
    assert.match(sql, new RegExp('delete from public\\.' + table + '\\b','i'));
  assert.match(sql,/update public\.bank_transactions bt/);
  assert.match(sql,/review_status = case when bt\.review_status = 'posted' then 'pending'/);
  assert.doesNotMatch(sql,/delete from public\.bank_transactions/i);
  assert.match(sql,/revoke all on function public\.ewpros_purge_archived_project\(uuid\) from public/i);
  assert.match(sql,/grant execute on function public\.ewpros_purge_archived_project\(uuid\) to service_role/i);
  assert.doesNotMatch(sql,/drop table|truncate table/i);
});
