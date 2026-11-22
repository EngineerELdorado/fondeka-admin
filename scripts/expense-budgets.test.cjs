const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const data = value => 'data:text/javascript;base64,' + Buffer.from(value).toString('base64');
const budgets = import(data(read('lib/expense-budgets.js'))), reports = import(data(read('lib/expense-reports.js')));
const id = '9265b38b-922e-4711-a084-d89b5ba67405';
const memory = () => { const m = new Map(); return { get length() { return m.size; }, key: i => [...m.keys()][i], getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,String(v)), removeItem: k => m.delete(k) }; };
const resource = (extra = {}) => ({ id, month: new Date().toISOString().slice(0,7), currency: 'USD', version: 0, updatedAt: new Date().toISOString(), note: null, lines: [{ expenseItemId: 1, nameEn: 'Hosting', nameFr: 'Hébergement', itemActive: true, planned: '10.00', actual: null, note: null }], totals: { planned: '10.00', actual: null }, ...extra });
test('expense decimals preserve missing/zero, credits, precision and exact totals without binary rounding', async () => {
 const h = await budgets;
 assert.equal(h.decimalAmount('', 'USD'), null); assert.equal(h.decimalAmount('0', 'USD'), '0.00'); assert.equal(h.decimalAmount('-0.10','USD'), '-0.10'); assert.equal(h.decimalAmount('0001.2','USD'), '1.20');
 assert.throws(() => h.decimalAmount('-1','USD',true)); assert.throws(() => h.decimalAmount('.001','USD')); assert.throws(() => h.decimalAmount('1.1','JPY'));
 assert.equal(h.decimalAmount('1.001','KWD'), '1.001');
 assert.deepEqual(h.draftTotals([{actual:'.10'},{actual:'.20'}].map(v=>({...v, actual:'0'+v.actual})), 'USD').actual, { amount:'0.30',entered:2 });
 assert.equal(h.draftTotals([{actual:'-1.00'},{actual:'0.10'}],'USD').actual.amount,'-0.90'); assert.equal(h.draftTotals([{actual:''}],'USD').actual.amount,null);
 assert.equal(h.draftTotals([{actual:'9999999999999999.99'},{actual:'0.01'}],'USD').actual.amount,'10000000000000000.00');
 assert.equal(h.draftTotals([{planned:'10',actual:'7.25'}], 'USD').variance, '2.75');
 assert.equal(h.draftTotals([{planned:'10',actual:''}], 'USD').variance, null);
 assert.equal(h.draftTotals([], 'USD').variance, '0.00');
});
test('budget recovery is scoped to actor and operation and only matching versioned resources confirm a write', async () => {
 const h=await budgets, original={actor:'1',key:id,operation:'updateBudget',id,request:{expectedVersion:0,lines:[]},downloadUrl:'https://do-not-store'};
 const saved=h.readBudgetIntent(JSON.stringify(original),1);assert.equal(saved.downloadUrl,undefined);assert.equal(h.readBudgetIntent(JSON.stringify(original),2),null);assert.equal(h.readBudgetIntent('{bad',1),null);
 assert.equal(h.checkedBudgetResult(resource(),saved).id,id);assert.throws(()=>h.checkedBudgetResult(resource({version:null}),saved));assert.throws(()=>h.checkedBudgetResult(resource({id:'wrong'}),saved));
 const storage=memory();storage.setItem(h.budgetRecoveryKey(1),'one');storage.setItem(h.budgetRecoveryKey(2),'two');h.clearBudgetRecovery(storage,2);assert.equal(storage.getItem(h.budgetRecoveryKey(1)),null);
});
test('monthly reports support backfill, future plans, full-month ranges, currencies and comparison independently', async () => {
 const h=await reports, form={mode:'month',month:'2027-01',currency:' cdf ',language:'fr',timeZone:'UTC',reportMode:'BUDGET_VS_ACTUAL',includeDetails:true};
 const r=h.reportRequest(form);assert.equal(r.currency,'CDF');assert.equal(r.mode,'BUDGET_VS_ACTUAL');assert.equal(r.month,'2027-01');assert.equal(r.includeDetails,true);
 assert.equal(h.reportRequest({...form,mode:'range',from:'2025-01-01',to:'2026-12-31'}).from,'2025-01-01');
 for(const change of [{mode:'range',from:'2025-01-02',to:'2025-01-31'},{mode:'range',from:'2025-01-01',to:'2025-02-27'},{mode:'range',from:'2024-12-01',to:'2026-12-31'},{currency:'BTCX'}])assert.throws(()=>h.reportRequest({...form,...change}));
 const saved=h.readReportIntent(JSON.stringify({actor:'1',key:id,request:r,jobId:id,downloadUrl:'https://do-not-store'}),1);assert.deepEqual(saved.request,r);assert.equal(saved.downloadUrl,undefined);
 const job={id,reportType:'EXPENSES',status:'COMPLETED',fromDate:'2027-01-01',toDate:'2027-01-31',...r,expiresAt:'2027-02-01T00:00:00Z'};assert.equal(h.checkedReport(job,id,r),job);
 assert.throws(()=>h.checkedReport({...job,currency:'USD'},id,r));assert.throws(()=>h.checkedReport({...job,mode:'ACTUALS'},id,r));assert.throws(()=>h.checkedReport({...job,status:'SUCCESS'},id,r));
});
test('expense API sends authentication, exact saved keys and no-store reads without initiating any payment', {concurrency:false}, async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify(resource()),{headers:{'content-type':'application/json'}});};
 try {const {api}=await import(data(read('lib/api.js'))+'#expense-test');api.setAuthToken('test-token');await api.expenses.update(id,{expectedVersion:0,lines:[]},id);await api.expenses.byMonth('2025-01','USD');await api.expenses.createReport({month:'2025-01',currency:'USD'},id);
  assert.equal(calls[0].init.headers['Idempotency-Key'],id);assert.equal(calls[0].init.method,'PUT');assert.match(calls[1].url,/expense-budgets\/by-month\?month=2025-01&currency=USD/);assert.equal(calls[1].init.method,'GET');assert.match(calls[2].url,/expense-reports\/exports$/);
  for(const call of calls){assert.equal(call.init.headers.Authorization,'Bearer test-token');assert.equal(call.init.cache,'no-store');assert.doesNotMatch(call.url,/payments|wallets|transactions/);}
 } finally {global.fetch=original;}
});
async function page(t,options={}){
 const original=Object.getOwnPropertyDescriptor(global,'sessionStorage'),storage=options.storage||memory();global.sessionStorage=storage;
 const h=await budgets,state={profile:options.profile===undefined?{id:1,role:'ADMIN'}:options.profile,posts:[],reads:0};let saved=resource();const views=[];
 const api={expenses:{items:async()=>({content:[{id:1,version:0,nameEn:'Hosting',nameFr:'Hébergement',active:true,displayOrder:1}],page:{totalPages:1}}),byMonth:async()=>{state.reads++;return saved;},update:async(order,body,key)=>{state.posts.push({order,body,key});if(options.update)return options.update(order,body,key,state.posts.length);saved=resource({version:1,lines:body.lines.map(v=>({...v,nameEn:'Hosting',itemActive:true}))});return saved;}}};
 Object.assign(api.expenses, options.expenses);
 const mount=async()=>{const view=await mountComponent(path.join(__dirname,'../app/(dashboard)/dashboard/expenses/page.js'),{props:{},modules:{'@/contexts/AuthContext':{useAuth:()=>({adminProfile:state.profile})},'@/contexts/LocaleContext':{useLocale:()=>({locale:'en'})},'@/lib/api':{api},'@/lib/expense-budgets':h,'@/components/ExpenseReportExport':{__esModule:true,default:'ReportExport'},'@/components/MonthPicker':{__esModule:true,default:'month-picker'},'./expenses.module.css':{__esModule:true,default:{}}}});views.push(view);await view.flush();return view;};
 t.after(()=>{views.forEach(v=>v.unmount());if(original)Object.defineProperty(global,'sessionStorage',original);else delete global.sessionStorage;});return {view:await mount(),mount,state,storage,h,api};
}
test('a lost budget response survives reload with exact intent and freezes other edits until replay is confirmed', {concurrency:false},async t=>{
 const p=await page(t,{update:async(order,body,key,attempt)=>{if(attempt===1)throw new Error('Lost response');return resource({version:1});}});
 const field=p.view.nodes().find(n=>n.props['aria-label']==='Actual Hosting');field.props.onChange({target:{value:'7.25'}});await p.view.flush();
 const form=p.view.nodes().find(n=>n.type==='form'&&n.props.onSubmit);await form.props.onSubmit({preventDefault(){}});await p.view.flush();
 assert.equal(p.state.posts.length,1);assert.equal(p.state.posts[0].body.lines[0].actual,'7.25');assert.ok(p.storage.getItem(p.h.budgetRecoveryKey(1)));assert.equal(p.view.nodes().find(n=>n.props['aria-label']==='Actual Hosting').props.disabled,true);
 p.view.unmount();const restored=await p.mount();const retry=restored.nodes().find(n=>n.type==='button'&&n.props.children==='Retry saved change');assert.ok(retry);await retry.props.onClick();await restored.flush();
 assert.equal(p.state.posts.length,2);assert.deepEqual(p.state.posts[0],p.state.posts[1]);assert.equal(p.storage.getItem(p.h.budgetRecoveryKey(1)),null);
});
test('non-admins cannot load financial budgets', {concurrency:false},async t=>{
 const p=await page(t,{profile:{id:2,role:'ASSISTANT'}});assert.equal(p.state.reads,0);assert.match(p.view.text(),/Admin access is required/);
});

const field = (view, label) => {
  const picker = view.nodes().find(node => node.type === 'month-picker' && node.props.label === label);
  if (picker) return { ...picker.props, onChange: event => picker.props.onChange(event.target.value) };
  return view.nodes().find(node => node.type === 'label' && node.props.children[0] === label).props.children.find(node => node?.props?.onChange).props;
};
const submitForm = async view => { await view.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await view.flush(); };

test('CSV creation requires explicit period/currency confirmation and actual figures remain an independent choice', async t => {
  const calls = [], missing = async () => { throw Object.assign(new Error('Not entered'), { status: 404 }); };
  const p = await page(t, { expenses: {
    byMonth: missing,
    template: async () => ({ plannedTotal: '20.00', actualTotal: '8.00', items: [{ expenseItemId: 1 }] }),
    create: async (body, key) => { calls.push({ body, key }); return resource({ currency: body.currency }); }
  } });
  field(p.view, 'Starting point').onChange({ target: { value: 'CSV' } }); await p.view.flush();
  assert.match(p.view.text(), /20.00/); assert.match(p.view.text(), /8.00/);
  const boxes = () => p.view.nodes().filter(node => node.type === 'input' && node.props.type === 'checkbox');
  assert.equal(boxes()[0].props.checked, false); assert.equal(boxes()[1].props.checked, false);
  assert.equal(p.view.button('Create budget').disabled, true);
  await submitForm(p.view); assert.equal(calls.length, 0);
  boxes()[1].props.onChange({ target: { checked: true } }); await p.view.flush();
  field(p.view, 'Currency').onChange({ target: { value: 'CDF' } }); await p.view.flush();
  assert.equal(boxes()[1].props.checked, false); assert.equal(p.view.button('Create budget').disabled, true);
  boxes()[0].props.onChange({ target: { checked: true } }); await p.view.flush();
  boxes()[1].props.onChange({ target: { checked: true } }); await p.view.flush();
  field(p.view, 'Monthly notes').onChange({ target: { value: 'Confirmed source figures' } }); await p.view.flush();
  await submitForm(p.view);
  assert.equal(calls.length, 1); assert.equal(calls[0].body.currency, 'CDF'); assert.equal(calls[0].body.source, 'CSV');
  assert.equal(calls[0].body.includeSourceActuals, true); assert.equal(calls[0].body.note, 'Confirmed source figures');
});

test('copying a prior plan resolves the source in the selected currency and sends no actuals', async t => {
  const calls = [], reads = [];
  const p = await page(t, { expenses: {
    byMonth: async (month, currency) => { reads.push({ month, currency }); if (month === '2025-01') return resource({ month, currency }); throw Object.assign(new Error('Not entered'), { status: 404 }); },
    create: async (body, key) => { calls.push({ body, key }); return resource(); }
  } });
  field(p.view, 'Starting point').onChange({ target: { value: 'COPY' } }); await p.view.flush();
  field(p.view, 'Source month (same currency)').onChange({ target: { value: '2025-01' } }); await p.view.flush();
  await submitForm(p.view);
  assert.equal(calls.length, 1); assert.equal(calls[0].body.copyFrom, id); assert.equal(calls[0].body.includeSourceActuals, false);
  assert.deepEqual(reads.find(call => call.month === '2025-01'), { month: '2025-01', currency: 'USD' });
});

test('the page labels partial totals and only shows variance once all amounts are entered', async t => {
  const p = await page(t);
  assert.match(p.view.text(), /Partial actual total/); assert.match(p.view.text(), /Requires every planned and actual amount/);
  p.view.nodes().find(node => node.props['aria-label'] === 'Actual Hosting').props.onChange({ target: { value: '0' } }); await p.view.flush();
  assert.doesNotMatch(p.view.text(), /Partial actual total/); assert.match(p.view.text(), /Positive means under budget/);
  assert.equal(p.state.posts.length, 0);
});

test('a lost category creation reuses the saved labels, order and key after reload', async t => {
  const writes = [];
  const p = await page(t, { expenses: { createItem: async (body, key) => {
    writes.push({ body, key }); if (writes.length === 1) throw new Error('Lost category response'); return { id: 9, version: 0, ...body };
  } } });
  await p.view.click('Expense categories');
  field(p.view, 'English name').onChange({ target: { value: 'Office rent' } });
  field(p.view, 'French name').onChange({ target: { value: 'Loyer du bureau' } });
  field(p.view, 'Order').onChange({ target: { value: '250' } }); await p.view.flush();
  await submitForm(p.view); assert.equal(writes.length, 1);
  p.view.unmount(); const restored = await p.mount(); await restored.click('Retry saved change');
  assert.equal(writes.length, 2); assert.deepEqual(writes[0], writes[1]);
  assert.deepEqual(writes[1].body, { nameEn: 'Office rent', nameFr: 'Loyer du bureau', active: true, displayOrder: 250 });
  assert.equal(p.storage.getItem(p.h.budgetRecoveryKey(1)), null);
});

test('dismissing a version conflict reloads categories before another deliberate edit', async t => {
  let catalogueReads = 0; const writes = [];
  const p = await page(t, { expenses: {
    items: async query => {
      if (query.size === 50) catalogueReads++;
      return { content: [{ id: 1, version: catalogueReads > 1 ? 2 : 0, nameEn: catalogueReads > 1 ? 'Updated hosting' : 'Hosting', nameFr: null, active: true, displayOrder: 1 }], page: { totalPages: 1 } };
    },
    updateItem: async (itemId, body, key) => {
      writes.push({ itemId, body, key });
      if (writes.length === 1) throw Object.assign(new Error('Reload the current category version'), { status: 409 });
      return { id: itemId, ...body, version: 3 };
    }
  } });
  await p.view.click('Expense categories'); await p.view.click('Edit'); await submitForm(p.view);
  assert.equal(writes[0].body.version, 0);
  await p.view.click('Dismiss rejected request and reload');
  assert.ok(catalogueReads >= 2); await p.view.click('Edit');
  assert.equal(field(p.view, 'English name').value, 'Updated hosting');
  await submitForm(p.view); assert.equal(writes[1].body.version, 2); assert.notEqual(writes[0].key, writes[1].key);
});

test('late category results cannot replace a newer archived-category view', async t => {
  let finish;
  const active = { id: 1, version: 0, nameEn: 'Hosting', active: true };
  const archived = { id: 2, version: 1, nameEn: 'Archived office', active: false };
  const result = rows => ({ content: rows, page: { totalPages: 1 } });
  const p = await page(t, { expenses: { items: async query => {
    if (query.size === 200) return result([active]);
    if (!query.includeArchived) return new Promise(resolve => { finish = () => resolve(result([active])); });
    return result([archived]);
  } } });
  await p.view.click('Expense categories');
  p.view.nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } }); await p.view.flush();
  assert.match(p.view.text(), /Archived office/);
  finish(); await p.view.flush(); assert.match(p.view.text(), /Archived office/);
});

test('history shows both captured snapshots and ignores an old response after selecting a different month', async t => {
  let finish;
  const before = resource({ version: 0, note: 'Old note', lines: [{ expenseItemId: 2, nameEn: 'Removed category', planned: '5.00', actual: null }] });
  const after = resource({ version: 1, note: 'Corrected note' });
  const p = await page(t, { expenses: { history: async () => ({ content: [{ id, actorAdminId: 9, createdAt: new Date().toISOString(), before, after }], page: { totalPages: 1 } }) } });
  await p.view.click('View edit history'); assert.match(p.view.text(), /Removed category/); assert.match(p.view.text(), /Old note/); assert.match(p.view.text(), /Corrected note/);
  p.api.expenses.history = async () => new Promise(resolve => { finish = () => resolve({ content: [{ id, before, after }], page: { totalPages: 1 } }); });
  p.view.button('View edit history').onClick(); await p.view.flush();
  field(p.view, 'Month (past or future)').onChange({ target: { value: '2024-12' } }); await p.view.flush();
  finish(); await p.view.flush(); assert.doesNotMatch(p.view.text(), /Removed category|Old note/);
});

test('account changes remove old expense intents and do not replay them for another admin', {concurrency:false},async t=>{
 const h=await budgets, storage=memory();storage.setItem(h.budgetRecoveryKey(1),JSON.stringify({actor:'1',key:id,operation:'updateBudget',id,request:{expectedVersion:0,lines:[]}}));
 const p=await page(t,{storage});assert.match(p.view.text(),/Saved change awaiting confirmation/);p.state.profile={id:2,role:'ADMIN'};await p.view.flush();assert.equal(storage.getItem(h.budgetRecoveryKey(1)),null);assert.equal(p.state.posts.length,0);assert.doesNotMatch(p.view.text(),/Saved change awaiting confirmation/);
});

test('expense PDF panel submits selected currency/comparison asynchronously and only downloads after an authorized status read', {concurrency:false},async t=>{
 const h=await reports, oldStorage=Object.getOwnPropertyDescriptor(global,'sessionStorage'),oldDocument=Object.getOwnPropertyDescriptor(global,'document');const storage=memory();global.sessionStorage=storage;global.document={hidden:true,addEventListener(){},removeEventListener(){}};
 let accepted;const calls=[];const api={expenses:{createReport:async(request,key)=>{calls.push({request,key});accepted={id,reportType:'EXPENSES',status:'QUEUED',fromDate:request.month+'-01',toDate:request.month+'-31',currency:request.currency,language:request.language,timeZone:request.timeZone,mode:request.mode,includeDetails:request.includeDetails,expiresAt:new Date(Date.now()+86400000).toISOString()};return accepted;},getReport:async jobId=>{assert.equal(jobId,id);return {...accepted,status:'COMPLETED',downloadUrl:'https://files.example/private.pdf?signature=sample',downloadUrlExpiresAt:new Date(Date.now()+300000).toISOString()};}}};
 const view=await mountComponent(path.join(__dirname,'../components/ExpenseReportExport.js'),{props:{},modules:{'@/contexts/AuthContext':{useAuth:()=>({adminProfile:{id:1,role:'ADMIN'}})},'@/contexts/LocaleContext':{useLocale:()=>({locale:'en'})},'@/lib/api':{api},'@/lib/expense-reports':h,'@/components/MonthPicker':{__esModule:true,default:'month-picker'},'./RevenueReportExport.module.css':{__esModule:true,default:{}}}});
 t.after(()=>{view.unmount();if(oldStorage)Object.defineProperty(global,'sessionStorage',oldStorage);else delete global.sessionStorage;if(oldDocument)Object.defineProperty(global,'document',oldDocument);else delete global.document;});await view.flush();
 const field=label=>view.nodes().find(n=>n.type==='label'&&n.props.children[0]===label).props.children.find(n=>n?.props?.onChange);
 field('Currency').props.onChange({target:{value:'CDF'}});field('Content').props.onChange({target:{value:'BUDGET_VS_ACTUAL'}});view.nodes().find(n=>n.type==='month-picker').props.onChange('2025-01');await view.flush();
 await view.nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await view.flush();assert.equal(calls.length,1);assert.equal(calls[0].request.currency,'CDF');assert.equal(calls[0].request.mode,'BUDGET_VS_ACTUAL');assert.equal(calls[0].request.month,'2025-01');assert.doesNotMatch(view.text(),/Download PDF/);
 await view.button('Check progress / refresh link').onClick();await view.flush();const download=view.nodes().find(n=>n.type==='a'&&n.props.children==='Download PDF');assert.match(download.props.href,/^https:\/\//);const saved=JSON.parse(storage.getItem(h.reportStorageKey(1)));assert.equal(saved.jobId,id);assert.equal(saved.downloadUrl,undefined);assert.equal(saved.request.currency,'CDF');
});
