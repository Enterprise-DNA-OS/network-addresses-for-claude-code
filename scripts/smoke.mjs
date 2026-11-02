import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { execute, COMMANDS } from './network.mjs';
import { parseCsv } from './lib/csv.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'network-address-test-'));
process.env.DATA_DIR=path.join(tmp,'db');process.env.OUTPUT_DIR=tmp;
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';
const db=await getDb();const seen=new Set();
const run=async(cmd,...args)=>{seen.add(cmd);return (await execute(db,[cmd,...args])).data;};
const today=new Date();const future=new Date(today.getTime()+90*86400000).toISOString().slice(0,10);
const actor='--actor=Test operator';
const queryCount=async table=>Number((await db.query(`select count(*) as n from ${table}`))[0].n);
const reject=async(cmd,args,pattern)=>assert.rejects(()=>run(cmd,...args),pattern);
const file=(name,text)=>{const p=path.join(tmp,name);fs.writeFileSync(p,text);return p;};
function child(script,args=[]){const r=spawnSync(process.execPath,[script,...args],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
try{
 if(db.mode==='postgres'){
  // Only a dedicated empty test database is accepted; never drop a schema.
  const rows=await db.query("select tablename from pg_tables where schemaname='public'");assert.equal(rows.length,0,'TEST_DATABASE_URL must point to an empty disposable database');
 }
 assert.equal((await migrate(db)).ran.length,3);assert.equal((await migrate(db)).ran.length,0);
 await seed(db);const n=await queryCount('addresses');await seed(db);assert.equal(await queryCount('addresses'),n);
 for(const c of ['help','namespaces','prefixes','addresses','reservations','review-due','change-review','actions','activity','compliance','weekly-review'])assert.ok(await run(c));
 const cap=await run('capacity');const printers=cap.find(r=>r.name==='Office printers');assert.equal(printers.capacity,'6');assert.equal(printers.available,'1');assert.equal(printers.used_percent,'83.33');
 assert.equal(cap.find(r=>r.name==='Office IPv6').capacity,'18446744073709551616');assert.equal(cap.find(r=>r.name==='Office uplink').capacity,'2');
 assert.equal((await run('next-free','Office printers')).address,'10.20.1.6/29');
 assert.equal((await run('next-free','Office uplink')).address,'192.0.2.0/31');
 assert.equal((await run('next-free','Office IPv6')).address,'2001:db8:10::/64');
 await run('namespace','HARBOUR OFFICE');await run('prefix','Office printers');await run('address','Accounts printer');await run('change','chg-demo');
 await reject('prefix',['Office'],/Ambiguous/);await reject('namespace',['missing'],/No matching/);
 await reject('addresses',['--typo'],/Unknown option/);await reject('propose',[],/actor/);
 const before=await queryCount('audit');await run('add-namespace','--name=Preview','--owner=One','--purpose=Preview',`--review-due=${future}`,actor,'--dry-run');assert.equal(await queryCount('audit'),before);assert.equal((await run('namespaces')).length,2);
 const ns=await run('add-namespace','--name=Test lab','--owner=One','--purpose=Isolated tests',`--review-due=${future}`,actor);
 const addPrefix=async(name,cidr,member='address')=>run('add-prefix','--namespace=Test lab',`--name=${name}`,`--prefix=${cidr}`,`--member-type=${member}`,'--owner=One',`--review-due=${future}`,actor);
 await addPrefix('Test aggregate','172.16.0.0/16','prefix');await addPrefix('Test leaf','172.16.0.0/30');
 await reject('add-prefix',['--namespace=Test lab','--name=Nested','--prefix=172.16.0.0/31','--member-type=address','--owner=One',`--review-due=${future}`,actor],/leaves/);
 await reject('add-prefix',['--namespace=Test lab','--name=Invalid','--prefix=172.16.2.1/24','--member-type=address','--owner=One',`--review-due=${future}`,actor],/bits|cidr|invalid/i);
 await addPrefix('Single host','172.16.3.9/32');assert.equal((await run('next-free','Single host')).address,'172.16.3.9/32');
 const propose=async(name,address,prefix='Test leaf')=>run('propose',`--prefix=${prefix}`,`--address=${address}`,`--name=${name}`,'--owner=One',`--review-due=${future}`,'--reason=Add lab endpoint',`--due=${future}`,actor);
 await reject('propose',['--prefix=Office printers','--address=10.20.1.1','--name=Dupe','--owner=One',`--review-due=${future}`,'--reason=Test',`--due=${future}`,actor],/already active/);
 for(const ip of ['172.16.0.0','172.16.0.3','172.16.4.1'])await assert.rejects(()=>propose('Invalid',ip),/outside|boundary/);
 await assert.rejects(()=>propose('Stale','10.20.1.2','Warehouse scanners'),/current review/);
 const c1=await propose('Endpoint one','172.16.0.1');const c2=await propose('Conflicting request','172.16.0.1');
 await reject('decide',[c1.id,'--decision=approved','--note=Self',actor],/Reviewer must differ/);
 const decided=await run('decide',c1.id,'--decision=approved','--note=Confirmed design','--actor=Second operator');assert.ok(decided.snapshot.address);assert.equal(decided.status,'approved');
 await reject('decide',[c2.id,'--decision=approved','--note=Conflict','--actor=Second operator'],/already reserved/);
 await run('decide',c2.id,'--decision=rejected','--note=Duplicate','--actor=Second operator');
 await reject('decide',[c1.id,'--decision=approved','--note=Again','--actor=Second operator'],/already decided/);
 const reserved=(await run('addresses','--namespace=Test lab')).find(a=>a.name==='Endpoint one');
 await run('activate',reserved.id,'--reference=NET-TEST-01','--note=Operator verified deployment separately',actor);
 await reject('activate',[reserved.id,'--reference=Again','--note=Again',actor],/Only a reserved/);
 assert.equal((await run('next-free','Test leaf')).address,'172.16.0.2/30');
 const c3=await propose('Endpoint two','172.16.0.2');await run('decide',c3.id,'--decision=approved','--note=Confirmed','--actor=Second operator');
 await reject('next-free',['Test leaf'],/No free/);
 const adr=(await run('addresses','--namespace=Test lab')).find(a=>a.name==='Endpoint one');await run('release',adr.id,'--reason=Physically disconnected',actor);assert.equal((await run('next-free','Test leaf')).address,'172.16.0.1/30');
 const c4=await propose('Reused address','172.16.0.1');await run('decide',c4.id,'--decision=approved','--note=Reuse confirmed','--actor=Second operator');assert.equal((await run('addresses','--namespace=Test lab')).filter(a=>a.name==='Reused address').length,1);
 await run('review','Warehouse scanners','--entity=prefixes','--owner=Alex Chen',`--next=${future}`,'--reference=SITE-TEST-01','--note=Verified against authorised export',actor);
 assert.ok((await run('review-due')).every(r=>r.record!=='Warehouse scanners'));
 const action=await run('add-action','--namespace=Test lab','--title=Review firewall','--owner=One',`--due=${future}`,actor);
 await run('close-action',action.id,'--resolution=Confirmed separately',actor);
 await reject('close-action',[action.id,'--resolution=Again',actor],/already closed/);
 for(const kind of ['prefixes','addresses']){
  const args=['infrahub',`--kind=${kind}`,`--file=fixtures/infrahub-${kind}.csv`,'--source=demo-export',actor];
  const pre=await queryCount(kind);const preview=await run('import',...args,'--dry-run');assert.equal(preview.inserted,2);assert.equal(await queryCount(kind),pre);
  assert.equal((await run('import',...args)).inserted,2);assert.equal((await run('import',...args)).unchanged,2);
 }
 const imported=(await db.query("select * from addresses where source='demo-export' order by name"));assert.equal(imported[0].original.interface,'router-01 / eth0');assert.equal(imported[0].owner,'');
 const wide=file('wide-mask.csv','address,status,description,ip_namespace\n198.51.100.2/24,active,Wider mask,Export Lab\n');
 await run('import','infrahub','--kind=addresses',`--file=${wide}`,'--source=wide',actor);
 assert.equal((await db.query("select subnet from address_register where name='Wider mask'"))[0].subnet,'198.51.100.0/29');
 const bad=file('bad.csv','address,status,description,ip_namespace\n203.0.113.1/24,active,First,Bad lab\nnot-an-ip,active,Second,Bad lab\n');
 const size=await queryCount('addresses');await reject('import',['infrahub','--kind=addresses',`--file=${bad}`,'--source=bad',actor],/row 3/);assert.equal(await queryCount('addresses'),size);assert.equal((await db.query("select * from namespaces where name='Bad lab'")).length,0);
 const conflict=file('conflict.csv',fs.readFileSync(path.join(REPO_ROOT,'fixtures/infrahub-addresses.csv'),'utf8').replace('north','south'));
 await reject('import',['infrahub','--kind=addresses',`--file=${conflict}`,'--source=demo-export',actor],/Conflicting existing/);
 const missing=file('missing.csv','address,status\n203.0.113.1/24,active\n');await reject('import',['infrahub','--kind=addresses',`--file=${missing}`,'--source=test',actor],/namespace/);
 assert.throws(()=>parseCsv('a,a\n1,2'),/unique/);assert.throws(()=>parseCsv('a,b\n"unfinished'),/unclosed/);
 assert.equal(parseCsv('\ufeffa,b\r\n"hello\nworld","say ""yes"""\r\n')[0].b,'say "yes"');
 await db.query("update namespaces set purpose='<script>alert(1)</script>' where id=$1",[ns.id]);
 const draft=await run('draft-handover','Test lab');const html=fs.readFileSync(draft.file,'utf8');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 await run('draft-change',c1.id);
 const exported=await run('export',`--file=${path.join(tmp,'portable.json')}`);const payload=JSON.parse(fs.readFileSync(exported.file,'utf8'));assert.equal(payload.addresses.length,await queryCount('addresses'));assert.ok(payload.audit.some(r=>r.before_value&&r.after_value));
 await reject('export',[`--file=${exported.file}`],/EEXIST/);
 const missingCommands=Object.keys(COMMANDS).filter(c=>!seen.has(c));assert.deepEqual(missingCommands,[]);
 // Child processes get a closed PGlite store. On PostgreSQL they use the same disposable database.
 await db.close();
 child('scripts/view.mjs');child('scripts/docs.mjs');const json=JSON.parse(child('scripts/network.mjs',['capacity','--json']));assert.ok(Array.isArray(json.data));
 const invalid=spawnSync(process.execPath,['scripts/network.mjs','prefix','Office','--json'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(invalid.status,1);assert.match(JSON.parse(invalid.stderr).error,/Ambiguous/);
 assert.ok(fs.existsSync(path.join(tmp,'views/week.html')));assert.ok(fs.readdirSync(path.join(tmp,'docs-out/network-handover')).length>=3);
 console.log(`PASS: ${Object.keys(COMMANDS).length} CLI commands; capacity, IPv6, /31, /32, namespace isolation, review gates, conflicts, dry-run, import rollback, duplicate imports, evidence, audit, portable export and escaped HTML (${process.platform}, ${db.mode}).`);
}catch(e){await db.close().catch(()=>{});throw e;}
finally{fs.rmSync(tmp,{recursive:true,force:true});}
