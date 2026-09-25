import test from 'node:test';
import assert from 'node:assert/strict';
import { previewImport } from '../scripts/preview-import.mjs';
const input={source:'teste',serviceMap:{Corte:'corte'},professionalMap:{Pessoa:'prof'},catalog:{services:[{id:'corte',durationMinutes:45}],professionals:[{id:'prof',serviceIds:['corte']}]},existing:[]};
const row={externalId:'1',professional:'Pessoa',services:['Corte'],startAt:'2026-10-01T09:00:00-03:00'};
test('prévia mapeia sem gravar e normaliza fuso',()=>{const result=previewImport({...input,rows:[row]});assert.equal(result.readOnly,true);assert.equal(result.rows[0].startAt,'2026-10-01T12:00:00.000Z');assert.equal(result.rows[0].status,'validar_disponibilidade');});
test('prévia detecta duplicidade e sobreposição parcial',()=>{const result=previewImport({...input,rows:[row,{...row,startAt:'2026-10-01T09:30:00-03:00'}]});assert.equal(result.rows[1].issues.length,2);});
test('prévia mantém mapeamentos ausentes para revisão',()=>{const result=previewImport({...input,rows:[{...row,professional:'Desconhecido'}]});assert.equal(result.rows[0].status,'revisar');});
test('prévia exige fuso explícito na exportação',()=>{const result=previewImport({...input,rows:[{...row,startAt:'2026-10-01T09:00:00'}]});assert.equal(result.rows[0].startAt,null);assert.equal(result.rows[0].status,'revisar');});
