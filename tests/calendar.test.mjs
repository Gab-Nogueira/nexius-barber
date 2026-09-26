import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../lib/calendar.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { calendarFile, googleCalendarUrl } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const booking = { id: 'test-id', reference: 'NXS-TESTE', professionalName: 'Leonardo', startAt: '2026-10-01T12:00:00.000Z', endAt: '2026-10-01T12:45:00.000Z', createdAt: '2026-09-25T10:00:00.000Z', updatedAt: '2026-09-26T11:00:00.123Z', status: 'confirmed', services: [{ name: 'Corte; barba, café' }], clientEmail: 'private@example.test', clientPhone: '12999999999' };
test('ICS contém alarme de uma hora e datas UTC corretas', () => {
  const ics = calendarFile(booking, 'Rua das Rosas, 341', true);
  for (const value of ['TRIGGER:-PT1H','ACTION:DISPLAY','DTSTART:20261001T120000Z','DTEND:20261001T124500Z','LAST-MODIFIED:20260926T110000Z','SUMMARY:[Demo] Nexius Barber']) assert.ok(ics.includes(value), value);
  assert.ok(ics.endsWith('\r\n'));
  assert.ok(!ics.includes(booking.clientEmail) && !ics.includes(booking.clientPhone));
});
test('ICS escapa CR/LF e dobra linhas em até 75 bytes sem quebrar UTF-8', () => {
  const ics = calendarFile({ ...booking, professionalName: 'A\r\nBEGIN:VEVENT\rINJECT:' + 'á'.repeat(150) }, 'Rua; a,b\\c', false);
  assert.equal(ics.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  assert.ok(ics.includes('Rua\\; a\\,b\\\\c'));
  assert.ok(!ics.includes('\ufffd'));
});
test('cancelado preserva UID e não exporta alarme', () => {
  const ics = calendarFile({ ...booking, status: 'cancelled' }, '', false);
  assert.ok(ics.includes('STATUS:CANCELLED') && ics.includes('UID:test-id@nexius-barber-demo'));
  assert.ok(!ics.includes('BEGIN:VALARM'));
});
test('link Google não contém email ou telefone e explica alerta manual', () => {
  const url = new URL(googleCalendarUrl(booking, 'Avenida das Rosas', true));
  assert.equal(url.origin, 'https://calendar.google.com');
  assert.equal(url.searchParams.get('dates'), '20261001T120000Z/20261001T124500Z');
  assert.ok(url.searchParams.get('details').includes('1 hora antes'));
  assert.ok(!decodeURIComponent(url.href).includes(booking.clientEmail));
});
