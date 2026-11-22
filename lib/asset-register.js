import { decimalAmount } from './expense-budgets';
export const assetRecoveryKey=actor=>`fondeka:asset-register:v1:${actor}`;
export function clearAssetRecovery(storage,keepActor=null){const keep=keepActor==null?null:assetRecoveryKey(keepActor);for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith('fondeka:asset-register:v1:')&&key!==keep)storage.removeItem(key);}}
const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
export function readAssetIntent(raw,actor){try{if(!raw||raw.length>30000)return null;const v=JSON.parse(raw);if(String(v.actor)!==String(actor)||!uuid(v.key)||!['createAsset','reviseAsset','createCategory','updateCategory'].includes(v.operation)||!v.request)return null;if(v.operation==='reviseAsset'&&!uuid(v.id)||v.operation==='updateCategory'&&(!Number.isSafeInteger(v.id)||v.id<1))return null;const r=v.request;if(v.operation.endsWith('Asset')&&(typeof r.nameEn!=='string'||!r.nameEn.trim()||typeof r.reason!=='string'||!r.reason.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveDate||'')||!/^[A-Z]{3}$/.test(r.currency||'')||!Number.isSafeInteger(r.categoryId)||r.categoryId<1||!Number.isSafeInteger(r.quantity)||r.quantity<1||v.operation==='reviseAsset'&&!Number.isSafeInteger(r.expectedVersion)))return null;if(v.operation.endsWith('Category')&&(typeof r.nameEn!=='string'||!r.nameEn.trim()||!['TANGIBLE','RECEIVABLE','OTHER'].includes(r.nature)||typeof r.active!=='boolean'||v.operation==='updateCategory'&&!Number.isSafeInteger(r.version)))return null;return {actor:String(actor),key:v.key,operation:v.operation,...(v.id==null?{}:{id:v.id}),request:v.request};}catch{return null;}}
export function checkedAssetResult(value,intent){if(!value||!Number.isSafeInteger(value.version)||value.version<0)throw new Error('Unexpected asset response. Retry the same saved request.');if(intent.operation.endsWith('Asset')){if(!uuid(value.id)||!uuid(value.revisionId)||value.effectiveDate!==intent.request.effectiveDate||value.currency!==intent.request.currency||intent.id&&value.id!==intent.id)throw new Error('The returned asset does not match this saved revision.');}else if(!Number.isSafeInteger(value.id)||intent.id&&value.id!==intent.id)throw new Error('The returned category does not match this request.');return value;}
export const emptyAsset = (date=new Date().toISOString().slice(0,10))=>({id:null,expectedVersion:null,reference:'',currency:'USD',effectiveDate:date,categoryId:'',nameEn:'',nameFr:'',quantity:'1',estimatedValue:'',outstandingAmount:'',status:'ACTIVE',acquisitionDate:'',location:'',custodian:'',identification:'',note:'',reason:''});
export function assetForm(asset,date){return {...emptyAsset(date),...asset,expectedVersion:asset.version,effectiveDate:date,categoryId:String(asset.categoryId),quantity:String(asset.quantity),nameFr:asset.nameFr||'',estimatedValue:asset.estimatedValue??'',outstandingAmount:asset.outstandingAmount??'',acquisitionDate:asset.acquisitionDate||'',location:asset.location||'',custodian:asset.custodian||'',identification:asset.identification||'',note:asset.note||'',reason:''};}
export function validAssetDate(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > new Date().toISOString().slice(0, 10)) return false;
 const date = new Date(value + 'T00:00:00Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function assetRequest(form,nature){
 if (!['TANGIBLE', 'RECEIVABLE', 'OTHER'].includes(nature)) throw new Error('Load and select an asset category before saving.');
 if (!['ACTIVE', 'DISPOSED', 'RECOVERED', 'WRITTEN_OFF'].includes(form.status)) throw new Error('Choose a valid asset status.');
 if (form.id && (!Number.isSafeInteger(form.expectedVersion) || form.expectedVersion < 0)) throw new Error('Reload the asset before recording a new revision.');
 const currency=form.currency.trim().toUpperCase(),quantity=Number(form.quantity),categoryId=Number(form.categoryId);
 if(!Number.isSafeInteger(categoryId)||categoryId<1||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000||nature==='RECEIVABLE'&&quantity!==1)throw new Error('Choose a category and a whole quantity; receivables use quantity 1.');
 if(!validAssetDate(form.effectiveDate))throw new Error('Choose a valid valuation date from 1900 through today.');
 const estimatedValue=decimalAmount(form.estimatedValue,currency,true),outstandingAmount=nature==='RECEIVABLE'?decimalAmount(form.outstandingAmount,currency,true):null;
 if(outstandingAmount!=null&&estimatedValue!=null&&BigInt(estimatedValue.replace('.',''))>BigInt(outstandingAmount.replace('.','')))throw new Error('Estimated recoverable value cannot exceed the recorded amount still owed.');
 if(form.status==='RECOVERED'&&(nature!=='RECEIVABLE'||estimatedValue==null||BigInt(estimatedValue.replace('.',''))!==0n||outstandingAmount!=null&&BigInt(outstandingAmount.replace('.',''))!==0n))throw new Error('Set the remaining estimated value and any recorded debt to zero for a recovered receivable.');
 if(!form.nameEn.trim()||!form.reason.trim())throw new Error('Enter an asset name and a reason for this valuation.');
 if (form.acquisitionDate) {
  const acquired = new Date(form.acquisitionDate + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.acquisitionDate) || form.acquisitionDate < '0001-01-01' || !Number.isFinite(acquired.getTime()) || acquired.toISOString().slice(0, 10) !== form.acquisitionDate || form.acquisitionDate > form.effectiveDate) throw new Error('Choose a valid acquisition date on or before the valuation date.');
 }
 const reference = form.reference.trim().toUpperCase();
 if (reference && !/^[A-Z0-9._:-]{1,100}$/.test(reference)) throw new Error('Use letters, digits, dots, colons, underscores or hyphens for the asset reference.');
 for (const [key, maximum] of Object.entries({ nameEn: 200, nameFr: 200, location: 300, custodian: 200, identification: 200, note: 4000, reason: 1000 })) {
  if ((form[key]?.trim().length || 0) > maximum) throw new Error(`${key} allows at most ${maximum} characters.`);
 }
 const fields=['nameEn','nameFr','location','custodian','identification','note','reason'];const copy=Object.fromEntries(fields.map(k=>[k,form[k]?.trim()||null]));
 return {...copy,...(form.id?{expectedVersion:form.expectedVersion}:{}),reference:reference||null,currency,effectiveDate:form.effectiveDate,categoryId,quantity,estimatedValue,outstandingAmount,status:form.status,acquisitionDate:form.acquisitionDate||null};
}
