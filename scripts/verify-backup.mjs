import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { adminSession } from './admin-session.mjs';
const mode=process.argv[2],base=process.env.TEST_BASE_URL||'http://localhost:3000';
if(!['before','after'].includes(mode))throw new Error('Uso: node scripts/verify-backup.mjs before|after');
const Cookie=await adminSession(base);
const response=await fetch(`${base}/api/admin`,{headers:{Cookie}});assert.equal(response.status,200);
const data=await response.json(),hash=(value)=>createHash('sha256').update(value).digest('hex');
const files=[];
for(const media of data.management.media){const r=await fetch(`${base}/api/media/${media.id}`);assert.equal(r.status,200);files.push({id:media.id,sha256:hash(Buffer.from(await r.arrayBuffer()))});}
files.sort((a,b)=>a.id.localeCompare(b.id));
const snapshot={bookingCount:data.bookings.length,bookingsHash:hash(JSON.stringify(data.bookings)),catalogHash:hash(JSON.stringify(data.management)),settingsHash:hash(JSON.stringify(data.settings)),files};
await mkdir('outputs',{recursive:true});
if(mode==='before'){await writeFile('outputs/backup-baseline.json',JSON.stringify(snapshot,null,2));console.log(`Baseline: ${snapshot.bookingCount} reservas, ${files.length} objetos R2.`);}
else{const expected=JSON.parse(await readFile('outputs/backup-baseline.json','utf8'));assert.deepEqual(snapshot,expected);console.log(`Restauração verificada: ${snapshot.bookingCount} reservas, catálogo, políticas e ${files.length} objetos R2 com SHA-256 idênticos.`);}
