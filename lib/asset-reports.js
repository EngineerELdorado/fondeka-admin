export const REPORT_STATES = ['QUEUED','PROCESSING','COMPLETED','FAILED','EXPIRED'];
export const terminalReport = job => ['COMPLETED','FAILED','EXPIRED'].includes(job?.status);
export const reportStorageKey = actor => `fondeka:asset-report:v1:${actor}`;
export function clearReportRecovery(storage,keepActor=null){const keep=keepActor==null?null:reportStorageKey(keepActor);for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith('fondeka:asset-report:v1:')&&key!==keep)storage.removeItem(key);}}
export const validReportId = id => typeof id==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
const validDate = value => {if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01')return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;};
function normalize(form,checkToday){
 const currency=form.currency?.trim().toUpperCase(),category=form.categoryId==null||form.categoryId===''?null:Number(form.categoryId),nature=form.nature||null;
 if(!validDate(form.asOf)||checkToday&&form.asOf>new Date().toISOString().slice(0,10))throw new Error('Choose a reporting date from 1900 through today.');
 if(!/^[A-Z]{3}$/.test(currency||'')||!['en','fr'].includes(form.language)||typeof form.timeZone!=='string'||!form.timeZone.trim()||form.timeZone.length>80)throw new Error('Choose a currency, English/French and a reporting timezone.');
 if(category!=null&&(!Number.isSafeInteger(category)||category<1)||nature!=null&&!['TANGIBLE','RECEIVABLE','OTHER'].includes(nature))throw new Error('Choose a valid asset category and nature.');
 return {asOf:form.asOf,currency,language:form.language,timeZone:form.timeZone.trim(),categoryId:category,nature,includeInactive:form.includeInactive===true,includeDetails:form.includeDetails!==false};
}
export const reportRequest = form => normalize(form,true);
export function readReportIntent(raw,actor){try{if(!raw||raw.length>3000)return null;const value=JSON.parse(raw);if(String(value.actor)!==String(actor)||!validReportId(value.key)||value.jobId&&!validReportId(value.jobId))return null;return {actor:String(actor),key:value.key,jobId:value.jobId||null,request:normalize(value.request,false)};}catch{return null;}}
export function checkedReport(job,id,request){if(!job||!validReportId(job.id)||id&&job.id!==id||job.reportType!=='ASSETS'||!REPORT_STATES.includes(job.status)||job.asOf!==request.asOf||job.currency!==request.currency||job.language!==request.language||job.timeZone!==request.timeZone||(job.categoryId??null)!==request.categoryId||(job.nature??null)!==request.nature||job.includeInactive!==request.includeInactive||job.includeDetails!==request.includeDetails||!Number.isFinite(Date.parse(job.expiresAt))||job.errorMessage!=null&&typeof job.errorMessage!=='string')throw new Error('Unexpected asset report response. Check the saved request before retrying.');return job;}
export function reportDownload(job,now=Date.now()){if(job?.status!=='COMPLETED'||!(Date.parse(job.downloadUrlExpiresAt)>now)||!(Date.parse(job.expiresAt)>now))return null;try{const url=new URL(job.downloadUrl);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export const reportPollDelay=attempt=>Math.min(15000,2000*2**Math.min(attempt,3));
