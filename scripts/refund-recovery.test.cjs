const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../lib/refund-recovery.js'),'utf8').replace('export function','function');
const context=vm.createContext({});vm.runInContext(source,context);
test('recovery debit IDs are distinct positive safe numeric identifiers',()=>{
 assert.deepEqual(Array.from(context.recoveryDebitIds('123, 456; 789')), [123,456,789]);
 for(const value of ['', '0','-1','1,1','1.5','TX123','1e3','9007199254740992',Array.from({length:101},(_,i)=>i+1).join(',')]) assert.throws(()=>context.recoveryDebitIds(value));
});
