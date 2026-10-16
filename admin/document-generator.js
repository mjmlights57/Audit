(() => {
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
  const today = () => new Date().toISOString().slice(0,10);
  const addDays = (dateText, days) => { const d=new Date(`${dateText}T12:00:00`); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };
  const brandInfo = {
    EWPros:{name:'EWPros, LLC',tagline:'Electrical Service Proposal',address1:'400 East Pratt Street',address2:'Baltimore, MD 21202',phone:'1800-731-6750 or 240-203-7272',email:'support@EWPros.com',prefix:'EWP'},
    MJMLight:{name:'MJMLIGHT, LLC',tagline:'Electrical Service Proposal',address1:'2950 Belcrest Center Drive',address2:'Hyattsville, MD 20782',phone:'(301) 244-9967',email:'support@mjmlight.com',prefix:'MJM'}
  };
  const defaultScope='Describe the work to be performed, including the major electrical services, installation requirements, testing, cleanup, and any customer-specific requirements.';
  const defaultTerms='All electrical work and municipal permitting will be performed by and under Master Electrician License #39858 in full compliance with NEC codes.\nPayment Schedule: 50% deposit upon contract acceptance; remaining balance due upon completion of inspections and final sign-off.\nValidity: This proposal is valid for 30 days from the date issued above.\nChange Orders: If unforeseen electrical conditions are discovered that require additional work, work will pause until the customer approves the additional billable scope.';

  function authHeaders(){return {'X-Admin-Password':sessionStorage.getItem('ewpros_admin_password')||'','Cache-Control':'no-cache','Content-Type':'application/json'};}
  async function action(payload){const r=await fetch('/.netlify/functions/business-action',{method:'POST',headers:authHeaders(),body:JSON.stringify(payload)});let b={};try{b=await r.json();}catch{}if(!r.ok)throw new Error(b.error||`Request failed (${r.status}).`);return b.data;}
  function close(){ $('#documentModal')?.classList.add('hidden'); }
  function makeNumber(brand,kind='proposal'){
    const d=new Date(); const date=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const stamp=`${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
    const base=`${brandInfo[brand]?.prefix||'DOC'}-${date}-${stamp}`; return kind==='invoice'?`${base}-INV`:base;
  }
  function customerAddress(c){return [c.service_address,[c.city,c.state_code,c.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');}
  function itemRow(item={}){return `<div class="doc-item-row"><input name="description" placeholder="Description" value="${esc(item.description||'')}" required><input name="quantity" type="number" min="0" step="0.01" value="${esc(item.quantity??1)}" aria-label="Quantity"><input name="unit_price" type="number" min="0" step="0.01" value="${esc(item.unit_price??0)}" aria-label="Unit price"><strong data-line-total>${money((Number(item.quantity)||0)*(Number(item.unit_price)||0))}</strong><button class="doc-remove-item" type="button" aria-label="Remove line item">×</button></div>`;}
  function bindItems(container){
    const recalc=()=>{let total=0;container.querySelectorAll('.doc-item-row').forEach(row=>{const q=Number(row.querySelector('[name="quantity"]')?.value)||0,p=Number(row.querySelector('[name="unit_price"]')?.value)||0,v=q*p;total+=v;row.querySelector('[data-line-total]').textContent=money(v);});const t=$('#documentTotal');if(t)t.textContent=money(total);};
    container.addEventListener('input',recalc); container.addEventListener('click',e=>{const b=e.target.closest('.doc-remove-item');if(b){b.closest('.doc-item-row')?.remove();recalc();}}); recalc();
    return recalc;
  }
  function collectItems(container){return [...container.querySelectorAll('.doc-item-row')].map(row=>({description:row.querySelector('[name="description"]').value.trim(),quantity:Number(row.querySelector('[name="quantity"]').value)||0,unit_price:Number(row.querySelector('[name="unit_price"]').value)||0})).filter(i=>i.description);}
  function setTitle(text){$('#documentModalTitle').textContent=text;$('#documentModal')?.classList.remove('hidden');}
  function projectOptions(projects,selected=''){return `<option value="">No linked project</option>`+(projects||[]).map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');}

  function openProposal({customer,projects=[],proposals=[],onSaved}){
    const brand=customer.customer_brand||'EWPros', info=brandInfo[brand]||brandInfo.EWPros, existing=null;
    setTitle(`${info.name} Proposal`);
    const editor=$('#documentEditor');
    const proposalNumber=existing?.proposal_number||makeNumber(brand,'proposal');
    editor.innerHTML=`<form id="proposalEditorForm" class="document-editor-form">
      <div class="document-summary"><span class="document-brand">${esc(info.name)}</span><span>${esc(customer.display_name)}</span></div>
      <div class="document-form-grid"><label>Proposal #<input name="proposal_number" value="${esc(proposalNumber)}" required></label><label>Date<input name="proposal_date" type="date" value="${esc(existing?.proposal_date||today())}" required></label><label>Project title<input name="project_title" value="${esc(existing?.project_title||'Electrical Service & Installation')}" required></label><label>Linked project<select name="project_id">${projectOptions(projects,existing?.project_id||'')}</select></label></div>
      <label>Scope of Work &amp; Overview<textarea name="scope_of_work" rows="6" required>${esc(existing?.scope_of_work||defaultScope)}</textarea></label>
      <div class="document-items-head"><div><strong>Itemized Line Items &amp; Labor</strong><span>Paste descriptions directly into the description fields.</span></div><button id="addProposalItem" class="button secondary" type="button">+ Add line</button></div>
      <div class="doc-item-header"><span>Description</span><span>Qty</span><span>Unit Price</span><span>Total</span><span></span></div><div id="proposalItems" class="document-items">${(existing?.line_items?.length?existing.line_items:[{description:'',quantity:1,unit_price:0}]).map(itemRow).join('')}</div>
      <div class="document-total-row"><span>Grand Total</span><strong id="documentTotal">$0.00</strong></div>
      <label>Terms &amp; Conditions<textarea name="terms_conditions" rows="6" required>${esc(existing?.terms_conditions||defaultTerms)}</textarea></label>
      <div class="document-actions"><button class="button secondary" type="button" data-doc-cancel>Cancel</button><button class="button primary" type="submit">Save &amp; Download PDF</button></div>
    </form>`;
    const items=$('#proposalItems');bindItems(items);$('#addProposalItem').onclick=()=>{items.insertAdjacentHTML('beforeend',itemRow({quantity:1,unit_price:0}));items.dispatchEvent(new Event('input',{bubbles:true}));};
    $('[data-doc-cancel]').onclick=close;
    $('#proposalEditorForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;const fd=Object.fromEntries(new FormData(form).entries());const line_items=collectItems(items);if(!line_items.length)return alert('Add at least one line item.');try{const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Saving…';const saved=await action({action:'save_proposal',customer_id:customer.id,brand,proposal_number:fd.proposal_number,proposal_date:fd.proposal_date,project_id:fd.project_id||null,project_title:fd.project_title,scope_of_work:fd.scope_of_work,terms_conditions:fd.terms_conditions,line_items});await buildProposalPdf(saved,customer);close();await onSaved?.(saved);}catch(err){alert(err.message);}finally{const b=form.querySelector('[type="submit"]');if(b){b.disabled=false;b.textContent='Save & Download PDF';}}};
  }

  function openInvoice({customer,proposal,onSaved}){
    if(!proposal)return alert('Create and save a proposal first.');
    const brand=proposal.brand||customer.customer_brand||'EWPros', info=brandInfo[brand]||brandInfo.EWPros;
    setTitle(`${info.name} Invoice`); const editor=$('#documentEditor'); const invoiceDate=today(); const invoiceNumber=`${proposal.proposal_number}-INV`;
    editor.innerHTML=`<form id="invoiceEditorForm" class="document-editor-form">
      <div class="document-summary"><span class="document-brand">${esc(info.name)}</span><span>From proposal ${esc(proposal.proposal_number)}</span></div>
      <div class="document-form-grid"><label>Invoice #<input name="invoice_number" value="${esc(invoiceNumber)}" required></label><label>Invoice date<input name="invoice_date" type="date" value="${invoiceDate}" required></label><label>Due date<input name="due_date" type="date" value="${addDays(invoiceDate,15)}"></label><label>Project title<input name="project_title" value="${esc(proposal.project_title||'Electrical Service & Installation')}" required></label></div>
      <div class="document-items-head"><div><strong>Invoice Line Items</strong><span>Auto-filled from the proposal and still editable.</span></div><button id="addInvoiceItem" class="button secondary" type="button">+ Add line</button></div>
      <div class="doc-item-header"><span>Description</span><span>Qty</span><span>Unit Price</span><span>Total</span><span></span></div><div id="invoiceItems" class="document-items">${(proposal.line_items||[]).map(itemRow).join('')}</div>
      <div class="document-total-row"><span>Amount Due</span><strong id="documentTotal">$0.00</strong></div>
      <label>Invoice notes<textarea name="notes" rows="4">Thank you for choosing ${esc(info.name)}. Payment is due by the date shown above unless otherwise agreed in writing.</textarea></label>
      <div class="document-actions"><button class="button secondary" type="button" data-doc-cancel>Cancel</button><button class="button primary" type="submit">Save &amp; Download PDF</button></div>
    </form>`;
    const items=$('#invoiceItems');bindItems(items);$('#addInvoiceItem').onclick=()=>{items.insertAdjacentHTML('beforeend',itemRow({quantity:1,unit_price:0}));items.dispatchEvent(new Event('input',{bubbles:true}));};$('[data-doc-cancel]').onclick=close;
    $('#invoiceEditorForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,fd=Object.fromEntries(new FormData(form).entries()),line_items=collectItems(items);if(!line_items.length)return alert('Add at least one invoice line item.');try{const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Saving…';const saved=await action({action:'save_invoice_from_proposal',proposal_id:proposal.id,invoice_number:fd.invoice_number,invoice_date:fd.invoice_date,due_date:fd.due_date||null,project_title:fd.project_title,notes:fd.notes,line_items});await buildInvoicePdf(saved,customer,{project_title:fd.project_title,notes:fd.notes});close();await onSaved?.(saved);}catch(err){alert(err.message);}finally{const b=form.querySelector('[type="submit"]');if(b){b.disabled=false;b.textContent='Save & Download PDF';}}};
  }

  function cleanPdfText(v){return String(v??'').replace(/[–—]/g,'-').replace(/[•▪◦]/g,'-').replace(/[^\x09\x0A\x0D\x20-\x7E]/g,'');}
  function wrapText(text,font,size,maxWidth){const out=[];for(const para of cleanPdfText(text).split(/\r?\n/)){if(!para.trim()){out.push('');continue;}const words=para.trim().split(/\s+/);let line='';for(const word of words){const test=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(test,size)<=maxWidth)line=test;else{if(line)out.push(line);line=word;}}if(line)out.push(line);}return out;}
  async function pdfContext(){if(!window.PDFLib)throw new Error('PDF generator is unavailable. Refresh the page and try again.');const {PDFDocument,StandardFonts,rgb}=window.PDFLib,pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);return{PDFDocument,StandardFonts,rgb,pdf,regular,bold};}
  function downloadBytes(bytes,filename){const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename.replace(/[^A-Za-z0-9._-]+/g,'_');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
  function makePage(ctx,brand,docType,number,date){const {pdf,bold,regular,rgb}=ctx,page=pdf.addPage([612,792]),navy=rgb(.045,.075,.14),cyan=rgb(0,.56,.78);page.drawRectangle({x:32,y:704,width:548,height:60,color:navy});page.drawText(brandInfo[brand].name,{x:44,y:736,size:18,font:bold,color:rgb(1,1,1)});page.drawText('Electrical Service',{x:44,y:720,size:8,font:regular,color:rgb(.83,.86,.91)});page.drawText(docType.toUpperCase(),{x:477,y:738,size:15,font:bold,color:cyan});page.drawText(`${docType} #: ${number}`,{x:440,y:722,size:7.5,font:regular,color:rgb(.75,.78,.84)});page.drawText(`Date: ${date}`,{x:490,y:711,size:7.5,font:regular,color:rgb(.75,.78,.84)});return page;}
  function drawLines(page,ctx,lines,x,y,size=9,maxWidth=530,lineGap=13,color){for(const line of lines){page.drawText(line||' ',{x,y,size,font:ctx.regular,color:color||ctx.rgb(.18,.21,.27)});y-=lineGap;}return y;}
  function ensurePage(doc,ctx,y,brand,type,number,date,min=100){if(y>=min)return{page:doc.page,y};const page=makePage(ctx,brand,type,number,date);return{page,y:680};}

  async function buildProposalPdf(proposal,customer){
    const ctx=await pdfContext(),brand=proposal.brand||customer.customer_brand||'EWPros',info=brandInfo[brand],doc={page:makePage(ctx,brand,'Proposal',proposal.proposal_number,proposal.proposal_date),y:675},left=44,right=320;
    const caddr=customerAddress(customer)||'—';
    doc.page.drawText('PRIME CONTRACTOR / ISSUING PARTY',{x:left,y:doc.y,size:8,font:ctx.bold,color:ctx.rgb(.08,.38,.72)});doc.page.drawText('PREPARED FOR (CUSTOMER)',{x:right,y:doc.y,size:8,font:ctx.bold,color:ctx.rgb(.08,.38,.72)});doc.y-=16;
    drawLines(doc.page,ctx,[info.name,info.address1,info.address2,`Phone: ${info.phone}`,`Email: ${info.email}`],left,doc.y,8.4,235,12);
    drawLines(doc.page,ctx,[`Customer: ${customer.display_name}`,`Property Address: ${caddr}`,`Project: ${proposal.project_title}`],right,doc.y,8.4,245,12);doc.y-=80;
    doc.page.drawText('SCOPE OF WORK & OVERVIEW',{x:left,y:doc.y,size:10,font:ctx.bold,color:ctx.rgb(.08,.11,.17)});doc.y-=17;let lines=wrapText(proposal.scope_of_work||'',ctx.regular,8.6,524);doc.y=drawLines(doc.page,ctx,lines,left,doc.y,8.6,524,12);doc.y-=13;
    let e=ensurePage(doc,ctx,doc.y,brand,'Proposal',proposal.proposal_number,proposal.proposal_date,190);doc.page=e.page;doc.y=e.y;doc.page.drawText('ITEMIZED LINE ITEMS & LABOR',{x:left,y:doc.y,size:10,font:ctx.bold,color:ctx.rgb(.08,.11,.17)});doc.y-=18;
    const cols=[left,left+28,400,475,560];doc.page.drawRectangle({x:left-4,y:doc.y-4,width:524,height:18,color:ctx.rgb(.94,.95,.97)});['#','Description','Qty','Unit Price','Total'].forEach((h,i)=>doc.page.drawText(h,{x:cols[i],y:doc.y,size:7.5,font:ctx.bold,color:ctx.rgb(.32,.35,.4)}));doc.y-=20;
    (proposal.line_items||[]).forEach((item,i)=>{let r=ensurePage(doc,ctx,doc.y,brand,'Proposal',proposal.proposal_number,proposal.proposal_date,70);doc.page=r.page;doc.y=r.y;const desc=cleanPdfText(item.description).slice(0,65);doc.page.drawText(String(i+1),{x:cols[0],y:doc.y,size:8,font:ctx.regular});doc.page.drawText(desc,{x:cols[1],y:doc.y,size:8,font:ctx.regular});doc.page.drawText(String(item.quantity),{x:cols[2],y:doc.y,size:8,font:ctx.regular});doc.page.drawText(money(item.unit_price),{x:cols[3],y:doc.y,size:8,font:ctx.regular});doc.page.drawText(money(item.line_total),{x:cols[4]-ctx.bold.widthOfTextAtSize(money(item.line_total),8),y:doc.y,size:8,font:ctx.bold});doc.y-=17;});
    doc.y-=6;let r=ensurePage(doc,ctx,doc.y,brand,'Proposal',proposal.proposal_number,proposal.proposal_date,150);doc.page=r.page;doc.y=r.y;doc.page.drawRectangle({x:410,y:doc.y-34,width:158,height:46,color:ctx.rgb(.045,.075,.14)});doc.page.drawText('GRAND TOTAL',{x:492,y:doc.y-4,size:8,font:ctx.regular,color:ctx.rgb(.73,.77,.84)});const totalText=money(proposal.total);doc.page.drawText(totalText,{x:558-ctx.bold.widthOfTextAtSize(totalText,16),y:doc.y-24,size:16,font:ctx.bold,color:ctx.rgb(0,.67,.9)});doc.y-=58;
    doc.page.drawText('TERMS & CONDITIONS',{x:left,y:doc.y,size:10,font:ctx.bold});doc.y-=17;lines=wrapText(proposal.terms_conditions||'',ctx.regular,8.1,524);for(const line of lines){r=ensurePage(doc,ctx,doc.y,brand,'Proposal',proposal.proposal_number,proposal.proposal_date,55);doc.page=r.page;doc.y=r.y;doc.page.drawText(line||' ',{x:left,y:doc.y,size:8.1,font:ctx.regular,color:ctx.rgb(.3,.33,.38)});doc.y-=11;}
    r=ensurePage(doc,ctx,doc.y-15,brand,'Proposal',proposal.proposal_number,proposal.proposal_date,70);doc.page=r.page;doc.y=r.y-10;doc.page.drawText(`PREPARED BY: ${info.name}`,{x:left,y:doc.y,size:8,font:ctx.bold});doc.page.drawText(`ACCEPTED BY: ${cleanPdfText(customer.display_name)}`,{x:330,y:doc.y,size:8,font:ctx.bold});doc.y-=28;doc.page.drawText('Authorized Signature: ______________________',{x:left,y:doc.y,size:8,font:ctx.regular});doc.page.drawText('Client Signature: __________________________',{x:330,y:doc.y,size:8,font:ctx.regular});doc.y-=28;doc.page.drawText('Date: __________________________',{x:left,y:doc.y,size:8,font:ctx.regular});doc.page.drawText('Date: __________________________',{x:330,y:doc.y,size:8,font:ctx.regular});
    const bytes=await ctx.pdf.save();downloadBytes(bytes,`${proposal.proposal_number}_${customer.display_name}_Proposal.pdf`);
  }

  async function buildInvoicePdf(invoice,customer,extra={}){
    const proposal=invoice.proposal||{},brand=proposal.brand||customer.customer_brand||'EWPros',info=brandInfo[brand],ctx=await pdfContext(),date=invoice.invoice_date||today(),doc={page:makePage(ctx,brand,'Invoice',invoice.invoice_number,date),y:675},left=44,right=320,caddr=customerAddress(customer)||'—';
    doc.page.drawText('BILL FROM',{x:left,y:doc.y,size:8,font:ctx.bold,color:ctx.rgb(.08,.38,.72)});doc.page.drawText('BILL TO',{x:right,y:doc.y,size:8,font:ctx.bold,color:ctx.rgb(.08,.38,.72)});doc.y-=16;drawLines(doc.page,ctx,[info.name,info.address1,info.address2,`Phone: ${info.phone}`,`Email: ${info.email}`],left,doc.y,8.4,235,12);drawLines(doc.page,ctx,[customer.display_name,caddr,customer.phone||'',customer.email||''].filter(Boolean),right,doc.y,8.4,245,12);doc.y-=76;
    doc.page.drawText(`Project: ${cleanPdfText(extra.project_title||proposal.project_title||'Electrical Service & Installation')}`,{x:left,y:doc.y,size:9,font:ctx.bold});doc.page.drawText(`Proposal: ${cleanPdfText(proposal.proposal_number||'—')}`,{x:right,y:doc.y,size:8.5,font:ctx.regular});doc.y-=16;if(invoice.due_date){doc.page.drawText(`Due date: ${invoice.due_date}`,{x:right,y:doc.y,size:8.5,font:ctx.regular});}doc.y-=22;
    const cols=[left,left+28,400,475,560];doc.page.drawRectangle({x:left-4,y:doc.y-4,width:524,height:18,color:ctx.rgb(.94,.95,.97)});['#','Description','Qty','Rate','Amount'].forEach((h,i)=>doc.page.drawText(h,{x:cols[i],y:doc.y,size:7.5,font:ctx.bold,color:ctx.rgb(.32,.35,.4)}));doc.y-=20;(invoice.items||[]).forEach((item,i)=>{let r=ensurePage(doc,ctx,doc.y,brand,'Invoice',invoice.invoice_number,date,70);doc.page=r.page;doc.y=r.y;doc.page.drawText(String(i+1),{x:cols[0],y:doc.y,size:8,font:ctx.regular});doc.page.drawText(cleanPdfText(item.description).slice(0,65),{x:cols[1],y:doc.y,size:8,font:ctx.regular});doc.page.drawText(String(item.quantity),{x:cols[2],y:doc.y,size:8,font:ctx.regular});doc.page.drawText(money(item.unit_price),{x:cols[3],y:doc.y,size:8,font:ctx.regular});const amt=money(item.line_total);doc.page.drawText(amt,{x:cols[4]-ctx.bold.widthOfTextAtSize(amt,8),y:doc.y,size:8,font:ctx.bold});doc.y-=17;});doc.y-=10;doc.page.drawRectangle({x:410,y:doc.y-34,width:158,height:46,color:ctx.rgb(.045,.075,.14)});doc.page.drawText('AMOUNT DUE',{x:486,y:doc.y-4,size:8,font:ctx.regular,color:ctx.rgb(.73,.77,.84)});const total=money(invoice.total);doc.page.drawText(total,{x:558-ctx.bold.widthOfTextAtSize(total,16),y:doc.y-24,size:16,font:ctx.bold,color:ctx.rgb(0,.67,.9)});doc.y-=70;
    if(extra.notes){doc.page.drawText('NOTES',{x:left,y:doc.y,size:10,font:ctx.bold});doc.y-=16;doc.y=drawLines(doc.page,ctx,wrapText(extra.notes,ctx.regular,8.3,524),left,doc.y,8.3,524,12);}
    const bytes=await ctx.pdf.save();downloadBytes(bytes,`${invoice.invoice_number}_${customer.display_name}_Invoice.pdf`);
  }

  document.addEventListener('click',e=>{if(e.target.closest('[data-crm-close="documentModal"]'))close();if(e.target.id==='documentModal')close();});
  window.EWPROS_DOCUMENTS={openProposal,openInvoice};
})();
