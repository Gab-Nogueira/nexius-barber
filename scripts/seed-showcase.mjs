const base='http://localhost:3000',key='nexius-showcase-demo-2026';
import { localSql } from './staff-account.mjs';
const prior=await localSql(`SELECT id FROM bookings WHERE idempotency_key LIKE '%:${key}' LIMIT 1;`);
if(prior[0]?.results?.length){console.log('A reserva sintetica de apresentacao ja foi criada.');process.exit(0);}
await fetch(`${base}/api/catalog`);
const login=await fetch(`${base}/api/session`,{method:'POST'});
if(!login.ok)throw new Error('Nao foi possivel criar a sessao demonstrativa.');
const Cookie=login.headers.get('set-cookie').split(';')[0];
const existing=await fetch(`${base}/api/bookings/attempt?key=${key}`,{headers:{Cookie}});
if(existing.ok){console.log('A reserva demonstrativa de apresentação já existe.');process.exit(0);}
for(let offset=1;offset<30;offset++){
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(Date.now()+offset*86400000));
  const available=await(await fetch(`${base}/api/availability?service=srv-corte&professional=pro-ismael&date=${date}`)).json();
  const slot=available.slots?.[0];if(!slot)continue;
  const response=await fetch(`${base}/api/bookings`,{method:'POST',headers:{Cookie,'Content-Type':'application/json'},body:JSON.stringify({serviceIds:['srv-corte'],professionalId:slot.professionalId,startAt:slot.startAt,quoteRevision:slot.quoteRevision,name:'Cliente demonstrativo',phone:'12999999999',idempotencyKey:key})});
  const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));console.log(`Reserva sintética de apresentação: ${result.booking.reference}.`);process.exit(0);
}
throw new Error('Nenhum horário disponível para a reserva de demonstração.');
