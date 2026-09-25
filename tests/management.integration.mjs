import assert from 'node:assert/strict';
import test from 'node:test';
import { testAdmin } from './local-auth.mjs';

const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const {cookie,dispose}=await testAdmin(base);
const prefix=`qa-${Date.now()}`;
let baseline, pro, category, main, addon, combo;
const created=[];
async function request(path,body){const response=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
async function admin(body){return request('/api/admin',body);}
function date(offset=3){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(Date.now()+offset*86400000));}
async function slots(ids=[main],offset=3){const params=new URLSearchParams({date:date(offset),professional:pro});ids.forEach((id)=>params.append('service',id));return request(`/api/availability?${params}`);}
async function reserve(slot,ids=[main],extra={}){const result=await request('/api/bookings',{serviceIds:ids,professionalId:pro,startAt:slot.startAt,quoteRevision:slot.quoteRevision,name:'QA isolado demonstrativo',phone:'12999999999',idempotencyKey:crypto.randomUUID(),...extra});if(result.status===201)created.push(result.data.booking.id);return result;}

test('gestão completa e regras adicionais',async(t)=>{
  baseline=(await request('/api/admin')).data;
  category=(await admin({action:'category.save',name:`${prefix} Testes`,active:true,displayOrder:999})).data.id;
  const service=async(name,extra={})=>{const result=await admin({action:'service.save',categoryId:category,name:`${prefix} ${name}`,priceCents:2000,durationMinutes:45,active:true,source:'demo',displayOrder:999,...extra});assert.equal(result.status,200,JSON.stringify(result.data));return result.data.id;};
  main=await service('Principal');addon=await service('Adicional',{requiresServiceId:main,durationMinutes:15});combo=await service('Combo',{comboServiceIds:[main],durationMinutes:45});
  const prof=await admin({action:'professional.save',name:`${prefix} Profissional fictício`,active:true,relations:[main,addon,combo].map((serviceId)=>({serviceId,priceCents:2500,durationMinutes:null}))});assert.equal(prof.status,200,JSON.stringify(prof.data));pro=prof.data.id;
  const grade=await admin({action:'schedule.save',professionalId:pro,schedules:Array.from({length:7},(_,weekday)=>({weekday,startMinute:540,endMinute:1080,breakStartMinute:720,breakEndMinute:780}))});assert.equal(grade.status,200);
  // Find a weekday on which the business unit itself is open.
  let offset=3;while(!(await slots([main],offset)).data.slots?.length)offset++;
  await t.test('criação de categoria, serviço, profissional e grade reflete no catálogo',async()=>{const result=await request('/api/catalog');assert.ok(result.data.professionals.some((item)=>item.id===pro&&item.serviceIds.includes(main)));assert.ok(result.data.services.some((item)=>item.id===main));});
  await t.test('adicional não é reservável isoladamente',async()=>{const result=await slots([addon],offset);assert.equal(result.status,409);assert.equal(result.data.code,'missing_required_service');});
  await t.test('combo e componente não podem ser cobrados juntos',async()=>{const result=await slots([combo,main],offset);assert.equal(result.status,409);assert.equal(result.data.code,'duplicate_combo_service');});
  await t.test('duas requisições simultâneas parcialmente sobrepostas são serializadas',async()=>{const available=(await slots([main],offset)).data.slots;const first=available.find((item)=>item.time==='09:00'),second=available.find((item)=>item.time==='09:30');const results=await Promise.all([reserve(first),reserve(second)]);assert.deepEqual(results.map((item)=>item.status).sort((a,b)=>a-b),[201,409]);});
  await t.test('alterar grade lista conflito e mantém escala anterior',async()=>{const result=await admin({action:'schedule.save',professionalId:pro,schedules:[]});assert.equal(result.status,409);assert.equal(result.data.code,'schedule_has_conflicts');assert.ok(result.data.conflicts.length);});
  await t.test('preço por profissional e snapshots da remarcação são coerentes',async()=>{const slot=(await slots([main],offset)).data.slots.at(-1);const result=await reserve(slot);assert.equal(result.status,201);assert.equal(result.data.booking.totalCents,2500);assert.equal(result.data.booking.services[0].priceCents,2500);const target=(await slots([main],offset)).data.slots.at(-1);const moved=await admin({action:'booking.reschedule',bookingId:result.data.booking.id,professionalId:pro,startAt:target.startAt,quoteRevision:target.quoteRevision});assert.equal(moved.status,200);assert.equal(moved.data.booking.services.reduce((sum,item)=>sum+item.priceCents,0),moved.data.booking.totalCents);});
  await t.test('mudança de preço entre consulta e confirmação exige revisão',async()=>{const slot=(await slots([main],offset)).data.slots[0];assert.equal((await admin({action:'service.update',serviceId:main,priceCents:2300,durationMinutes:45,active:true})).status,200);const result=await reserve(slot);assert.equal(result.status,409);assert.equal(result.data.code,'configuration_changed');});
  await t.test('desativar profissional com futuras reservas é recusado',async()=>{const result=await admin({action:'professional.save',id:pro,name:'QA teste',active:false,relations:[{serviceId:main}]});assert.equal(result.status,409);assert.equal(result.data.code,'professional_has_future_bookings');});
  await t.test('conta sem vinculação profissional não altera a agenda profissional',async()=>{const result=await request('/api/professional',{action:'booking.status',bookingId:created[0],status:'completed'});assert.equal(result.status,403);assert.equal(result.data.code,'professional_not_linked');});
  await t.test('requisição de mutação cross-origin é rejeitada',async()=>{const result=await fetch(`${base}/api/admin`,{method:'POST',headers:{Cookie:cookie,Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify({action:'category.save',name:'Não deve gravar',active:true})});assert.equal(result.status,403);});
  await t.test('arquivo declarado PNG sem assinatura é recusado',async()=>{const form=new FormData();form.set('file',new Blob(['not an image'],{type:'image/png'}),'fake.png');form.set('altText','Teste inválido');const result=await fetch(`${base}/api/admin/upload`,{method:'POST',headers:{Cookie:cookie},body:form});assert.equal(result.status,400);});
  await t.test('buffer evita reserva adjacente após o final do atendimento',async()=>{assert.equal((await admin({action:'settings.save',...baseline.settings,defaultBufferMinutes:30})).status,200);let day=offset+1;while(!(await slots([main],day)).data.slots?.length)day++;const available=(await slots([main],day)).data.slots;const result=await reserve(available[0]);assert.equal(result.status,201);const after=(await slots([main],day)).data.slots;const end=Date.parse(result.data.booking.endAt);assert.ok(!after.some((item)=>Date.parse(item.startAt)>=end&&Date.parse(item.startAt)<end+30*60000));assert.equal((await admin({action:'settings.save',...baseline.settings})).status,200);});
  await t.test('prazo de remarcação e cancelamento é registrado por reserva',async()=>{assert.equal((await admin({action:'settings.save',...baseline.settings,cancellationLimitHours:168})).status,200);const available=(await slots([main],offset)).data.slots;const result=await reserve(available[0]);assert.equal(result.status,201);assert.equal((await admin({action:'settings.save',...baseline.settings})).status,200);for(const body of [{action:'cancel'},{action:'reschedule',professionalId:pro,startAt:available.at(-1).startAt,quoteRevision:available.at(-1).quoteRevision}]){const response=await fetch(`${base}/api/bookings/${result.data.booking.id}`,{method:'PATCH',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,409);const data=await response.json();assert.ok(['cancellation_deadline','reschedule_deadline'].includes(data.code));}});
  await t.test('recuperação após timeout encontra a mesma tentativa',async()=>{const slot=(await slots([main],offset)).data.slots[0],key=crypto.randomUUID();const result=await reserve(slot,[main],{idempotencyKey:key});assert.equal(result.status,201);const recovered=await request(`/api/bookings/attempt?key=${key}`);assert.equal(recovered.status,200);assert.equal(recovered.data.booking.id,result.data.booking.id);});
  await t.test('indicadores calculam minutos reais da grade',async()=>{const result=await request('/api/admin');assert.ok(result.data.indicators.availableMinutes>0);assert.ok(result.data.indicators.occupiedMinutes>=0);assert.ok(result.data.indicators.occupancyPercent<=100);});
});

test.after(async()=>{
  for(const bookingId of created)await admin({action:'booking.status',bookingId,status:'cancelled'});
  if(baseline)await admin({action:'settings.save',...baseline.settings});
  if(pro)await admin({action:'professional.save',id:pro,name:`${prefix} Profissional fictício`,active:false,relations:[]});
  for(const serviceId of [main,addon,combo].filter(Boolean))await admin({action:'service.update',serviceId,priceCents:2000,durationMinutes:45,active:false});
  if(category)await admin({action:'category.save',id:category,name:`${prefix} Testes`,active:false,displayOrder:999});
  await dispose();
});
