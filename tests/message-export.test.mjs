import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function load(file){const source=await readFile(new URL(file,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
const {formatBookingWhatsApp}=await load('../lib/booking-message-format.ts');
const {agendaCsv,filterAgenda}=await load('../lib/agenda-export.ts');
const booking={reference:'NXS-TESTE',clientName:'João & Ana',clientPhone:'12999999999',timezone:'America/Sao_Paulo',professionalId:'p1',professionalName:'Ismael',startAt:'2026-10-01T12:00:00.000Z',endAt:'2026-10-01T12:45:00.000Z',status:'confirmed',totalCents:4000,cancellationLimitHours:4,services:[{name:'Corte'}]};
test('WhatsApp exige número confirmado com país',()=>{for(const number of ['', '12988149114','javascript:alert(1)'])assert.equal(formatBookingWhatsApp(booking,number,'Endereço',true),null);});
test('mensagem preserva nome, horário local, valor, referência e política',()=>{const url=new URL(formatBookingWhatsApp(booking,'5512999999999','Endereço demonstrativo',true));assert.equal(url.origin,'https://wa.me');const text=url.searchParams.get('text');for(const value of ['João & Ana','09:00','40,00','NXS-TESTE','4 horas','DEMONSTRAÇÃO','Confirmado'])assert.ok(text.includes(value),value);});
test('mensagem não apresenta cancelamento como confirmação',()=>{const text=new URL(formatBookingWhatsApp({...booking,status:'cancelled'},'5512999999999','Endereço',true)).searchParams.get('text');assert.ok(text.includes('Situação: Cancelado'));});
test('planilha contém BOM, escapa aspas e neutraliza fórmula',()=>{const csv=agendaCsv([{...booking,clientName:'  =HYPERLINK("x")'}],booking.timezone);assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes("'  =HYPERLINK("));assert.ok(csv.includes('""x""'));assert.ok(csv.includes('"40,00"'));});
test('filtro usa dia da unidade, nome sem acento e profissional',()=>{const rows=[booking,{...booking,reference:'NXS-OUTRO',professionalId:'p2',startAt:'2026-10-02T02:00:00.000Z'}];assert.equal(filterAgenda(rows,{date:'2026-10-01',search:'joao'},booking.timezone).length,2);assert.equal(filterAgenda(rows,{date:'2026-10-01',professional:'p1'},booking.timezone).length,1);assert.equal(filterAgenda(rows,{date:'2026-10-02'},booking.timezone).length,0);});
