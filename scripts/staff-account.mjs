import { randomBytes, scryptSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function localSql(sql) {
  const directory = await mkdtemp(join(tmpdir(), 'nexius-account-'));
  const file = join(directory, 'account.sql');
  try {
    await writeFile(file, sql, { mode: 0o600 });
    return JSON.parse(execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.local.jsonc','--file',file,'--json'], { encoding:'utf8',windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:'false'} }));
  } finally { await rm(file,{force:true}); await rmdir(directory); }
}
const literal = value => `'${String(value).replace(/'/g,"''")}'`;
export async function provisionLocalStaff(username, password, role = 'admin') {
  if(!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('Usuario: 3 a 40 letras minusculas, numeros, ponto, hifen ou sublinhado.');
  if(password.length<12||password.length>256) throw new Error('Use uma senha de 12 a 256 caracteres.');
  if(!['admin','professional'].includes(role))throw new Error('Papel invalido.');
  const id=`staff_${username}`,salt=randomBytes(16).toString('hex');
  const hash=`scrypt-v1$${salt}$${scryptSync(password,salt,32,{N:32768,r:8,p:3,maxmem:64*1024*1024}).toString('hex')}`;
  const now=new Date().toISOString();
  await localSql(`INSERT INTO users(id,email,name,role,created_at,updated_at) VALUES(${literal(id)},${literal(`${id}@staff.invalid`)},${literal(username)},${literal(role)},${literal(now)},${literal(now)}) ON CONFLICT(id) DO UPDATE SET role=excluded.role,updated_at=excluded.updated_at;
    INSERT INTO credentials(user_id,username,password_hash,updated_at) VALUES(${literal(id)},${literal(username)},${literal(hash)},${literal(now)}) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at;
    DELETE FROM sessions WHERE user_id=${literal(id)};`);
  return id;
}
