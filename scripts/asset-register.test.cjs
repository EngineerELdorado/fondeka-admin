const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const path=require('node:path');const {mountComponent}=require('./helpers/component-harness.cjs');
const read=p=>readFileSync(path.join(__dirname,'..',p),'utf8'),data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const money=data(read('lib/expense-budgets.js')),helpers=import(data(read('lib/asset-register.js').replace("'./expense-budgets'",JSON.stringify(money)))),reports=import(data(read('lib/asset-reports.js')));
const id='58d9ed95-751f-4c65-8d7b-9044153fa405',revision='9265b38b-922e-4711-a084-d89b5ba67405';
const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const body={currency:'USD',effectiveDate:'2025-12-31',categoryId:1,nameEn:'Office computers',nameFr:null,quantity:10,estimatedValue:'100.00',outstandingAmount:null,status:'ACTIVE',reason:'Opening inventory',reference:null};
const entry=(extra={})=>({id,revisionId:revision,version:0,revisionVersion:0,reference:'ASSET-001',currency:'USD',effectiveDate:'2025-12-31',nameEn:'Office computers',nameFr:null,categoryId:1,categoryNameEn:'Computers',categoryNameFr:'Ordinateurs',nature:'TANGIBLE',quantity:10,estimatedValue:'100.00',outstandingAmount:null,status:'ACTIVE',includedInTotal:true,...extra});
test('bulk quantities do not multiply total value and legacy receivables distinguish face amount from estimate',async()=>{const h=await helpers;let form={...h.emptyAsset('2025-12-31'),categoryId:'1',nameEn:'Computers',quantity:'10',estimatedValue:'100',reason:'Inventory'};const request=h.assetRequest(form,'TANGIBLE');assert.equal(request.estimatedValue,'100.00');assert.equal(request.quantity,10);form={...form,categoryId:'6',quantity:'1',estimatedValue:'600',outstandingAmount:'1000'};assert.equal(h.assetRequest(form,'RECEIVABLE').outstandingAmount,'1000.00');assert.throws(()=>h.assetRequest({...form,estimatedValue:'1001'},'RECEIVABLE'));assert.throws(()=>h.assetRequest({...form,status:'RECOVERED'},'RECEIVABLE'));assert.equal(h.assetRequest({...form,estimatedValue:'0',outstandingAmount:'0',status:'RECOVERED'},'RECEIVABLE').estimatedValue,'0.00');assert.equal(h.assetRequest({...form,estimatedValue:''},'RECEIVABLE').estimatedValue,null);});
test('asset recovery requires a matching account, operation, record identity and dated revision',async()=>{const h=await helpers,intent={actor:'1',key:id,operation:'createAsset',request:body};assert.deepEqual(h.readAssetIntent(JSON.stringify({...intent,downloadUrl:'do-not-store'}),1),intent);assert.equal(h.readAssetIntent(JSON.stringify(intent),2),null);assert.equal(h.readAssetIntent(JSON.stringify({...intent,request:{}}),1),null);assert.equal(h.checkedAssetResult(entry(),intent).quantity,10);assert.throws(()=>h.checkedAssetResult(entry({currency:'CDF'}),intent));assert.throws(()=>h.checkedAssetResult(entry({effectiveDate:'2026-01-01'}),intent));assert.throws(()=>h.checkedAssetResult(entry({revisionId:null}),intent));});
test('point-in-time report criteria retain scope and currency and never sum periods',async()=>{const h=await reports,r=h.reportRequest({asOf:'2025-12-31',currency:' usd ',language:'fr',timeZone:'UTC',categoryId:'6',nature:'RECEIVABLE',includeInactive:true,includeDetails:true});assert.equal(r.currency,'USD');assert.equal(r.categoryId,6);assert.equal(r.nature,'RECEIVABLE');assert.equal(r.includeInactive,true);assert.throws(()=>h.reportRequest({...r,asOf:'2025-02-30'}));const saved=h.readReportIntent(JSON.stringify({actor:'1',key:id,jobId:revision,request:r,downloadUrl:'do-not-store'}),1);assert.deepEqual(saved.request,r);assert.equal(saved.downloadUrl,undefined);const job={id:revision,reportType:'ASSETS',status:'COMPLETED',...r,expiresAt:new Date(Date.now()+86400000).toISOString()};assert.equal(h.checkedReport(job,revision,r),job);assert.throws(()=>h.checkedReport({...job,categoryId:1},revision,r));assert.throws(()=>h.checkedReport({...job,asOf:'2026-01-01'},revision,r));assert.equal(h.reportDownload({...job,downloadUrl:'javascript:alert(1)',downloadUrlExpiresAt:new Date(Date.now()+300000).toISOString()}),null);});
test('asset API uses existing authenticated routes, stable idempotency keys and read-only polling',{concurrency:false},async()=>{const original=global.fetch,calls=[];global.fetch=async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify(entry()),{headers:{'content-type':'application/json'}});};try{const {api}=await import(data(read('lib/api.js'))+'#asset-test');api.setAuthToken('test-token');await api.assets.create(body,id);await api.assets.revise(id,{...body,expectedVersion:0},revision);await api.assets.get(id,{asOf:'2025-12-31'});await api.assets.getReport(id);assert.equal(calls[0].init.headers['Idempotency-Key'],id);assert.equal(calls[1].init.headers['Idempotency-Key'],revision);assert.match(calls[1].url,/\/revisions$/);assert.match(calls[2].url,/asOf=2025-12-31/);assert.match(calls[3].url,/asset-reports\/exports\//);for(const call of calls){assert.equal(call.init.cache,'no-store');assert.equal(call.init.headers.Authorization,'Bearer test-token');assert.doesNotMatch(call.url,/wallets|payments|loans/);}}finally{global.fetch=original;}});
async function panel(t,options={}){const h=await helpers,storage=options.storage||memory(),oldStorage=Object.getOwnPropertyDescriptor(global,'sessionStorage'),oldSet=global.setTimeout,oldClear=global.clearTimeout;global.sessionStorage=storage;const timers=new Map();let timer=0;global.setTimeout=(fn,delay)=>{timers.set(++timer,{fn,delay});return timer;};global.clearTimeout=id=>timers.delete(id);const state={profile:options.profile===undefined?{id:1,role:'ADMIN'}:options.profile,posts:[],reads:0};const category={id:1,version:0,nameEn:'Computers',nameFr:'Ordinateurs',nature:'TANGIBLE',active:true,displayOrder:1};const api={assets:{categoryOptions:async()=>[category],categories:async()=>({content:[category],page:{totalPages:1}}),list:async()=>{state.reads++;return {content:[],page:{totalPages:0}};},summary:async()=>[],create:async(request,key)=>{state.posts.push({request,key});if(options.create)return options.create(request,key,state.posts.length);return entry();}}};Object.assign(api.assets, options.api);const views=[];const mount=async()=>{const view=await mountComponent(path.join(__dirname,'../app/(dashboard)/dashboard/assets/page.js'),{props:{},modules:{'@/contexts/AuthContext':{useAuth:()=>({adminProfile:state.profile})},'@/contexts/LocaleContext':{useLocale:()=>({locale:'en'})},'@/lib/api':{api},'@/lib/asset-register':h,'@/components/AssetReportExport':{__esModule:true,default:'AssetReport'},'./assets.module.css':{__esModule:true,default:{}}}});views.push(view);await view.flush();return view;};t.after(()=>{views.forEach(v=>v.unmount());global.setTimeout=oldSet;global.clearTimeout=oldClear;if(oldStorage)Object.defineProperty(global,'sessionStorage',oldStorage);else delete global.sessionStorage;});const view=await mount();const field=label=>view.nodes().filter(n=>n.type==='label'&&n.props.children[0]===label).at(-1).props.children.find(n=>n?.props?.onChange);return {h,view,mount,state,storage,timers,field,api,entry};}
test('register creation survives a lost response and reload without changing the original body or key',{concurrency:false},async t=>{const p=await panel(t,{create:async(request,key,attempt)=>{if(attempt===1)throw new Error('Lost response');return entry({effectiveDate:request.effectiveDate});}});p.field('English name').props.onChange({target:{value:'Office computers'}});p.field('Category').props.onChange({target:{value:'1'}});p.field('Quantity').props.onChange({target:{value:'10'}});p.field('Total estimated value').props.onChange({target:{value:'100'}});p.field('Value effective from').props.onChange({target:{value:'2025-12-31'}});p.field('Reason / valuation basis').props.onChange({target:{value:'Opening inventory'}});await p.view.flush();await p.view.nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await p.view.flush();assert.equal(p.state.posts.length,1);assert.equal(p.state.posts[0].request.estimatedValue,'100.00');assert.ok(p.storage.getItem(p.h.assetRecoveryKey(1)));p.view.unmount();const restored=await p.mount();await restored.button('Retry saved change').onClick();await restored.flush();assert.equal(p.state.posts.length,2);assert.deepEqual(p.state.posts[0],p.state.posts[1]);assert.equal(p.storage.getItem(p.h.assetRecoveryKey(1)),null);});
test('filter reads are debounced and non-admins do not load or edit company assets',{concurrency:false},async t=>{const p=await panel(t,{profile:{id:1,role:'ASSISTANT'}});assert.equal(p.state.reads,0);assert.equal(p.timers.size,0);assert.match(p.view.text(),/Admin access is required/);});
test('switching admins clears a pending asset write rather than replaying it for another actor',{concurrency:false},async t=>{const h=await helpers,storage=memory();storage.setItem(h.assetRecoveryKey(1),JSON.stringify({actor:'1',key:id,operation:'createAsset',request:body}));const p=await panel(t,{storage});assert.match(p.view.text(),/Saved change awaiting confirmation/);p.state.profile={id:2,role:'ADMIN'};await p.view.flush();assert.equal(storage.getItem(h.assetRecoveryKey(1)),null);assert.equal(p.state.posts.length,0);assert.doesNotMatch(p.view.text(),/Saved change awaiting confirmation/);});
test('asset report panel sends selected as-of date and recovers a queued job without storing signed links',{concurrency:false},async t=>{const h=await reports,oldStorage=Object.getOwnPropertyDescriptor(global,'sessionStorage'),oldDoc=Object.getOwnPropertyDescriptor(global,'document');global.sessionStorage=memory();global.document={hidden:true,addEventListener(){},removeEventListener(){}};const calls=[];let accepted;const api={assets:{createReport:async(request,key)=>{calls.push({request,key});accepted={...request,id:revision,reportType:'ASSETS',status:'QUEUED',expiresAt:new Date(Date.now()+86400000).toISOString()};return accepted;},getReport:async()=>({...accepted,status:'COMPLETED',downloadUrl:'https://files.example/assets.pdf?signature=sample',downloadUrlExpiresAt:new Date(Date.now()+300000).toISOString()})}};const view=await mountComponent(path.join(__dirname,'../components/AssetReportExport.js'),{props:{selectedAsOf:'2025-12-31',categories:[]},modules:{'@/contexts/AuthContext':{useAuth:()=>({adminProfile:{id:1,role:'ADMIN'}})},'@/contexts/LocaleContext':{useLocale:()=>({locale:'en'})},'@/lib/api':{api},'@/lib/asset-reports':h,'./RevenueReportExport.module.css':{__esModule:true,default:{}}}});t.after(()=>{view.unmount();if(oldStorage)Object.defineProperty(global,'sessionStorage',oldStorage);else delete global.sessionStorage;if(oldDoc)Object.defineProperty(global,'document',oldDoc);else delete global.document;});await view.flush();await view.click('Export asset PDF');await view.nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await view.flush();assert.equal(calls[0].request.asOf,'2025-12-31');assert.equal(calls[0].request.includeDetails,true);assert.doesNotMatch(view.text(),/Download PDF/);await view.button('Check progress / refresh link').onClick();await view.flush();assert.ok(view.nodes().some(n=>n.type==='a'&&n.props.children==='Download PDF'));const saved=JSON.parse(sessionStorage.getItem(h.reportStorageKey(1)));assert.equal(saved.jobId,revision);assert.equal(saved.downloadUrl,undefined);});


async function registerTick(p) {
  const scheduled = [...p.timers].find(([, timer]) => timer.delay === 300);
  if (!scheduled) return;
  p.timers.delete(scheduled[0]); await scheduled[1].fn(); await p.view.flush();
}
const submitAsset = async view => { await view.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await view.flush(); };

test('as-of queries and complete currency summaries share filters while pagination never narrows totals', async t => {
  const calls = [];
  const p = await panel(t, { api: {
    list: async query => { calls.push({ type: 'list', query }); return { content: [entry({ status: 'DISPOSED', includedInTotal: false })], page: { totalPages: 2 } }; },
    summary: async query => { calls.push({ type: 'summary', query }); return [
      { currency: 'USD', estimatedValue: '12345.00', valuedCount: 2, activeCount: 3, excludedCount: 1, complete: false },
      { currency: 'CDF', estimatedValue: '0', valuedCount: 1, activeCount: 1, excludedCount: 0, complete: true }
    ]; }
  } });
  p.field('As of date').props.onChange({ target: { value: '2025-12-31' } }); await p.view.flush(); await registerTick(p);
  assert.equal(calls.length, 2); assert.equal(calls[0].query.asOf, '2025-12-31'); assert.equal(calls[1].query.asOf, '2025-12-31');
  assert.equal(calls[1].query.page, undefined); assert.equal(calls[1].query.size, undefined);
  assert.match(p.view.text(), /12345.00/); assert.match(p.view.text(), /CDF/); assert.match(p.view.text(), /Partial/); assert.match(p.view.text(), /Excluded from total/);
  assert.doesNotMatch(p.view.text(), /12445/);
  await p.view.click('Next'); assert.equal(calls.at(-2).query.page, 1); assert.equal(calls.at(-1).query.page, undefined);
});

test('historical revisions keep immutable identity and optional fields, and use global version instead of revisionVersion', async t => {
  const row = entry({ version: 9, revisionVersion: 2, effectiveDate: '2025-01-01', acquisitionDate: '2024-01-01', location: 'Goma', custodian: 'Operations', identification: 'SERIAL-1', note: 'Existing note' });
  const writes = [];
  const p = await panel(t, { api: {
    list: async () => ({ content: [row], page: { totalPages: 1 } }),
    revise: async (assetId, request, key) => { writes.push({ assetId, request, key }); return entry({ ...request, version: 10, revisionVersion: 10 }); }
  } });
  p.field('As of date').props.onChange({ target: { value: '2025-12-31' } }); await p.view.flush(); await registerTick(p);
  await p.view.click('Record revision');
  assert.equal(p.field('Currency').props.disabled, true); assert.equal(p.field('Reference (blank for automatic)').props.disabled, true);
  p.field('Value effective from').props.onChange({ target: { value: '2025-10-01' } });
  p.field('Reason / valuation basis').props.onChange({ target: { value: 'Backfilled correction' } }); await p.view.flush();
  await submitAsset(p.view); assert.equal(writes.length, 1);
  assert.equal(writes[0].request.expectedVersion, 9); assert.equal(writes[0].request.effectiveDate, '2025-10-01');
  for (const key of ['currency', 'reference', 'acquisitionDate', 'location', 'custodian', 'identification', 'note', 'quantity']) assert.equal(writes[0].request[key], row[key]);
  assert.equal(writes[0].request.estimatedValue, '100.00'); assert.equal(writes[0].assetId, id);
});

test('lost revision responses retain the exact dated snapshot and key through reload', async t => {
  const writes = [];
  const p = await panel(t, { api: {
    list: async () => ({ content: [entry({ version: 5, revisionVersion: 1 })], page: { totalPages: 1 } }),
    revise: async (assetId, request, key) => { writes.push({ assetId, request, key }); if (writes.length === 1) throw new Error('Lost revision response'); return entry({ ...request, version: 6, revisionVersion: 6 }); }
  } });
  await registerTick(p); await p.view.click('Record revision');
  p.field('Reason / valuation basis').props.onChange({ target: { value: 'Reviewed valuation' } }); await p.view.flush();
  await submitAsset(p.view); assert.equal(writes.length, 1); assert.equal(p.field('Total estimated value').props.disabled, true);
  p.view.unmount(); const restored = await p.mount(); await restored.click('Retry saved change');
  assert.equal(writes.length, 2); assert.deepEqual(writes[0], writes[1]); assert.equal(writes[1].request.expectedVersion, 5);
  assert.equal(p.storage.getItem(p.h.assetRecoveryKey(1)), null);
});

test('dated entry validation rejects missing category knowledge, future values, invalid acquisition dates and negative estimates', async () => {
  const h = await helpers;
  const form = { ...h.emptyAsset('2025-12-31'), categoryId: '1', nameEn: 'Office computer', reason: 'Inventory', estimatedValue: '100' };
  assert.throws(() => h.assetRequest(form, undefined), /select an asset category/);
  assert.throws(() => h.assetRequest({ ...form, effectiveDate: '9999-12-31' }, 'TANGIBLE'), /through today/);
  assert.throws(() => h.assetRequest({ ...form, acquisitionDate: '2025-02-30' }, 'TANGIBLE'), /valid acquisition/);
  assert.throws(() => h.assetRequest({ ...form, estimatedValue: '-1' }, 'TANGIBLE'), /negative/);
  assert.throws(() => h.assetRequest({ ...form, currency: 'JPY', estimatedValue: '1.50' }, 'TANGIBLE'), /precision/);
  assert.equal(h.assetRequest({ ...form, currency: 'KWD', estimatedValue: '1.001' }, 'TANGIBLE').estimatedValue, '1.001');
  assert.equal(h.assetRequest({ ...form, estimatedValue: '0' }, 'TANGIBLE').estimatedValue, '0.00');
  assert.equal(h.assetRequest({ ...form, estimatedValue: '' }, 'TANGIBLE').estimatedValue, null);
});

test('category options include every archived page without activating records', { concurrency: false }, async t => {
  const original = global.fetch, calls = []; t.after(() => { global.fetch = original; });
  const { api } = await import(data(read('lib/api.js')) + '#asset-categories'); api.setAuthToken('test-token');
  global.fetch = async (url, init) => {
    calls.push({ url, init }); const u = new URL(url, 'https://test.local'), page = Number(u.searchParams.get('page'));
    return Response.json({ content: [{ id: page + 1, nameEn: page ? 'Archived category' : 'Active category', active: !page }], page: { number: page, totalPages: 2, totalElements: 2 } });
  };
  const categories = await api.assets.categoryOptions(); assert.equal(categories.length, 2); assert.equal(categories[1].active, false);
  assert.ok(calls.every(call => call.url.includes('includeArchived=true') && call.init.cache === 'no-store' && call.init.headers.Authorization === 'Bearer test-token'));
  assert.ok(calls.every(call => !call.init.method || call.init.method === 'GET'));
});

test('obsolete register reads cannot repopulate rows after changing date or clearing the date', async t => {
  let finish;
  const p = await panel(t, { api: {
    list: async query => query.asOf === '2025-12-31' ? new Promise(resolve => { finish = () => resolve({ content: [entry({ nameEn: 'Old date row' })], page: { totalPages: 1 } }); }) : ({ content: [], page: { totalPages: 0 } })
  } });
  p.field('As of date').props.onChange({ target: { value: '2025-12-31' } }); await p.view.flush();
  const pendingRead = registerTick(p); await p.view.flush();
  p.field('As of date').props.onChange({ target: { value: '' } }); await p.view.flush(); await registerTick(p);
  finish(); await pendingRead; await p.view.flush();
  assert.doesNotMatch(p.view.text(), /Old date row/); assert.match(p.view.text(), /Choose a date from 1900/);
});


test('category nature stays fixed while conflict recovery reloads the current editable version', async t => {
  let fresh = false; const writes = [];
  const category = () => ({ id: 1, version: fresh ? 2 : 0, nameEn: fresh ? 'Updated equipment' : 'Computers', nameFr: null, nature: 'TANGIBLE', active: true, displayOrder: 1 });
  const p = await panel(t, { api: {
    categoryOptions: async () => [category()],
    categories: async () => ({ content: [category()], page: { totalPages: 1 } }),
    updateCategory: async (categoryId, request, key) => {
      writes.push({ categoryId, request, key });
      if (writes.length === 1) { fresh = true; throw Object.assign(new Error('Reload current category'), { status: 409 }); }
      return { id: categoryId, ...request, version: 3 };
    }
  } });
  await p.view.click('Categories'); await p.view.click('Edit'); assert.equal(p.field('Nature').props.disabled, true);
  await submitAsset(p.view); assert.equal(writes[0].request.version, 0);
  await p.view.click('Dismiss rejected request'); await p.view.click('Edit');
  assert.equal(p.field('English name').props.value, 'Updated equipment'); assert.equal(p.field('Nature').props.disabled, true);
  p.view.nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: false } }); await p.view.flush();
  await submitAsset(p.view); assert.equal(writes[1].request.version, 2); assert.equal(writes[1].request.nature, 'TANGIBLE'); assert.equal(writes[1].request.active, false);
  assert.notEqual(writes[0].key, writes[1].key);
});
