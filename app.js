const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const USERS={auditor:{id:'AUDITOR',name:'EWPros Auditor',username:'auditor',password:'audit123',credential:'Certified EWPros Auditor',initials:'EA'}};
const defaultNotes=[{title:'Appointments are centrally managed',body:'Use Synchronize now to refresh the latest Asana appointments.',date:'EWPros'}];
const EMAIL_FUNCTION_URL='/.netlify/functions/send-audit-email';
const APPOINTMENTS_FUNCTION_URL='/.netlify/functions/get-appointments';
const EMAIL_QUEUE_KEY='aw_email_queue';
let state={user:null,route:'home',selectedAppointment:null,deferredPrompt:null,appointmentSearch:'',appointmentFilter:'active',interiorMode:'hvac'};
function load(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}}
function esc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;').replaceAll("'",'&#039;')}
function shortAppointmentId(a){const raw=String(a.id||a.externalTaskId||'');return raw.length>11?`AS-${raw.slice(-8)}`:raw}
function normalizeUtilityName(value){const raw=String(value||'').trim();const compact=raw.toUpperCase().replace(/[^A-Z]/g,'');if(compact.includes('BGE')||compact.includes('BALTIMOREGASELECTRIC')||compact.includes('BALTIMOREGASANDELECTRIC'))return'BGE';if(compact.includes('PEPCO')||compact.includes('POTOMACELECTRICPOWER'))return'PEPCO';return''}
function utilityForAudit(a){return normalizeUtilityName(a?.signedUtility||a?.utility)}
function termsTemplateVersion(program){return program==='BGE'?'BGE-C&I-202510':program==='PEPCO'?'PEPCO-04-2025':''}
function utilityLabel(a){return utilityForAudit(a)||normalizeUtilityName(a?.utility)||'Utility not identified'}
function lightingCatalog(){return window.EWPROS_LIGHTING_DEVICE_CATALOG||{}}
function newLightingItem(){return{kind:'lighting',category:'Lighting',location:'',over300sf:'',deviceCategory:'',deviceCode:'',manualCode:false,quantity:1,photo:null,notes:''}}
function save(key,v){localStorage.setItem(key,JSON.stringify(v))}
if(!localStorage.getItem('aw_appointments')) save('aw_appointments',[]);
if(!localStorage.getItem('aw_notifications')) save('aw_notifications',defaultNotes);
function appointments(){return load('aw_appointments',[])} function setAppointments(v){save('aw_appointments',v)}
const LEGACY_DEMO_IDS=new Set(['A-2649876','A-2648423','A-2650031']);const cleanedLegacy=appointments().filter(a=>!LEGACY_DEMO_IDS.has(a.id)||a.externalTaskId||a.status==='completed');if(cleanedLegacy.length!==appointments().length)setAppointments(cleanedLegacy);
function freshAuditFields(remote,local={}){
  return {...remote,
    tasks:local.tasks||{confirm:false,front:false,interior:false,exterior:false,terms:false},
    equipment:local.equipment||{interior:[],exterior:[]},photos:local.photos||{front:null},notes:local.notes||'',
    account:local.account||remote.account||'',signatureName:local.signatureName||'',signature:local.signature||'',
    signatureImage:local.signatureImage||'',signatureDate:local.signatureDate||'',signedUtility:local.signedUtility||'',templateVersion:local.templateVersion||'',noEquipment:local.noEquipment||{},
    completedAt:local.completedAt||null,emailStatus:local.emailStatus||'',emailError:local.emailError||'',emailSentAt:local.emailSentAt||null,
    fileExportStatus:local.fileExportStatus||'',fileExportedAt:local.fileExportedAt||null,
    status:local.status==='completed'?'completed':remote.status,synced:true
  };
}
async function loadRemoteAppointments(showToast=false){
  if(!navigator.onLine){if(showToast)toast('Offline — showing appointments saved on this device.');return false}
  try{
    const response=await fetch(APPOINTMENTS_FUNCTION_URL,{headers:{'Cache-Control':'no-cache'}});
    const body=await response.json();
    if(!response.ok)throw new Error(body.error||'Unable to load appointments');
    const local=appointments();
    const merged=(body.appointments||[]).map(remote=>freshAuditFields(remote,local.find(a=>a.externalTaskId===remote.externalTaskId||a.id===remote.id)));
    const completedOnly=local.filter(a=>a.status==='completed'&&!merged.some(r=>r.externalTaskId===a.externalTaskId||r.id===a.id));
    setAppointments([...merged,...completedOnly]);
    if(state.user)render();
    if(showToast)toast(`${merged.length} appointments loaded`);
    return true;
  }catch(error){console.error('[Appointments] Load failed',error);if(showToast)toast('Could not refresh appointments. Showing saved copy.');return false}
}
function currentUser(){return USERS[state.user]}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.remove('hidden');setTimeout(()=>$('#toast').classList.add('hidden'),2200)}
function markDirty(){let q=load('aw_queue',0)+1;save('aw_queue',q);updateNetwork();if(navigator.onLine)setTimeout(()=>syncNow(false),500)}
function emailQueue(){return load(EMAIL_QUEUE_KEY,[])}
function setEmailQueue(queue){save(EMAIL_QUEUE_KEY,queue);updateNetwork()}
function updateAppointmentEmailStatus(appointmentId,status,error=''){
  const arr=appointments(),i=arr.findIndex(a=>a.id===appointmentId);
  if(i<0)return;
  arr[i].emailStatus=status;
  arr[i].emailError=error;
  if(status==='sent')arr[i].emailSentAt=new Date().toISOString();
  setAppointments(arr);
  if(state.user)render();
}
function updateAppointmentFileStatus(appointmentId,status){
  const arr=appointments(),i=arr.findIndex(a=>a.id===appointmentId);
  if(i<0)return;
  arr[i].fileExportStatus=status;
  if(status==='shared'||status==='downloaded')arr[i].fileExportedAt=new Date().toISOString();
  setAppointments(arr);
  if(state.user)render();
}
async function shareAuditFiles(audit,{returnToAppointments=false}={}){
  if(!window.EWProsAuditExport){toast('PDF/CSV export component is unavailable. Refresh the app and try again.');return}
  const program=utilityForAudit(audit);
  if(!program){toast('Utility is missing. Open Customer T & C and select BGE or PEPCO.');return}
  try{
    const result=await window.EWProsAuditExport.shareOrDownloadAudit(audit);
    updateAppointmentFileStatus(audit.id,result.mode);
    if(result.mode==='shared')toast(`${program} T&C, audit CSV, and captured photos shared successfully.`);
    else if(result.mode==='downloaded')toast(`${program} T&C, audit CSV, and captured photos downloaded. Open Files to move them to Dropbox.`);
    else toast('Audit completed. File sharing was cancelled; you can share again.');
    if(returnToAppointments&&result.mode!=='cancelled')setRoute('appointments');
  }catch(error){
    console.error('[Audit Export]',error);
    updateAppointmentFileStatus(audit.id,'failed');
    toast(`Audit saved, but the ${program} PDF/CSV could not be generated. Use Share files to retry.`);
    render();
  }
}
async function completeAuditAndShare(){
  const current=getAppt();const program=utilityForAudit(current);
  if(!program){toast('Utility is missing. Open Customer T & C and select BGE or PEPCO before submitting.');return}
  let completed;
  mutateAppt(a=>{a.status='completed';a.completedAt=new Date().toISOString();a.emailStatus='queued';a.emailError='';a.fileExportStatus='preparing';a.signedUtility=a.signedUtility||program;a.templateVersion=a.templateVersion||termsTemplateVersion(program);completed={...a}});
  queueAuditEmail(completed);
  toast(navigator.onLine?`Audit completed. Preparing the filled ${program} T&C, audit CSV, and photos…`:`Audit completed offline. Email is queued; preparing the ${program} T&C, CSV, and photos…`);
  await shareAuditFiles(completed,{returnToAppointments:true});
}
function buildAuditEmailRequest(a){
  const u=USERS[a.auditor]||currentUser();
  return {id:`audit-email-${a.id}-${a.completedAt}`,appointmentNumber:a.id,customerName:a.customer,auditorName:u?.name||'Unknown auditor',propertyAddress:a.address,completionDateTime:a.completedAt};
}
function queueAuditEmail(a){
  const queue=emailQueue(),request=buildAuditEmailRequest(a);
  if(!queue.some(item=>item.id===request.id))queue.push({...request,attempts:0,nextAttemptAt:0,lastError:''});
  setEmailQueue(queue);
  updateAppointmentEmailStatus(a.id,'queued');
  console.info('[Audit Email] Queued', {appointmentNumber:a.id, online:navigator.onLine});
  if(navigator.onLine)processEmailQueue({force:true});
  else toast('Audit saved. Email queued until internet reconnects.');
}
async function sendAuditEmail(item){
  const response=await fetch(EMAIL_FUNCTION_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':item.id},body:JSON.stringify(item)});
  let body={};
  try{body=await response.json()}catch{body={message:`Server returned ${response.status}`}}
  if(!response.ok)throw new Error(body.error||body.message||`Email request failed (${response.status})`);
  return body;
}
let processingEmailQueue=false;
async function processEmailQueue({force=false}={}){
  if(processingEmailQueue||!navigator.onLine)return;
  processingEmailQueue=true;
  try{
    let queue=emailQueue(),changed=false;
    for(const item of [...queue]){
      if(!force&&item.nextAttemptAt&&Date.now()<item.nextAttemptAt)continue;
      try{
        console.info('[Audit Email] Sending', {appointmentNumber:item.appointmentNumber,attempt:item.attempts+1});
        const result=await sendAuditEmail(item);
        queue=queue.filter(q=>q.id!==item.id);changed=true;
        updateAppointmentEmailStatus(item.appointmentNumber,'sent');
        console.info('[Audit Email] Sent', {appointmentNumber:item.appointmentNumber,emailId:result.emailId});
        toast(`Email sent for ${item.appointmentNumber}`);
      }catch(error){
        const attempts=(item.attempts||0)+1;
        const delay=Math.min(15*60*1000,Math.pow(2,Math.min(attempts,6))*15000);
        const target=queue.find(q=>q.id===item.id);
        if(target){target.attempts=attempts;target.lastError=error.message;target.nextAttemptAt=Date.now()+delay;changed=true}
        updateAppointmentEmailStatus(item.appointmentNumber,'failed',error.message);
        console.error('[Audit Email] Send failed', {appointmentNumber:item.appointmentNumber,attempts,error});
        toast(`Email failed for ${item.appointmentNumber}; it will retry automatically.`);
      }
    }
    if(changed)setEmailQueue(queue);
  }finally{processingEmailQueue=false;updateNetwork()}
}
async function syncNow(showToast=true){
  if(!navigator.onLine){toast('Offline — changes and email notifications remain queued.');return}
  await loadRemoteAppointments(false);
  save('aw_queue',0);const a=appointments().map(x=>({...x,synced:true}));setAppointments(a);
  await processEmailQueue({force:true});updateNetwork();if(showToast&&!emailQueue().length)toast('Appointments refreshed; local audit work preserved')
}
function updateNetwork(){
  const online=navigator.onLine,q=load('aw_queue',0),emails=emailQueue().length,total=q+emails;
  $('#syncbar').classList.toggle('offline',!online);$('#networkText').textContent=online?'Online':'Offline — saved on device';
  $('#syncText').textContent=total?`${q} data change${q===1?'':'s'} and ${emails} email${emails===1?'':'s'} waiting`:'All changes saved';
}
function avatar(u,large=false){return `<div class="avatar ${large?'avatar-lg':''}" style="display:grid;place-items:center;background:#dbeafe;font-weight:800;font-size:${large?28:20}px">${u.initials}</div>`}
function setRoute(route,param){state.route=route;state.selectedAppointment=param||state.selectedAppointment;render();window.scrollTo(0,0)}
function header(title){$('#headerTitle').textContent=title}
function home(){const u=currentUser();header('Auditor Wizard');return `<div class="profile">${avatar(u)}<div><strong>${u.name}</strong><div class="small">Inspector ID: ${u.id}</div></div></div><div class="card"><button class="menu-item" data-go="badge"><span class="menu-icon" style="background:#a5b4fc">▣</span><strong>Badge</strong><span class="chev">›</span></button><button class="menu-item" data-go="audits"><span class="menu-icon" style="background:#f59e0b">♟</span><strong>Audits</strong><span class="badge-count">${load('aw_notifications',[]).length} unread</span></button><button class="menu-item" data-go="settings"><span class="menu-icon" style="background:#3b82f6">⚙</span><strong>Settings</strong><span class="chev">›</span></button><button class="menu-item" data-go="support"><span class="menu-icon" style="background:#ef6b6b">☎</span><strong>Support</strong><span class="chev">›</span></button></div><button class="secondary full" id="syncNow">Synchronize now</button>`}
function badge(){const u=currentUser();header('Auditor Badge');return `<div class="screen-title"><button class="back" data-go="home">‹</button><h2>Auditor Badge</h2></div><div class="card badge-card"><div class="badge-head"><span>EWPros</span><span class="badge-brand">A</span></div><div class="badge-body"><div style="display:flex;justify-content:space-between;align-items:center"><div><h2>${u.name}</h2><div class="small">Badge Number</div><strong>${u.id}</strong><p class="small">Credentials<br><strong>${u.credential}</strong></p></div>${avatar(u,true)}</div><p style="text-align:center;font-weight:700">Expertise. Experience. Accuracy.</p><canvas id="qr" class="qr" width="130" height="130"></canvas></div></div>`}
function drawPseudoQR(){const c=$('#qr');if(!c)return;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,130,130);x.fillStyle='#d50032';let seed=[...`${currentUser().id}-${currentUser().name}`].reduce((a,c)=>a+c.charCodeAt(0),0);for(let r=0;r<21;r++)for(let col=0;col<21;col++){seed=(seed*9301+49297)%233280;if(seed/233280>.48)x.fillRect(col*6+2,r*6+2,5,5)}[[0,0],[14,0],[0,14]].forEach(([a,b])=>{x.fillStyle='#d50032';x.fillRect(a*6+2,b*6+2,42,42);x.fillStyle='#fff';x.fillRect(a*6+8,b*6+8,30,30);x.fillStyle='#d50032';x.fillRect(a*6+14,b*6+14,18,18)})}
function audits(){header('Notifications');return `<div class="screen-title"><button class="back" data-go="home">‹</button><h2>Notifications</h2></div><div class="card">${load('aw_notifications',[]).map(n=>`<div class="note-item"><div class="bell">♟</div><div><strong>${n.title}</strong><div class="small">${n.body}</div><div class="small muted">${n.date}</div></div></div>`).join('')}</div>`}
function settings(){header('Settings');const opts=['Push notifications are enabled','Photo gallery write access is enabled','Photo gallery read access is enabled','Camera access is enabled'];return `<div class="screen-title"><button class="back" data-go="home">‹</button><h2>Settings</h2></div><div class="card"><h3 style="color:var(--red)">Notifications</h3>${opts.map((o,i)=>`<div class="status-line"><span>${o}</span><span class="toggle on"></span></div>`).join('')}<div class="status-line"><span>Offline storage</span><span class="pill">Ready</span></div><div class="status-line"><span>Pending data sync items</span><strong>${load('aw_queue',0)}</strong></div><div class="status-line"><span>Pending email notifications</span><strong>${emailQueue().length}</strong></div></div><button class="primary full" id="installAction">Install on this device</button>`}
function support(){header('Inspection Wizard');return `<div class="screen-title"><button class="back" data-go="home">‹</button><h2>Inspection Wizard</h2></div><div class="card" style="text-align:center"><h3>Need Support?</h3><p>We're here to help.</p><p>Call Toll Free <a href="tel:8884075407" style="color:var(--red);font-weight:800">(888) 407-5407</a></p><p>Call Admin <a href="tel:8889808407" style="color:var(--red);font-weight:800">(888) 980-8407</a></p><p><a href="mailto:support@ewpros.com">support@ewpros.com</a></p></div>`}
function appointmentsView(){header('Appointments');const query=state.appointmentSearch.trim().toLowerCase();const list=appointments().filter(a=>{if(state.appointmentFilter==='active'&&a.status==='cancelled')return false;if(state.appointmentFilter==='completed'&&a.status!=='completed')return false;const haystack=[a.customer,a.address,a.id,a.externalTaskId,a.contactName,a.phone,a.account,a.utility,a.auditorName].join(' ').toLowerCase();return !query||haystack.includes(query)});return `<div class="appointment-heading"><div><h2>Appointments</h2><div class="small muted">Choose the customer appointment you are visiting.</div></div><span class="pill">${list.length} shown</span></div><div class="card appointment-tools"><input id="appointmentSearch" type="search" value="${esc(state.appointmentSearch)}" placeholder="Search customer, address, phone, Task ID…"><select id="appointmentFilter"><option value="active" ${state.appointmentFilter==='active'?'selected':''}>Active appointments</option><option value="all" ${state.appointmentFilter==='all'?'selected':''}>All appointments</option><option value="completed" ${state.appointmentFilter==='completed'?'selected':''}>Completed on this device</option></select></div>${list.length?list.map(a=>{let done=Object.values(a.tasks).filter(Boolean).length;return `<div class="card appt" data-open-appt="${esc(a.id)}"><div style="display:flex;justify-content:space-between;gap:10px"><span class="pill">⚡ Appointment</span><span class="utility-badge utility-${esc(normalizeUtilityName(a.utility).toLowerCase()||'unknown')}">${esc(utilityLabel(a))}</span><strong title="Asana Task ${esc(a.externalTaskId||a.id)}">${esc(shortAppointmentId(a))}</strong></div><h3>${esc(a.customer)}</h3>${a.contactName?`<div class="small"><strong>Contact:</strong> ${esc(a.contactName)}${a.phone?` · ${esc(a.phone)}`:''}</div>`:''}${a.auditorName?`<div class="small muted">Asana assignee: ${esc(a.auditorName)}</div>`:''}<div class="meta"><div>📅 ${esc(a.date||'Not scheduled')}<br>🕒 ${esc(a.time||'Time not specified')}</div><div>📍 ${esc(a.address)}</div></div>${a.utility||a.account?`<div class="small muted appointment-account">${esc(a.utility||'Utility')} account: ${esc(a.account||'Not listed')}</div>`:''}<div class="progress"><div class="step"><span class="dot ${a.status!=='assigned'?'done':''}"></span>Day of Appointment</div><span class="connector"></span><div class="step"><span class="dot ${['checked-in','ready','completed'].includes(a.status)?'done':''}"></span>Checked In</div><span class="connector"></span><div class="step"><span class="dot ${done===5?'done':''}"></span>Ready to Check Out</div></div><div class="small muted" style="margin-top:10px">${done}/5 required sections complete · ${a.synced?'Synced':'Waiting to sync'}${a.status==='completed'?` · Email: ${a.emailStatus==='sent'?'Sent':a.emailStatus==='failed'?'Retry pending':'Queued'}`:''}</div></div>`}).join(''):'<div class="card empty">No appointments match your search.</div>'}`}

function taskRow(key,label){const a=getAppt();const done=a.tasks[key];return `<div class="task" data-task="${key}"><span class="task-icon">●</span><strong>${label}</strong><span class="task-status ${done?'done':''}">${done?'✓':'!'}</span></div>`}
function appointmentDetail(){const a=getAppt();if(!a){header('Appointment');return '<p>Appointment not found.</p>'}header(shortAppointmentId(a));const all=Object.values(a.tasks).every(Boolean);const program=utilityForAudit(a)||normalizeUtilityName(a.utility);const programText=program||'Utility';const exportLabel=a.status==='completed'?`Share ${programText} T&C & CSV again`:`Preview ${programText} T&C & CSV`;return `<div class="screen-title"><button class="back" data-go="appointments">‹</button><div><h2 style="margin:0">${esc(a.customer)}</h2><div class="small muted">${esc(shortAppointmentId(a))} · ${esc(a.address)}</div></div></div><div class="card utility-summary"><strong>Utility Program</strong><span class="utility-badge utility-${esc((program||'unknown').toLowerCase())}">${esc(program||'Not identified')}</span><div class="small muted">Imported from the Asana Description. Confirm this before the customer signs.</div></div>${a.contactName||a.phone||a.email?`<div class="card appointment-contact"><strong>Customer contact</strong><div class="small">${esc(a.contactName||a.customer)}</div>${a.phone?`<a href="tel:${esc(a.phone)}">${esc(a.phone)}</a>`:''}${a.email?`<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>`:''}</div>`:''}<div class="card"><div class="toolbar"><button class="secondary" id="checkin">${a.status==='assigned'?'Check in':'Checked in ✓'}</button><button class="secondary" id="exportAudit">${exportLabel}</button></div>${taskRow('confirm','Confirm Address & Account #')}${taskRow('front','Picture of Building Front')}${taskRow('interior','Interior Equipment')}${taskRow('exterior','Exterior Equipment')}${taskRow('terms','Customer T & C')}</div>${a.status==='completed'?`<div class="card"><strong>Submission status</strong><div class="small muted">Signed utility: ${esc(a.signedUtility||programText)} · Form version: ${esc(a.templateVersion||'Not recorded')}</div><div class="small muted">Email: ${a.emailStatus==='sent'?'Sent successfully':a.emailStatus==='failed'?`Retry pending: ${esc(a.emailError||'Temporary error')}`:'Queued for sending'}</div><div class="small muted">Files: ${a.fileExportStatus==='shared'?'Shared from this device':a.fileExportStatus==='downloaded'?'Downloaded to this device':a.fileExportStatus==='cancelled'?'Share cancelled - tap below to retry':a.fileExportStatus==='failed'?'Generation failed - tap below to retry':'Ready to share'}</div></div><button class="primary full" id="shareCompletedAudit">Share ${programText} T&C & CSV again</button>`:`<button class="primary full" id="checkout" ${all&&program?'':'disabled'} style="opacity:${all&&program?1:.45}">${all&&program?`Submit Audit & Share ${programText} T&C + CSV`:'Complete all sections and confirm utility'}</button>`}`}

function getAppt(){return appointments().find(a=>a.id===state.selectedAppointment)}
function mutateAppt(fn){const arr=appointments();const i=arr.findIndex(a=>a.id===state.selectedAppointment);fn(arr[i]);arr[i].synced=false;setAppointments(arr);markDirty()}
function confirmView(){const a=getAppt();header('Confirm Appointment');return `<div class="screen-title"><button class="back" data-go="appointment">‹</button><h2>Confirm Address & Account</h2></div><div class="card"><div class="field"><label>Customer</label><input id="cust" value="${esc(a.customer)}"></div><div class="field"><label>Service Address</label><textarea id="addr">${esc(a.address)}</textarea></div><div class="field"><label>Utility Account Number</label><input id="acct" value="${esc(a.account||'')}" placeholder="Enter account number"></div><label class="checkline"><input id="verified" type="checkbox" ${a.tasks.confirm?'checked':''}> I verified the address and account number</label></div><button class="primary full" id="saveConfirm">Save section</button>`}

function frontView(){const a=getAppt();header('Building Front');return `<div class="screen-title"><button class="back" data-go="appointment">‹</button><h2>Picture of Building Front</h2></div><div class="card"><div class="field"><label>Take or select photo</label><input id="frontPhoto" type="file" accept="image/*" capture="environment"></div>${a.photos.front?`<img class="photo-preview" src="${a.photos.front}">`:'<div class="empty">No photo added</div>'}</div><button class="primary full" id="saveFront">Save section</button>`}
function lightingCodeOptions(item){const codes=lightingCatalog()[item.deviceCategory]||[];const options=['<option value="">Select code</option>',...codes.map(code=>`<option value="${esc(code)}" ${item.deviceCode===code?'selected':''}>${esc(code)}</option>`),'<option value="__manual__">Other / enter manually</option>'];return options.join('')}
function lightingRowsView(a){const rows=(a.equipment.interior||[]).map((item,index)=>({item,index})).filter(row=>row.item.kind==='lighting');if(!rows.length)return '<div class="card empty">No lighting lines have been added.</div>';return `<div class="lighting-table-wrap"><table class="lighting-table"><thead><tr><th>Ln#</th><th>Location</th><th>&gt;300SF</th><th>Existing Device Category</th><th>Existing Device Code</th><th>Qty</th><th>Image</th><th>Actions</th></tr></thead><tbody>${rows.map(({item,index},line)=>{const codes=lightingCatalog()[item.deviceCategory]||[];const manual=item.manualCode||(!codes.length&&item.deviceCategory);return `<tr><td class="line-number">${line+1}</td><td><input data-lighting-field="location" data-lighting-index="${index}" value="${esc(item.location||'')}" placeholder="Room / area"></td><td><select data-lighting-field="over300sf" data-lighting-index="${index}"><option value="">Select</option><option value="Yes" ${item.over300sf==='Yes'?'selected':''}>Yes</option><option value="No" ${item.over300sf==='No'?'selected':''}>No</option></select></td><td><select data-lighting-category data-lighting-index="${index}"><option value="">Select category</option>${Object.keys(lightingCatalog()).map(category=>`<option value="${esc(category)}" ${item.deviceCategory===category?'selected':''}>${esc(category)}</option>`).join('')}</select></td><td><select data-lighting-code data-lighting-index="${index}" ${!item.deviceCategory?'disabled':''}>${lightingCodeOptions(item)}</select>${manual?`<input class="manual-code" data-lighting-manual-code data-lighting-index="${index}" value="${esc(item.deviceCode||'')}" placeholder="Enter device code">`:''}</td><td><input class="qty-input" data-lighting-field="quantity" data-lighting-index="${index}" type="number" min="1" value="${Number(item.quantity)||1}"></td><td><label class="camera-button">📷 ${item.photo?'Retake':'Take photo'}<input data-lighting-photo data-lighting-index="${index}" type="file" accept="image/*" capture="environment"></label>${item.photo?`<img class="lighting-thumb" src="${item.photo}" alt="Equipment photo"><button class="link-button" type="button" data-remove-lighting-photo="${index}">Remove</button>`:''}</td><td><div class="lighting-actions"><button class="secondary compact" type="button" data-duplicate-lighting="${index}">Duplicate</button><button class="danger compact" type="button" data-delete-lighting="${index}">Delete</button></div></td></tr>`}).join('')}</tbody></table></div>`}
function equipmentView(type){const a=getAppt();header(type==='interior'?'Interior Equipment':'Exterior Equipment');if(type==='interior'){const mode=state.interiorMode||'hvac';const hvacRows=(a.equipment.interior||[]).map((item,index)=>({item,index})).filter(row=>row.item.kind!=='lighting');return `<div class="screen-title"><button class="back" data-go="appointment">‹</button><h2>Interior Equipment</h2></div><div class="equipment-mode-switch"><button class="${mode==='hvac'?'active':''}" type="button" data-interior-mode="hvac">HVAC</button><button class="${mode==='lighting'?'active':''}" type="button" data-interior-mode="lighting">Lighting</button></div>${mode==='lighting'?`<div class="card lighting-intro"><strong>Existing Lighting Inventory</strong><div class="small muted">Add one line per fixture group. Device codes depend on the selected category. Photos are included as supporting files when the audit is shared.</div></div><div class="toolbar"><button class="primary" id="addLightingLine">+ Add line</button></div>${lightingRowsView(a)}`:`<div class="toolbar"><button class="primary" id="addEquipment">+ Add HVAC equipment</button></div>${hvacRows.length?hvacRows.map(({item:e,index:i})=>`<div class="card equipment"><h4>${esc(e.category||'HVAC')} — ${esc(e.type||'Unspecified')}</h4><div class="small">${esc(e.manufacturer||'')} ${esc(e.model||'')}</div><div class="small muted">Location: ${esc(e.location||'Not entered')} · Qty: ${esc(e.quantity||1)}</div><div class="toolbar"><button class="secondary" data-edit-eq="${i}">Edit</button><button class="danger" data-delete-eq="${i}">Delete</button></div></div>`).join(''):'<div class="card empty">No HVAC equipment has been added.</div>'}`}<div class="toolbar"><button class="secondary" id="noEquipment">No interior equipment present</button></div><button class="primary full" id="finishEquipment" ${(a.equipment.interior||[]).length||a.noEquipment?.interior?'':'disabled'}>Save Interior Equipment section</button>`}const items=a.equipment[type]||[];return `<div class="screen-title"><button class="back" data-go="appointment">‹</button><h2>Exterior Equipment</h2></div><div class="toolbar"><button class="primary" id="addEquipment">+ Add equipment</button><button class="secondary" id="noEquipment">No equipment present</button></div>${items.length?items.map((e,i)=>`<div class="card equipment"><h4>${esc(e.category||'Equipment')} — ${esc(e.type||'Unspecified')}</h4><div class="small">${esc(e.manufacturer||'')} ${esc(e.model||'')}</div><div class="small muted">Location: ${esc(e.location||'Not entered')} · Qty: ${esc(e.quantity||1)}</div><div class="toolbar"><button class="secondary" data-edit-eq="${i}">Edit</button><button class="danger" data-delete-eq="${i}">Delete</button></div></div>`).join(''):'<div class="card empty">No equipment has been added.</div>'}<button class="primary full" id="finishEquipment" ${items.length||a.noEquipment?.[type]?'':'disabled'}>Save section</button>`}

function equipmentForm(type,index=null){const a=getAppt(),e=index===null?{}:a.equipment[type][index];header('Equipment Entry');return `<div class="screen-title"><button class="back" data-go="${type}">‹</button><h2>${index===null?'Add':'Edit'} ${type==='interior'?'HVAC ':''}Equipment</h2></div><form id="eqForm" class="card"><div class="row"><div class="field"><label>Category</label><select id="eqCategory"><option ${e.category==='HVAC'?'selected':''}>HVAC</option><option ${e.category==='Water Heating'?'selected':''}>Water Heating</option><option ${e.category==='Refrigeration'?'selected':''}>Refrigeration</option><option ${e.category==='Other'?'selected':''}>Other</option></select></div><div class="field"><label>Equipment type</label><input id="eqType" value="${esc(e.type||'')}" placeholder="Heat pump"></div></div><div class="row"><div class="field"><label>Manufacturer</label><input id="eqMfr" value="${esc(e.manufacturer||'')}"></div><div class="field"><label>Model</label><input id="eqModel" value="${esc(e.model||'')}"></div></div><div class="row"><div class="field"><label>Serial number</label><input id="eqSerial" value="${esc(e.serial||'')}"></div><div class="field"><label>Quantity</label><input id="eqQty" type="number" min="1" value="${e.quantity||1}"></div></div><div class="field"><label>Location</label><input id="eqLocation" value="${esc(e.location||'')}"></div><div class="row"><div class="field"><label>Capacity</label><input id="eqCapacity" value="${esc(e.capacity||'')}" placeholder="3 tons"></div><div class="field"><label>Efficiency</label><input id="eqEfficiency" value="${esc(e.efficiency||'')}" placeholder="16 SEER"></div></div><div class="field"><label>Condition</label><select id="eqCondition"><option ${e.condition==='Good'?'selected':''}>Good</option><option ${e.condition==='Fair'?'selected':''}>Fair</option><option ${e.condition==='Poor'?'selected':''}>Poor</option><option ${e.condition==='Not operating'?'selected':''}>Not operating</option></select></div><div class="field"><label>Notes</label><textarea id="eqNotes">${esc(e.notes||'')}</textarea></div><button class="primary full" type="submit">Save equipment</button></form>`}

function termsView(){const a=getAppt();const imported=normalizeUtilityName(a.utility);const selected=a.signedUtility||imported;header('Customer T & C');const utilityControl=selected?`<div class="utility-confirm"><span class="utility-badge utility-${selected.toLowerCase()}">${selected}</span><div><strong>${selected} Terms & Conditions</strong><div class="small muted">${a.signedUtility?'Locked when the customer signed.':'Selected automatically from the Asana Description.'}</div></div></div>`:`<div class="field"><label>Utility program</label><select id="termsUtility"><option value="">Select utility</option><option value="BGE">BGE</option><option value="PEPCO">PEPCO</option></select><div class="small muted">The Asana Description did not contain a recognized utility. Confirm before signing.</div></div>`;const explanation=selected==='PEPCO'?'The customer signature will be placed in both the PEPCO Customer Acknowledgement and Service Provider payment authorization signature sections.':selected==='BGE'?'The signature will be placed in the BGE Authorized Representative Signature section, with EWPros as the rebate assignee.':'The selected utility form will be filled and signed.';return `<div class="screen-title"><button class="back" data-go="appointment">‹</button><h2>Customer Terms & Conditions</h2></div><div class="card">${utilityControl}<p class="small">${explanation}</p><div class="field"><label>Authorized representative name</label><input id="signName" value="${esc(a.signatureName||a.contactName||a.customer)}"></div><label class="checkline"><input id="acceptTerms" type="checkbox" ${a.tasks.terms?'checked':''}> Customer accepts the applicable Terms and Conditions</label><div class="field signature-field"><div class="signature-label-row"><label>Customer signature</label><button class="secondary compact" type="button" id="clearSignature">Clear</button></div><canvas id="signaturePad" class="signature-pad" aria-label="Customer signature pad"></canvas><div class="small muted">Use a finger or Apple Pencil to sign inside the box.</div></div></div><button class="primary full" id="saveTerms">Save section</button>`}

let signaturePadState={dirty:false,hasInk:false};
function setupSignaturePad(){
  const canvas=$('#signaturePad');if(!canvas)return;
  const audit=getAppt();const ratio=Math.max(1,window.devicePixelRatio||1);const cssWidth=Math.max(280,canvas.clientWidth||520);const cssHeight=150;
  canvas.width=Math.round(cssWidth*ratio);canvas.height=Math.round(cssHeight*ratio);canvas.style.height=`${cssHeight}px`;
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#111827';ctx.lineWidth=2.4;ctx.fillStyle='#fff';ctx.fillRect(0,0,cssWidth,cssHeight);
  signaturePadState={dirty:false,hasInk:false};
  const drawExisting=()=>{if(!audit.signatureImage)return;const image=new Image();image.onload=()=>{ctx.drawImage(image,0,0,cssWidth,cssHeight);signaturePadState.hasInk=true};image.src=audit.signatureImage};drawExisting();
  let drawing=false,last=null;
  const point=e=>{const rect=canvas.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top}};
  const start=e=>{e.preventDefault();drawing=true;last=point(e);canvas.setPointerCapture?.(e.pointerId)};
  const move=e=>{if(!drawing)return;e.preventDefault();const p=point(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;signaturePadState.dirty=true;signaturePadState.hasInk=true};
  const stop=e=>{if(!drawing)return;e.preventDefault();drawing=false;last=null;try{canvas.releasePointerCapture?.(e.pointerId)}catch{}};
  canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('pointerleave',e=>{if(e.buttons===0)stop(e)});
  $('#clearSignature')?.addEventListener('click',()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,cssWidth,cssHeight);signaturePadState.dirty=true;signaturePadState.hasInk=false});
}
function signaturePadDataUrl(){
  const canvas=$('#signaturePad');if(!canvas||!signaturePadState.hasInk)return '';
  const ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height);let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
  for(let y=0;y<canvas.height;y+=1)for(let x=0;x<canvas.width;x+=1){const i=(y*canvas.width+x)*4;if(data.data[i]<235||data.data[i+1]<235||data.data[i+2]<235){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}}
  if(maxX<minX||maxY<minY)return '';
  const pad=Math.round(10*(window.devicePixelRatio||1));minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(canvas.width-1,maxX+pad);maxY=Math.min(canvas.height-1,maxY+pad);
  const out=document.createElement('canvas');out.width=maxX-minX+1;out.height=maxY-minY+1;const outCtx=out.getContext('2d');outCtx.fillStyle='#fff';outCtx.fillRect(0,0,out.width,out.height);outCtx.drawImage(canvas,minX,minY,out.width,out.height,0,0,out.width,out.height);return out.toDataURL('image/png')
}
function render(){if(!state.user)return;$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.route===state.route || (state.route==='appointment'&&b.dataset.route==='appointments')));let html='';switch(state.route){case'home':html=home();break;case'badge':html=badge();break;case'audits':html=audits();break;case'settings':html=settings();break;case'support':html=support();break;case'appointments':html=appointmentsView();break;case'appointment':html=appointmentDetail();break;case'confirm':html=confirmView();break;case'front':html=frontView();break;case'interior':html=equipmentView('interior');break;case'exterior':html=equipmentView('exterior');break;case'eqform':html=equipmentForm(state.eqType,state.eqIndex);break;case'terms':html=termsView();break}$('#view').innerHTML=html;bind();if(state.route==='badge')drawPseudoQR();if(state.route==='terms')setupSignaturePad()}
function bind(){$$('[data-go]').forEach(x=>x.onclick=()=>setRoute(x.dataset.go));$$('.nav-btn').forEach(x=>x.onclick=()=>setRoute(x.dataset.route));$$('[data-open-appt]').forEach(x=>x.onclick=()=>setRoute('appointment',x.dataset.openAppt));$('#appointmentSearch')?.addEventListener('input',e=>{state.appointmentSearch=e.target.value;const position=e.target.selectionStart;render();const input=$('#appointmentSearch');input?.focus();input?.setSelectionRange(position,position)});$('#appointmentFilter')?.addEventListener('change',e=>{state.appointmentFilter=e.target.value;render()});$('#syncNow')?.addEventListener('click',syncNow);$('#installAction')?.addEventListener('click',installApp);$('#checkin')?.addEventListener('click',()=>{mutateAppt(a=>a.status='checked-in');render()});
$$('[data-task]').forEach(x=>x.onclick=()=>setRoute(x.dataset.task));
$('#saveConfirm')?.addEventListener('click',()=>{if(!$('#acct').value.trim()||!$('#verified').checked)return toast('Enter account number and verify the information');mutateAppt(a=>{a.customer=$('#cust').value;a.address=$('#addr').value;a.account=$('#acct').value;a.tasks.confirm=true});setRoute('appointment')});
let pendingPhoto=null;$('#frontPhoto')?.addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;toast('Preparing photo for the audit PDF…');try{pendingPhoto=await window.EWProsAuditExport.normalizeImageFileToJpeg(f);const old=$('.photo-preview');if(old)old.src=pendingPhoto;else e.target.closest('.card').insertAdjacentHTML('beforeend',`<img class="photo-preview" src="${pendingPhoto}">`);toast('Photo ready.')}catch(error){console.error('[Photo]',error);toast('Could not prepare that photo. Please try another image.')}});$('#saveFront')?.addEventListener('click',()=>{const a=getAppt();if(!pendingPhoto&&!a.photos.front)return toast('Add a building-front photo');mutateAppt(a=>{if(pendingPhoto)a.photos.front=pendingPhoto;a.tasks.front=true});setRoute('appointment')});
$$('[data-interior-mode]').forEach(button=>button.onclick=()=>{state.interiorMode=button.dataset.interiorMode;render()});
$('#addLightingLine')?.addEventListener('click',()=>{mutateAppt(a=>{a.noEquipment=a.noEquipment||{};a.noEquipment.interior=false;a.equipment.interior.push(newLightingItem())});render()});
$('#addEquipment')?.addEventListener('click',()=>{state.eqType=state.route;state.eqIndex=null;setRoute('eqform')});$$('[data-edit-eq]').forEach(x=>x.onclick=()=>{state.eqType=state.route;state.eqIndex=Number(x.dataset.editEq);setRoute('eqform')});$$('[data-delete-eq]').forEach(x=>x.onclick=()=>{if(confirm('Delete this equipment record?')){mutateAppt(a=>a.equipment[state.route].splice(Number(x.dataset.deleteEq),1));render()}});$('#noEquipment')?.addEventListener('click',()=>{mutateAppt(a=>{a.noEquipment=a.noEquipment||{};a.noEquipment[state.route]=true});render();toast('Marked as no equipment present')});$('#finishEquipment')?.addEventListener('click',()=>{const type=state.route;mutateAppt(a=>a.tasks[type]=true);setRoute('appointment')});
$$('[data-lighting-field]').forEach(input=>input.addEventListener('change',()=>{const index=Number(input.dataset.lightingIndex),field=input.dataset.lightingField;mutateAppt(a=>{const item=a.equipment.interior[index];if(!item)return;item[field]=field==='quantity'?(Number(input.value)||1):input.value})}));
$$('[data-lighting-category]').forEach(input=>input.addEventListener('change',()=>{const index=Number(input.dataset.lightingIndex);mutateAppt(a=>{const item=a.equipment.interior[index];if(!item)return;item.deviceCategory=input.value;item.deviceCode='';item.manualCode=!(lightingCatalog()[input.value]||[]).length});render()}));
$$('[data-lighting-code]').forEach(input=>input.addEventListener('change',()=>{const index=Number(input.dataset.lightingIndex);mutateAppt(a=>{const item=a.equipment.interior[index];if(!item)return;if(input.value==='__manual__'){item.manualCode=true;item.deviceCode=''}else{item.manualCode=false;item.deviceCode=input.value}});render()}));
$$('[data-lighting-manual-code]').forEach(input=>input.addEventListener('change',()=>{const index=Number(input.dataset.lightingIndex);mutateAppt(a=>{const item=a.equipment.interior[index];if(!item)return;item.manualCode=true;item.deviceCode=input.value.trim()})}));
$$('[data-lighting-photo]').forEach(input=>input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;const index=Number(input.dataset.lightingIndex);toast('Preparing lighting photo…');try{const photo=await window.EWProsAuditExport.normalizeImageFileToJpeg(file,1000,.72);mutateAppt(a=>{const item=a.equipment.interior[index];if(item)item.photo=photo});render();toast('Lighting photo saved.')}catch(error){console.error('[Lighting Photo]',error);toast('Could not prepare that photo. Try another image.')}}));
$$('[data-remove-lighting-photo]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.removeLightingPhoto);mutateAppt(a=>{const item=a.equipment.interior[index];if(item)item.photo=null});render()});
$$('[data-duplicate-lighting]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.duplicateLighting);mutateAppt(a=>{const source=a.equipment.interior[index];if(!source)return;const copy={...source,photo:null,location:source.location||''};a.equipment.interior.splice(index+1,0,copy)});render();toast('Lighting line duplicated. Add a new photo if needed.')});
$$('[data-delete-lighting]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.deleteLighting);if(confirm('Delete this lighting line?')){mutateAppt(a=>a.equipment.interior.splice(index,1));render()}});
$('#eqForm')?.addEventListener('submit',e=>{e.preventDefault();const obj={kind:state.eqType==='interior'?'hvac':'equipment',category:$('#eqCategory').value,type:$('#eqType').value,manufacturer:$('#eqMfr').value,model:$('#eqModel').value,serial:$('#eqSerial').value,quantity:Number($('#eqQty').value)||1,location:$('#eqLocation').value,capacity:$('#eqCapacity').value,efficiency:$('#eqEfficiency').value,condition:$('#eqCondition').value,notes:$('#eqNotes').value};mutateAppt(a=>{a.noEquipment=a.noEquipment||{};a.noEquipment[state.eqType]=false;if(state.eqIndex===null)a.equipment[state.eqType].push(obj);else a.equipment[state.eqType][state.eqIndex]=obj});setRoute(state.eqType)});
$('#saveTerms')?.addEventListener('click',()=>{const name=$('#signName').value.trim();const image=signaturePadDataUrl();const current=getAppt();const existing=current.signatureImage;const program=current.signedUtility||normalizeUtilityName(current.utility)||$('#termsUtility')?.value;if(!program)return toast('Select BGE or PEPCO before saving the T&C section');if(!$('#acceptTerms').checked||!name||(!image&&!existing))return toast('Customer name, acceptance, and signature are required');mutateAppt(a=>{a.signatureName=name;a.signature=name;a.signatureImage=image||existing;a.signatureDate=new Date().toISOString();a.signedUtility=program;a.templateVersion=termsTemplateVersion(program);a.tasks.terms=true});setRoute('appointment')});
$('#checkout')?.addEventListener('click',completeAuditAndShare);$('#shareCompletedAudit')?.addEventListener('click',()=>shareAuditFiles(getAppt()));$('#exportAudit')?.addEventListener('click',()=>shareAuditFiles(getAppt()));}

async function installApp(){if(state.deferredPrompt){state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null}else toast('Use your browser menu and choose “Add to Home Screen”')}
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();const u=$('#username').value.trim().toLowerCase(),p=$('#password').value;if(!USERS[u]||USERS[u].password!==p){$('#loginError').textContent='Invalid username or password';$('#loginError').classList.remove('hidden');return}state.user=u;save('aw_session',u);$('#login').classList.add('hidden');$('#app').classList.remove('hidden');updateNetwork();render();loadRemoteAppointments(true)});
$('#logoutBtn').onclick=()=>{localStorage.removeItem('aw_session');state.user=null;$('#app').classList.add('hidden');$('#login').classList.remove('hidden')};$('#installBtn').onclick=installApp;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredPrompt=e});window.addEventListener('online',()=>{updateNetwork();syncNow(false)});window.addEventListener('offline',updateNetwork);
setInterval(()=>processEmailQueue(),60000);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');const session=load('aw_session',null);if(session&&USERS[session]){state.user=session;$('#login').classList.add('hidden');$('#app').classList.remove('hidden');updateNetwork();render();if(navigator.onLine){loadRemoteAppointments(false);processEmailQueue()}}
