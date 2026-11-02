#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv } from './lib/csv.mjs';
import { table, heading } from './lib/format.mjs';
import { page, table as htmlTable, record, writeOut } from './lib/render.mjs';

export const COMMANDS = {
 help:'', namespaces:'', prefixes:'namespace', addresses:'namespace', namespace:'', prefix:'', address:'', change:'',
 capacity:'namespace', 'next-free':'', reservations:'namespace', 'review-due':'', 'change-review':'', actions:'', activity:'', compliance:'', 'weekly-review':'',
 'add-namespace':'name owner purpose review-due', 'add-prefix':'namespace name prefix member-type owner review-due pool',
 propose:'prefix address name owner review-due reason due', activate:'reference note', decide:'decision note', release:'reason', review:'entity owner next reference note',
 'add-action':'namespace title owner due', 'close-action':'resolution', import:'kind file source namespace', export:'file',
 'draft-handover':'', 'draft-change':''
};
const MUTATIONS = new Set(['add-namespace','add-prefix','propose','activate','decide','release','review','add-action','close-action','import']);
const TABLES = ['namespaces','prefixes','addresses','changes','actions','evidence','import_batches','audit'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v) => String(v ?? '').trim();
function need(o,k){ if(typeof o[k] !== 'string'||!o[k].trim()) throw Error(`--${k} is required`); return o[k].trim(); }
function date(o,k){ const v=need(o,k);if(!DATE.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(`--${k} must be a real YYYY-MM-DD date`);return v; }
function future(o,k){const v=date(o,k);if(v<new Date().toISOString().slice(0,10))throw Error(`--${k} cannot be in the past`);return v;}
function parse(argv){
 const args=[],o={};
 for(const a of argv){if(!a.startsWith('--')){args.push(a);continue;} const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i);if(k in o)throw Error(`Repeated option --${k}`);o[k]=i<0?true:a.slice(i+1);}
 const cmd=args.shift()||'help';if(!(cmd in COMMANDS))throw Error(`Unknown command ${cmd}. Use help.`);
 const allowed=new Set(['json',...COMMANDS[cmd].split(' '),...(MUTATIONS.has(cmd)?['actor','dry-run']:[])]);
 for(const k of Object.keys(o))if(!allowed.has(k))throw Error(`Unknown option --${k} for ${cmd}`);
 for(const k of ['json','dry-run','pool'])if(k in o&&o[k]!==true)throw Error(`--${k} is a switch without a value`);
 const expected={namespace:1,prefix:1,address:1,change:1,'next-free':1,decide:1,activate:1,release:1,review:1,'close-action':1,import:1,'draft-handover':1,'draft-change':1}[cmd]||0;
 if(args.length!==expected)throw Error(`${cmd} expects ${expected} record argument(s)`);
 return {cmd,args,o};
}
export async function resolve(db,entity,term){
 if(!['namespaces','prefixes','addresses','changes','actions'].includes(entity))throw Error('Unknown record type');
 if(!clean(term))throw Error(`Name or id required for ${entity}`);
 const col=entity==='changes'?'code':entity==='actions'?'title':'name';
 const rows=await db.query(`select *,${col} as label from ${entity} order by ${col}`);
 const q=term.toLowerCase();const exact=rows.filter(r=>r.id===term||r[col].toLowerCase()===q);
 const hits=exact.length?exact:rows.filter(r=>r.id.startsWith(q)||r[col].toLowerCase().includes(q));
 if(hits.length!==1)throw Error(`${hits.length?'Ambiguous':'No matching'} ${entity}: ${term}\n`+(hits.length?hits:rows).map(r=>`${r.id}  ${r.label}`).join('\n'));
 const {label,...row}=hits[0];return row;
}
async function audit(db,actor,operation,entity,before,after){
 await db.query('insert into audit(actor,operation,entity,record_id,before_value,after_value) values($1,$2,$3,$4,$5,$6)',[actor,operation,entity,after?.id||before?.id||null,before?JSON.stringify(before):null,after?JSON.stringify(after):null]);
}
async function scope(db,o){return o.namespace?(await resolve(db,'namespaces',o.namespace)).id:null;}
async function capacity(db,o){const n=await scope(db,o);return db.query('select namespace,name,subnet,member_type,trunc(capacity)::text as capacity,trunc(used)::text as used,trunc(available)::text as available,used_percent::text from capacity_review where ($1::uuid is null or namespace_id=$1) and status<>\'deprecated\' order by namespace,subnet',[n]);}
async function health(db){return db.query('select rule,entity,id,record,finding from compliance_findings order by rule,record');}
async function eligiblePrefix(db,p){
 const n=(await db.query('select * from namespaces where id=$1',[p.namespace_id]))[0];
 if(p.status!=='active'||p.member_type!=='address')throw Error('Reservations need an active address range');
 const today=new Date().toISOString().slice(0,10);
 for(const [label,r] of [['Range',p],['Namespace',n]])if(!clean(r.owner)||!r.review_due||String(r.review_due).slice(0,10)<today)throw Error(`${label} needs an owner and a current review before reservation`);
 if((await db.query("select id from prefixes where namespace_id=$1 and prefix << $2::cidr and status<>'deprecated'",[p.namespace_id,p.prefix])).length)throw Error('Address range has child ranges; review its hierarchy first');
}
async function validateAddress(db,p,address){
 const [a]=await db.query(`select set_masklen($1::inet,masklen($2::cidr))::text as address,
 host($1::inet)::inet <<= $2::cidr as contained,
 (family($2::cidr)=6 or masklen($2::cidr)>=31 or $3::boolean or
 (host($1::inet)<>host(network($2::cidr)) and host($1::inet)<>host(broadcast($2::cidr)))) as usable`,[address,p.prefix,p.is_pool]);
 if(!a.contained||!a.usable)throw Error('Address is outside the range or is its network/broadcast boundary');
 const [existing]=await db.query('select * from addresses where namespace_id=$1 and host(address)=host($2::inet)',[p.namespace_id,address]);
 if(existing&&existing.status!=='deprecated')throw Error(`Address is already ${existing.status}: ${existing.name}`);
 return {address:a.address,existing};
}
async function nextFree(db,p){
 await eligiblePrefix(db,p);
 const rows=await db.query(`with first_host as (
 select network($1::cidr)::inet + (case when family($1::cidr)=4 and masklen($1::cidr)<31 and not $3 then 1 else 0 end)::bigint as ip
 ), candidates as (
 select ip from first_host union
 select set_masklen(address,case family(address) when 4 then 32 else 128 end)+1::bigint from addresses
 where namespace_id=$2 and host(address)::inet <<= $1::cidr and status<>'deprecated' and host(address)<>host(broadcast($1::cidr))
 ) select set_masklen(ip,masklen($1::cidr))::text as address from candidates c where c.ip <<= $1::cidr
 and (family($1::cidr)=6 or masklen($1::cidr)>=31 or $3 or host(c.ip)<>host(broadcast($1::cidr)))
 and not exists(select 1 from addresses a where a.namespace_id=$2 and host(a.address)=host(c.ip) and a.status<>'deprecated')
 order by c.ip limit 1`,[p.prefix,p.namespace_id,p.is_pool]);
 if(!rows.length)throw Error('No free address remains in this range');return rows[0];
}
const same=(a,b)=>JSON.stringify(Object.fromEntries(Object.entries(a).sort()))===JSON.stringify(Object.fromEntries(Object.entries(b).sort()));
async function importData(db,args,o,actor){
 if(args[0]!=='infrahub')throw Error('Supported import: infrahub');
 const kind=need(o,'kind');if(!['prefixes','addresses'].includes(kind))throw Error('--kind must be prefixes or addresses');
 const source=need(o,'source');const raw=fs.readFileSync(path.resolve(need(o,'file')),'utf8');const rows=parseCsv(raw);
 if(!rows.length)throw Error('Export contains no data rows');
 let inserted=0,unchanged=0;const preserved=new Set();
 for(const [i,row] of rows.entries()){
  try{
   const field=kind==='prefixes'?'prefix':'address';for(const k of [field,'status'])if(!clean(row[k]))throw Error(`Missing ${k} column/value`);
   const ns=clean(row.ip_namespace)||clean(o.namespace);if(!ns)throw Error('Missing ip_namespace; provide --namespace only for a verified single-namespace export');
   if(o.namespace&&clean(row.ip_namespace)&&row.ip_namespace!==o.namespace)throw Error('ip_namespace differs from --namespace');
   let [n]=await db.query('select * from namespaces where lower(name)=lower($1)',[ns]);
   if(!n){[n]=await db.query('insert into namespaces(name,purpose) values($1,$2) returning *',[ns,`Imported from ${source}; ownership unverified`]);await audit(db,actor,'import','namespaces',null,n);}
   if(!['active','reserved','deprecated'].includes(row.status))throw Error('Unsupported status');
   const val=kind==='prefixes'?(await db.query('select $1::cidr::text as value',[row.prefix]))[0].value:(await db.query('select $1::inet::text as value',[row.address]))[0].value;
   const [old]=await db.query(`select * from ${kind} where namespace_id=$1 and ${kind==='prefixes'?'prefix=$2::cidr':'host(address)=host($2::inet)'}`,[n.id,val]);
   if(old){if(old.source===source&&same(old.original,row)){unchanged++;continue;}throw Error('Conflicting existing record; reconcile separately, nothing is overwritten');}
   let fresh;
   if(kind==='prefixes'){
    if(!['address','prefix'].includes(row.member_type))throw Error('member_type must be address or prefix');
    if(!['True','False','true','false'].includes(row.is_pool))throw Error('is_pool must be True or False');
    [fresh]=await db.query('insert into prefixes(namespace_id,name,prefix,status,member_type,is_pool,description,role,source,original) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *',[n.id,clean(row.description)||val,val,row.status,row.member_type,row.is_pool.toLowerCase()==='true',row.description||'',row.role||'',source,JSON.stringify(row)]);
   }else{
    [fresh]=await db.query('insert into addresses(namespace_id,name,address,status,description,role,source,original) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[n.id,clean(row.fqdn)||clean(row.description)||val,val,row.status,row.description||'',row.role||'',source,JSON.stringify(row)]);
   }
   for(const k of Object.keys(row))preserved.add(k);await audit(db,actor,'import',kind,null,fresh);inserted++;
  }catch(e){throw Error(`Import row ${i+2}: ${e.message}`);}
 }
 const [batch]=await db.query('insert into import_batches(source,digest,kind,inserted,unchanged,actor) values($1,$2,$3,$4,$5,$6) returning *',[source,createHash('sha256').update(raw).digest('hex'),kind,inserted,unchanged,actor]);
 return {inserted,unchanged,batch:batch.id,preserved_columns:[...preserved],note:'Original columns preserved. Owners and review evidence require local verification. No device configuration changed.'};
}
async function operate(db,cmd,args,o){
 const actor=MUTATIONS.has(cmd)?need(o,'actor'):null;
 switch(cmd){
 case 'help':return Object.entries(COMMANDS).map(([command,options])=>({command,options:options.split(' ').filter(Boolean).map(x=>'--'+x).join(' ')+(MUTATIONS.has(command)?' --actor --dry-run':'')}));
 case 'namespaces':return db.query('select id,name,owner,purpose,review_due from namespaces order by name');
 case 'prefixes':{const n=await scope(db,o);return db.query('select p.id,n.name as namespace,p.name,p.prefix::text,p.status,p.member_type,p.owner,p.review_due from prefixes p join namespaces n on n.id=p.namespace_id where ($1::uuid is null or p.namespace_id=$1) order by n.name,p.prefix',[n]);}
 case 'addresses':case 'reservations':{const n=await scope(db,o);return db.query(`select id,namespace,name,address::text,subnet,status,owner,review_due,issue from address_register where ($1::uuid is null or namespace_id=$1) ${cmd==='reservations'?"and status='reserved'":''} order by namespace,address`,[n]);}
 case 'namespace':{const n=await resolve(db,'namespaces',args[0]);return {record:n,prefixes:await db.query('select * from capacity_review where namespace_id=$1 order by subnet',[n.id]),actions:await db.query('select * from actions where namespace_id=$1 order by due',[n.id])};}
 case 'prefix':{const p=await resolve(db,'prefixes',args[0]);return {record:p,capacity:await db.query('select * from capacity_review where id=$1',[p.id]),addresses:await db.query('select name,address::text,status,owner,issue from address_register where prefix_id=$1 order by address',[p.id])};}
 case 'address':{const a=await resolve(db,'addresses',args[0]);return {record:a,evidence:await db.query("select * from evidence where entity='addresses' and record_id=$1 order by created_at",[a.id])};}
 case 'change':return resolve(db,'changes',args[0]);
 case 'capacity':return capacity(db,o);
 case 'next-free':return nextFree(db,await resolve(db,'prefixes',args[0]));
 case 'review-due':return db.query('select * from review_queue order by review_due nulls first,record');
 case 'change-review':return db.query('select * from change_review order by due,code');
 case 'actions':return db.query('select a.id,n.name as namespace,a.title,a.owner,a.due,a.status,a.resolution from actions a join namespaces n on n.id=a.namespace_id order by a.due,a.title');
 case 'activity':return db.query('select actor,operation,entity,record_id,before_value,after_value,created_at from audit order by created_at,id');
 case 'compliance':return health(db);
 case 'weekly-review':return {capacity:await capacity(db,{}),reviews:await db.query('select * from review_queue order by record'),changes:await db.query('select * from change_review order by due'),follow_ups:await db.query("select title,owner,due from actions where status='open' order by due")};
 case 'add-namespace':{
  const [r]=await db.query('insert into namespaces(name,owner,purpose,review_due) values($1,$2,$3,$4) returning *',[need(o,'name'),need(o,'owner'),need(o,'purpose'),future(o,'review-due')]);await audit(db,actor,cmd,'namespaces',null,r);return r;
 }
 case 'add-prefix':{
  const n=await resolve(db,'namespaces',need(o,'namespace'));const member=need(o,'member-type');if(!['address','prefix'].includes(member))throw Error('--member-type must be address or prefix');
  const cidr=need(o,'prefix');
  const bad=await db.query(`select name from prefixes where namespace_id=$1 and status<>'deprecated' and
  ((prefix >> $2::cidr and member_type='address') or (prefix << $2::cidr and $3='address'))`,[n.id,cidr,member]);
  if(bad.length)throw Error('Address ranges must be leaves; use a container for nested ranges');
  const [r]=await db.query('insert into prefixes(namespace_id,name,prefix,member_type,is_pool,owner,review_due) values($1,$2,$3,$4,$5,$6,$7) returning *',[n.id,need(o,'name'),cidr,member,!!o.pool,need(o,'owner'),future(o,'review-due')]);await audit(db,actor,cmd,'prefixes',null,r);return r;
 }
 case 'propose':{
  const p=await resolve(db,'prefixes',need(o,'prefix'));await eligiblePrefix(db,p);const a=await validateAddress(db,p,need(o,'address'));
  const [r]=await db.query('insert into changes(code,prefix_id,address,name,owner,review_due,requester,reason,due) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[`CHG-${randomUUID().slice(0,8).toUpperCase()}`,p.id,a.address,need(o,'name'),need(o,'owner'),future(o,'review-due'),actor,need(o,'reason'),future(o,'due')]);await audit(db,actor,cmd,'changes',null,r);return r;
 }
 case 'decide':{
  const c=await resolve(db,'changes',args[0]);const decision=need(o,'decision');if(!['approved','rejected'].includes(decision))throw Error('--decision must be approved or rejected');
  if(c.status!=='proposed')throw Error('Change already decided');if(c.requester.toLowerCase()===actor.toLowerCase())throw Error('Reviewer must differ from requester');
  const p=(await db.query('select * from prefixes where id=$1',[c.prefix_id]))[0];let snapshot={prefix:p,decision};
  if(decision==='approved'){
   await eligiblePrefix(db,p);if(c.review_due<new Date().toISOString().slice(0,10))throw Error('Proposed review date expired');
   const a=await validateAddress(db,p,c.address);let r;
   if(a.existing){[r]=await db.query("update addresses set address=$2,name=$3,owner=$4,review_due=$5,status='reserved',description=$6 where id=$1 returning *",[a.existing.id,a.address,c.name,c.owner,c.review_due,c.reason]);}
   else{[r]=await db.query("insert into addresses(namespace_id,address,name,owner,review_due,status,description) values($1,$2,$3,$4,$5,'reserved',$6) returning *",[p.namespace_id,a.address,c.name,c.owner,c.review_due,c.reason]);}
   await audit(db,actor,'reserve','addresses',a.existing||null,r);snapshot.address=r;
  }
  const [r]=await db.query('update changes set status=$2,reviewer=$3,decision_note=$4,snapshot=$5,decided_at=now() where id=$1 returning *',[c.id,decision,actor,need(o,'note'),JSON.stringify(snapshot)]);await audit(db,actor,cmd,'changes',c,r);return r;
 }
 case 'activate':{
  const a=await resolve(db,'addresses',args[0]);if(a.status!=='reserved')throw Error('Only a reserved address can be activated');
  const ar=(await db.query('select * from address_register where id=$1',[a.id]))[0];
  if(ar.issue)throw Error(ar.issue);const p=(await db.query('select * from prefixes where id=$1',[ar.prefix_id]))[0];await eligiblePrefix(db,p);
  const reference=need(o,'reference'), note=need(o,'note');
  if(!a.owner||!a.review_due||a.review_due<new Date().toISOString().slice(0,10))throw Error('Address needs current ownership and review');
  await db.query('insert into evidence(entity,record_id,actor,reference,note,next_review) values($1,$2,$3,$4,$5,$6)',['addresses',a.id,actor,reference,note,a.review_due]);
  const [r]=await db.query("update addresses set status='active' where id=$1 returning *",[a.id]);await audit(db,actor,cmd,'addresses',a,r);return r;
 }
 case 'release':{
  const a=await resolve(db,'addresses',args[0]);if(a.status==='deprecated')throw Error('Address already deprecated');
  const [r]=await db.query("update addresses set status='deprecated',description=$2 where id=$1 returning *",[a.id,need(o,'reason')]);await audit(db,actor,cmd,'addresses',a,r);return r;
 }
 case 'review':{
  const entity=need(o,'entity');if(!['namespaces','prefixes','addresses'].includes(entity))throw Error('--entity must be namespaces, prefixes or addresses');
  const before=await resolve(db,entity,args[0]);const next=future(o,'next');
  const [ev]=await db.query('insert into evidence(entity,record_id,actor,reference,note,next_review) values($1,$2,$3,$4,$5,$6) returning *',[entity,before.id,actor,need(o,'reference'),need(o,'note'),next]);
  const [after]=await db.query(`update ${entity} set owner=$2,review_due=$3 where id=$1 returning *`,[before.id,need(o,'owner'),next]);await audit(db,actor,cmd,entity,before,after);return {record:after,evidence:ev};
 }
 case 'add-action':{
  const n=await resolve(db,'namespaces',need(o,'namespace'));const [r]=await db.query('insert into actions(namespace_id,title,owner,due) values($1,$2,$3,$4) returning *',[n.id,need(o,'title'),need(o,'owner'),future(o,'due')]);await audit(db,actor,cmd,'actions',null,r);return r;
 }
 case 'close-action':{
  const a=await resolve(db,'actions',args[0]);if(a.status!=='open')throw Error('Action already closed');const [r]=await db.query("update actions set status='closed',resolution=$2 where id=$1 returning *",[a.id,need(o,'resolution')]);await audit(db,actor,cmd,'actions',a,r);return r;
 }
 case 'import':return importData(db,args,o,actor);
 case 'export':{
  const data={format:'network-addresses/v1',exported_at:new Date().toISOString()};for(const t of TABLES)data[t]=await db.query(`select * from ${t} order by id`);
  const file=path.resolve(o.file||path.join(REPO_ROOT,'exports',`network-${randomUUID()}.json`));fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return {file,counts:Object.fromEntries(TABLES.map(t=>[t,data[t].length]))};
 }
 case 'draft-handover':{
  const n=await resolve(db,'namespaces',args[0]);const sections=[{title:'Owner and purpose',html:record(n,['name','owner','purpose','review_due'])},{title:'Address capacity',html:htmlTable(await capacity(db,{namespace:n.name}))},{title:'Follow-up work',html:htmlTable(await db.query('select title,owner,due,status from actions where namespace_id=$1 order by due',[n.id]))}];
  return {file:writeOut('drafts',`handover-${n.id}`,page({title:'Network handover draft',subtitle:'Private review copy. No network configuration changed.',sections}))};
 }
 case 'draft-change':{
  const c=await resolve(db,'changes',args[0]);return {file:writeOut('drafts',`change-${c.id}`,page({title:'Address change record',subtitle:'Inventory decision only. Device changes require separate approval.',sections:[{title:'Change',html:record(c,['code','address','name','owner','reason','due','status','requester','reviewer','decision_note'])},{title:'Decision evidence',html:htmlTable(c.snapshot?[c.snapshot]:[])}]}))};
 }
 }
}
export async function execute(db,argv){
 const {cmd,args,o}=parse(argv);
 if(MUTATIONS.has(cmd)){
  need(o,'actor');await db.exec('BEGIN');
  try{
   // Serialize inventory writers so imports and approvals cannot race each other.
   await db.exec('LOCK TABLE namespaces, prefixes, addresses, changes, actions IN SHARE ROW EXCLUSIVE MODE');
   const data=await operate(db,cmd,args,o);await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');return {command:cmd,dry_run:!!o['dry-run'],data};
  }catch(e){await db.exec('ROLLBACK');throw e;}
 }
 await db.exec('BEGIN READ ONLY');try{return {command:cmd,data:await operate(db,cmd,args,o)};}finally{await db.exec('ROLLBACK');}
}
function human(value,title){
 if(Array.isArray(value)){const rows=value.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v&&typeof v==='object'?JSON.stringify(v):v])));return heading(title)+'\n'+table(rows,Object.keys(rows[0]||{}).map(key=>({key,label:key,width:48})));}
 if(value&&typeof value==='object'){const entries=Object.entries(value);if(entries.some(([,v])=>Array.isArray(v)))return entries.map(([k,v])=>human(v,k)).join('\n');return human(entries.map(([field,v])=>({field,value:typeof v==='object'?JSON.stringify(v):v})),title);}
 return `${title}: ${value}`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{db=await getDb();const result=await execute(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):`${result.dry_run?'Preview only, rolled back.\n':''}${human(result.data,result.command)}`);}
 catch(e){if(process.argv.includes('--json'))console.error(JSON.stringify({error:e.message}));else console.error(e.message);process.exitCode=1;}
 finally{if(db)await db.close();}
}
