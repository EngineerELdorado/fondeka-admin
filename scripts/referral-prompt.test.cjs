const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const load = (file, tag='') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname,'..',file),'utf8')).toString('base64')}#${tag}`);

test('all-user popup payloads preserve stable identity and localized plain text without any reward mutations', async () => {
  const {referralPromptDraft,referralPromptPayload,supportsReferralPrompt}=await load('lib/referral-prompt.js');
  assert.equal(supportsReferralPrompt({id:1}),false); assert.equal(supportsReferralPrompt({id:1,referralPrompt:null}),true);
  const draft=referralPromptDraft({enabled:true,campaignId:'invite-v1',titleFr:'Invitez.\nGagnez ensemble.',messageEn:'Friends • Fondeka'});
  const payload=referralPromptPayload({...draft,baseRewardPoints:999});
  assert.equal(payload.campaignId,'invite-v1'); assert.equal(payload.titleFr,'Invitez.\nGagnez ensemble.');
  assert.equal(payload.enabled,true); assert.equal(payload.audience,null); assert.equal(payload.targetAccountIds,null);
  assert.equal(payload.baseRewardPoints,undefined);
  assert.equal(referralPromptPayload({...draft,enabled:false}).campaignId,'invite-v1');
});

test('filtered audiences round trip every shared selector, zero counts and explicit false values', async () => {
  const {referralPromptDraft,referralPromptPayload,referralPromptAudienceFields}=await load('lib/referral-prompt.js');
  const audience=Object.fromEntries(referralPromptAudienceFields.map(([key,_label,kind])=>[key,kind==='boolean'?false:kind==='ids'?[2,3]:kind==='list'?['VALUE']:kind==='date'?'2026-01-01':kind==='positive'?30:0]));
  const draft=referralPromptDraft({enabled:true,campaignId:'invite-v1',targetAccountIds:[7,8],audience});
  const result=referralPromptPayload(draft); assert.deepEqual(result.audience,audience); assert.deepEqual(result.targetAccountIds,[7,8]);
  assert.equal(result.audience.hasSavings,false); assert.equal(result.audience.maxCompletedTransactions,0);
  const all=referralPromptPayload({...draft,audienceMode:'ALL'}); assert.equal(all.audience,null); assert.equal(all.targetAccountIds,null);
});

test('empty filters, malformed IDs, invalid dates and inverted ranges fail before any save', async () => {
  const {referralPromptDraft,referralPromptPayload}=await load('lib/referral-prompt.js');
  const draft={...referralPromptDraft(null),enabled:true,campaignId:'v1',audienceMode:'FILTERED'};
  for (const value of [draft,{...draft,targetAccountIds:'0'},{...draft,targetAccountIds:'abc'},
    {...draft,filters:{...draft.filters,countryIds:'0'}},{...draft,filters:{...draft.filters,hasCards:'maybe'}},
    {...draft,filters:{...draft.filters,accountCreatedFrom:'2026-02-30'}},
    {...draft,filters:{...draft.filters,minCompletedTransactions:'3',maxCompletedTransactions:'2'}},
    {...draft,filters:{...draft.filters,lastTransactionOlderThanDays:'0'}}]) assert.throws(()=>referralPromptPayload(value));
  assert.throws(()=>referralPromptPayload({...draft,audienceMode:'ALL',campaignId:''}));
  assert.throws(()=>referralPromptPayload({...draft,audienceMode:'ALL',titleEn:'<b>Invite</b>'}));
});

test('admin popup saves use only the dedicated authenticated endpoint and retain failed drafts', async (t) => {
  const original=global.fetch; t.after(()=>{global.fetch=original;});
  const {api}=await load('lib/api.js','referral-prompt-api'); api.setAuthToken('admin-test');
  const calls=[]; const payload={enabled:true,campaignId:'invite-v1',audience:null};
  global.fetch=async(url,init)=>{calls.push({url,init});return Response.json({id:11,referralPrompt:payload});};
  await api.referralCampaigns.updateReferralPrompt(11,payload);
  assert.match(calls[0].url,/\/referral-campaigns\/11\/referral-prompt$/); assert.equal(calls[0].init.method,'PUT');
  assert.equal(calls[0].init.headers.Authorization,'Bearer admin-test'); assert.deepEqual(JSON.parse(calls[0].init.body),payload);
  global.fetch=async()=>Response.json({message:'Permission denied'},{status:403});
  await assert.rejects(api.referralCampaigns.updateReferralPrompt(11,payload),error=>error.status===403);
});

test('saved popup resources require feature support, matching numeric campaign identity and fully understood filters', async () => {
  const {referralPromptResource}=await load('lib/referral-prompt.js');
  assert.equal(referralPromptResource({id:11,referralPrompt:null},11).draft.campaignId,'');
  for (const resource of [{id:11},{id:12,referralPrompt:null},{id:11,referralPrompt:[]},
    {id:11,referralPrompt:{enabled:'true',campaignId:'pilot'}},
    {id:11,referralPrompt:{enabled:true,campaignId:''}},
    {id:11,referralPrompt:{audience:{}}},
    {id:11,referralPrompt:{audience:{newUnsupportedSelector:true}}},
    {id:11,referralPrompt:{audience:{hasCards:'false'}}},
    {id:11,referralPrompt:{targetAccountIds:[]}},
    {id:11,referralPrompt:{targetAccountIds:[0]}},
    {id:11,referralPrompt:{audience:{countryCodes:['CD','']}}}]) assert.throws(()=>referralPromptResource(resource,11));
});

test('disable, edits and toggles preserve the complete configuration and stable presentation ID', async () => {
  const {referralPromptDraft,referralPromptPayload,referralPromptFingerprint}=await load('lib/referral-prompt.js');
  const policy={enabled:true,campaignId:'invite.pilot_1:mobile-v1',titleEn:'  Invite • friends.\nTogether.  ',titleFr:'Invitez vos amis.',messageEn:'Your personal link.',messageFr:'L’invitation\nFondeka.',audience:{countryCodes:['CD','RW'],hasSavings:false,maxCompletedTransactions:0},targetAccountIds:[123,456]};
  const draft=referralPromptDraft(policy);
  assert.deepEqual(referralPromptPayload({...draft,enabled:false}),{...policy,enabled:false});
  assert.deepEqual(referralPromptPayload({...draft,titleFr:'Copie modifiée'}),{...policy,titleFr:'Copie modifiée'});
  assert.equal(referralPromptFingerprint(policy),referralPromptFingerprint({...policy,audience:{...policy.audience,countryCodes:['RW','CD']},targetAccountIds:[456,123]}));
  const primitives=referralPromptPayload({...draft,filters:{hasCards:false,maxCompletedTransactions:0},targetAccountIds:[123]});
  assert.deepEqual(primitives.audience,{hasCards:false,maxCompletedTransactions:0});assert.deepEqual(primitives.targetAccountIds,[123]);
});

test('popup limits and list validation reject blank entries, oversized lists, malformed identifiers and unsupported draft fields', async () => {
  const {referralPromptDraft,referralPromptPayload}=await load('lib/referral-prompt.js');
  const draft={...referralPromptDraft(null),enabled:true,campaignId:'pilot',audienceMode:'FILTERED',targetAccountIds:'123'};
  for (const value of [{...draft,targetAccountIds:'123,,456'},{...draft,targetAccountIds:'9007199254740993'},
    {...draft,targetAccountIds:Array.from({length:1001},(_,index)=>index+1)},
    {...draft,filters:{countryCodes:'CD,,RW'}},{...draft,filters:{countryIds:'2,abc'}},
    {...draft,filters:{accountCreatedFrom:'2026-11-01',accountCreatedTo:'2026-01-01'}},
    {...draft,filters:{minTransactionsThisMonth:2,maxTransactionsThisMonth:1}},
    {...draft,filters:{unknownFilter:true}}, {...draft,enabled:'true'},
    {...draft,campaignId:'_pilot'}, {...draft,campaignId:'a'.repeat(129)},
    {...draft,titleEn:'x'.repeat(201)}, {...draft,messageFr:'x'.repeat(4001)},
    {...draft,messageEn:'[Link](https://example.test)'}, {...draft,messageEn:'A\0B'}]) assert.throws(()=>referralPromptPayload(value));
  assert.deepEqual(referralPromptPayload({...draft,targetAccountIds:'123,\n456'}).targetAccountIds,[123,456]);
  assert.deepEqual(referralPromptPayload({...draft,targetAccountIds:'',filters:{countryCodes:'cd\nrw'}}).audience.countryCodes,['CD','RW']);
});

test('popup reads and permission-denied writes use existing Bearer auth without dispatching forced logout', async (t) => {
  const originalFetch=global.fetch, originalWindow=global.window, originalEvent=global.CustomEvent;
  t.after(()=>{global.fetch=originalFetch;global.window=originalWindow;global.CustomEvent=originalEvent;});
  let logouts=0;global.window={dispatchEvent:()=>{logouts++;}};global.CustomEvent=class {constructor(name){this.type=name;}};
  const {api}=await load('lib/api.js','referral-read-permissions');api.setAuthToken('admin-reader');
  const calls=[];global.fetch=async(url,init)=>{calls.push({url,init});return Response.json({id:42,referralPrompt:null});};
  await api.referralCampaigns.getReferralPrompt(42);
  assert.match(calls[0].url,/\/referral-campaigns\/42$/);assert.equal(calls[0].init.headers.Authorization,'Bearer admin-reader');assert.equal(calls[0].init.cache,'no-store');
  global.fetch=async()=>Response.json({message:'No access'},{status:403});
  await assert.rejects(api.referralCampaigns.getReferralPrompt(42),error=>error.status===403);
  await assert.rejects(api.referralCampaigns.updateReferralPrompt(42,{}),error=>error.status===403);
  assert.equal(logouts,0);
});
