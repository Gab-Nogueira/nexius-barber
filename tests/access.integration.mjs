import assert from 'node:assert/strict';
import test from 'node:test';
import { testAdmin } from './local-auth.mjs';
import { localSql } from '../scripts/staff-account.mjs';
import { createHash } from 'node:crypto';

const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const admin=await testAdmin(base);let first,second,booking;
const headers=cookie=>({Cookie:cookie,'Content-Type':'application/json'});
async function guest(){const r=await fetch(base+'/api/session',{method:'POST'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);return cookie.split(';')[0];}
async function request(path,cookie,body,method='POST'){const r=await fetch(base+path,{headers:headers(cookie),method:body?method:'GET',...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}

test('acesso por senha, reserva sem conta e exportação',async t=>{
  await t.test('gestão exige senha mesmo na demonstração',async()=>{
    assert.equal((await fetch(base+'/api/admin')).status,401);
    assert.equal((await fetch(base+'/api/admin',{headers:{'oai-authenticated-user-id':admin.userId,'oai-authenticated-user-email':'admin@example.test'}})).status,401);
    assert.equal((await request('/api/admin',admin.cookie)).status,200);
  });
  await t.test('sessão anônima não concede permissões de equipe',async()=>{
    first=await guest();second=await guest();
    for(const path of ['/api/admin','/api/professional','/api/admin/export?date=2026-09-22'])assert.equal((await fetch(base+path,{headers:headers(first)})).status,403);
    const same=await fetch(base+'/api/session',{method:'POST',headers:headers(first)});assert.equal(same.status,200);assert.equal(same.headers.get('set-cookie'),null);
  });
  await t.test('reserva sem login guarda email sem usá-lo como identidade',async()=>{
    let slot;
    for(let offset=18;offset<27&&!slot;offset++){const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(Date.now()+offset*86400000));slot=(await(await fetch(`${base}/api/availability?service=srv-corte&professional=pro-ismael&date=${date}`)).json()).slots?.at(-1);}
    assert.ok(slot);const key=crypto.randomUUID();
    const body={serviceIds:['srv-corte'],professionalId:slot.professionalId,startAt:slot.startAt,quoteRevision:slot.quoteRevision,name:'=Teste planilha segura',phone:'12999999999',email:'cliente@example.test',idempotencyKey:key};
    for(const email of ['invalido', 'a@b.test\r\nBCC:evil', 'a'.repeat(250)+'@b.test']) assert.equal((await request('/api/bookings',first,{...body,email})).status,400);
    const result=await request('/api/bookings',first,body);assert.equal(result.status,201,JSON.stringify(result.data));booking=result.data.booking;
    assert.equal((await request('/api/bookings',first,body)).data.booking.id,booking.id);
    assert.equal(booking.clientEmail,body.email);
    assert.equal((await request('/api/bookings',first,{...body,email:'outro@example.test'})).status,409);
    assert.equal((await request(`/api/bookings/attempt?key=${key}`,first)).data.booking.id,booking.id);
    assert.equal((await request(`/api/bookings/attempt?key=${key}`,second)).status,404);
  });
  await t.test('calendários são privados e exportam lembrete sem contato pessoal',async()=>{
    const path=`/api/bookings/${booking.id}/calendar`;
    assert.equal((await fetch(base+path)).status,401);
    assert.equal((await fetch(base+path,{headers:headers(second)})).status,404);
    assert.equal((await fetch(base+path+'?provider=google',{headers:headers(second),redirect:'manual'})).status,404);
    const response=await fetch(base+path,{headers:headers(first)});assert.equal(response.status,200);
    assert.match(response.headers.get('cache-control'),/private, no-store/);
    const ics=await response.text();assert.ok(ics.includes('TRIGGER:-PT1H'));assert.ok(!ics.includes(booking.clientEmail));
    const google=await fetch(base+path+'?provider=google',{headers:headers(first),redirect:'manual'});
    assert.equal(google.status,302);assert.equal(new URL(google.headers.get('location')).origin,'https://calendar.google.com');
  });
  await t.test('mesmo telefone não revela nem permite alterar outra reserva',async()=>{
    assert.equal((await request('/api/account',second,{name:'Outra pessoa',phone:'12999999999'},'PATCH')).status,200);
    assert.equal((await request('/api/bookings',second)).data.bookings.length,0);
    assert.equal((await request(`/api/bookings/${booking.id}`,second)).status,404);
    assert.equal((await request(`/api/bookings/${booking.id}`,second,{action:'cancel'},'PATCH')).status,404);
    const date=booking.startAt.slice(0,10);
    assert.equal((await request(`/api/availability?exclude=${booking.id}&service=srv-corte&professional=pro-ismael&date=${date}`,second)).status,404);
  });
  await t.test('CSV é autorizado, respeita o dia e neutraliza fórmulas',async()=>{
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:booking.timezone}).format(new Date(booking.startAt));
    const result=await fetch(`${base}/api/admin/export?date=${date}&search=${encodeURIComponent(booking.reference)}`,{headers:headers(admin.cookie)});
    assert.equal(result.status,200);assert.match(result.headers.get('content-type'),/text\/csv/);assert.match(result.headers.get('cache-control'),/no-store/);
    const csv=await result.text();assert.ok(csv.includes(booking.reference));assert.ok(csv.includes("'=Teste planilha segura"));assert.equal(csv.trim().split('\r\n').length,2);
    assert.equal((await request('/api/admin/export?date=2026-02-31',admin.cookie)).status,400);
  });
  await t.test('cliente cancela e a agenda reflete o estado',async()=>{
    assert.equal((await request(`/api/bookings/${booking.id}`,first,{action:'cancel'},'PATCH')).status,200);
    const all=(await request('/api/admin',admin.cookie)).data.bookings;assert.equal(all.find(b=>b.id===booking.id).status,'cancelled');
    const calendar=await fetch(base+`/api/bookings/${booking.id}/calendar`,{headers:headers(first)});const ics=await calendar.text();assert.ok(ics.includes('STATUS:CANCELLED'));assert.ok(!ics.includes('BEGIN:VALARM'));
  });
  await t.test('logout revoga a sessão no servidor',async()=>{
    const r=await fetch(base+'/api/session',{method:'DELETE',headers:headers(second)});assert.equal(r.status,200);
    assert.equal((await request('/api/bookings',second)).status,401);
  });
  await t.test('sessão expirada é recusada',async()=>{
    const hash=createHash('sha256').update(first.split('=')[1]).digest('hex');await localSql(`UPDATE sessions SET expires_at=0 WHERE token_hash='${hash}';`);
    assert.equal((await request('/api/bookings',first)).status,401);
  });
  await t.test('senha incorreta e excesso de tentativas são bloqueados',async()=>{
    for(let i=0;i<7;i++)assert.equal((await request('/api/login','',{username:admin.username,password:'senha errada de teste'})).status,401);
    assert.equal((await request('/api/login','',{username:admin.username,password:admin.password})).status,429);
  });
  await t.test('login e sessão recusam mutação de outra origem',async()=>{
    for(const path of ['/api/login','/api/session']){const response=await fetch(base+path,{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);}
  });
});
test.after(async()=>{if(booking)await request('/api/admin',admin.cookie,{action:'booking.status',bookingId:booking.id,status:'cancelled'});await admin.dispose();});
