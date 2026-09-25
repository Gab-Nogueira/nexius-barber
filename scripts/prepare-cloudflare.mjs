import { readFile, writeFile, access } from 'node:fs/promises';
const [databaseId,bucketName,workerName='nexius-barber-demo']=process.argv.slice(2);
if(!/^[a-f0-9-]{36}$/i.test(databaseId||'')||!databaseId.replace(/[-0]/g,'')||!/^[-a-z0-9]{3,63}$/.test(bucketName||'')||!/^[-a-z0-9]{3,63}$/.test(workerName))throw new Error('Uso: node scripts/prepare-cloudflare.mjs ID_REAL_DO_D1 NOME_DO_BUCKET [NOME_DO_WORKER]');
await access('dist/server/index.js');
const built=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
const config={name:workerName,main:'dist/server/index.js',compatibility_date:built.compatibility_date,compatibility_flags:built.compatibility_flags,no_bundle:true,rules:built.rules,
  assets:{directory:'dist/client'},d1_databases:[{binding:'DB',database_name:'nexius-demo',database_id:databaseId,migrations_dir:'drizzle'}],r2_buckets:[{binding:'FILES',bucket_name:bucketName}],
  vars:{DEMO_MODE:'true',AUTH_MODE:'supabase'},observability:{enabled:true},workers_dev:true};
await writeFile('wrangler.cloudflare.json',JSON.stringify(config,null,2));
console.log('wrangler.cloudflare.json gerado. Nenhum recurso foi criado e nada foi publicado. Configure os segredos do acesso antes do deploy. Este arquivo preserva DEMO_MODE=true.');
