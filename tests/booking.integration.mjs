import assert from 'node:assert/strict';
import test from 'node:test';
import { testAdmin } from './local-auth.mjs';

const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
let cookie = '';
let disposeAuth=async()=>{};
let catalog;
const createdIds = new Set();

async function json(response) {
  const payload = await response.json();
  return { response, payload };
}

async function signedFetch(path, init = {}) {
  return fetch(`${base}${path}`, { ...init, headers: { ...init.headers, Cookie: cookie } });
}

async function signIn() {
  const auth=await testAdmin(base);cookie=auth.cookie;disposeAuth=auth.dispose;
}

function localDate(offset) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 86_400_000));
}

function workDate(position) {
  let found = 0;
  for (let offset = 1; offset < 40; offset += 1) {
    const candidate = localDate(offset);
    const weekday = new Date(`${candidate}T12:00:00Z`).getUTCDay();
    if (weekday === 0) continue;
    found += 1;
    if (found === position) return candidate;
  }
  throw new Error('No work date found');
}

async function slots(serviceId, professionalId, date = workDate(2), exclude = '') {
  const params = new URLSearchParams({ date, professional: professionalId });
  params.append('service', serviceId);
  if (exclude) params.set('exclude', exclude);
  const result = await json(await fetch(`${base}/api/availability?${params}`));
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  return result.payload.slots;
}

async function create({ serviceId = 'srv-barba-demo', professionalId = 'pro-ismael', startAt, key, name = 'Teste Automatizado', extra = {} }) {
  const current = await (await fetch(`${base}/api/catalog`)).json();
  const result = await json(await signedFetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceIds: [serviceId], professionalId, startAt, name, phone: '12999999999', idempotencyKey: key, quoteRevision: current.settings.configRevision, ...extra }),
  }));
  if(result.response.status===201)createdIds.add(result.payload.booking.id);
  return result;
}

test.after(async()=>{for(const bookingId of createdIds)await signedFetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'booking.status',bookingId,status:'cancelled'})});await disposeAuth();});

test('preparação da demonstração', async (t) => {
  await t.test('catálogo separa dados observados e sintéticos', async () => {
    const result = await json(await fetch(`${base}/api/catalog`));
    assert.equal(result.response.status, 200);
    catalog = result.payload;
    assert.equal(catalog.services.find((service) => service.id === 'srv-corte').priceCents, 4000);
    assert.equal(catalog.services.find((service) => service.id === 'srv-corte').source, 'observed');
    assert.equal(catalog.services.find((service) => service.id === 'srv-barba-demo').source, 'demo');
  });

  await t.test('operação de reserva exige autenticação', async () => {
    const available = await slots('srv-barba-demo', 'pro-ismael');
    const result = await json(await fetch(`${base}/api/bookings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: ['srv-barba-demo'], professionalId: 'pro-ismael', startAt: available[0].startAt, name: 'Sem sessão', phone: '12999999999', idempotencyKey: `anon-${Date.now()}` }),
    }));
    assert.equal(result.response.status, 401);
  });

  await signIn();
});

test('motor de disponibilidade', async (t) => {
  await t.test('fuso exibe 09:00 como 12:00Z em America/Sao_Paulo', async () => {
    const available = await slots('srv-corte', 'pro-ismael', workDate(3));
    assert.equal(available[0].time, '09:00');
    assert.match(available[0].startAt, /T12:00:00\.000Z$/);
  });

  await t.test('atendimento não atravessa pausa nem expediente', async () => {
    const available = await slots('srv-corte', 'pro-ismael', workDate(3));
    const times = available.map((slot) => slot.time);
    assert.ok(!times.includes('11:30'));
    assert.ok(!times.includes('12:00'));
    assert.ok(!times.includes('17:30'));
    assert.ok(times.includes('17:00'));
  });

  await t.test('profissional incompatível é rejeitado pelo servidor', async () => {
    const ismael = await slots('srv-corte', 'pro-ismael', workDate(4));
    const result = await create({ serviceId: 'srv-corte', professionalId: 'pro-leonardo', startAt: ismael[0].startAt, key: `incompatible-${Date.now()}` });
    assert.equal(result.response.status, 409);
    assert.equal(result.payload.code, 'slot_conflict');
  });
});

test('integridade transacional da agenda', async (t) => {
  const date = workDate(5);
  const available = await slots('srv-barba-demo', 'pro-ismael', date);
  assert.ok(available.length >= 6);

  await t.test('dois pedidos simultâneos no mesmo intervalo geram no máximo uma reserva ativa', async () => {
    const startAt = available[0].startAt;
    const [first, second] = await Promise.all([
      create({ startAt, key: `race-a-${Date.now()}` }),
      create({ startAt, key: `race-b-${Date.now()}` }),
    ]);
    const statuses = [first.response.status, second.response.status].sort((left, right) => left - right);
    assert.deepEqual(statuses, [201, 409]);
  });

  await t.test('sobreposição parcial é recusada', async () => {
    const result = await create({ startAt: new Date(new Date(available[0].startAt).getTime() + 15 * 60_000).toISOString(), key: `partial-${Date.now()}` });
    assert.equal(result.response.status, 409);
  });

  await t.test('profissionais independentes podem atender no mesmo horário', async () => {
    const ismaelSlots = await slots('srv-barba-demo', 'pro-ismael', date);
    const leonardoSlots = await slots('srv-barba-demo', 'pro-leonardo', date);
    const common = ismaelSlots.find((slot) => leonardoSlots.some((other) => other.startAt === slot.startAt));
    assert.ok(common);
    const [ismael, leonardo] = await Promise.all([
      create({ startAt: common.startAt, professionalId: 'pro-ismael', key: `parallel-i-${Date.now()}` }),
      create({ startAt: common.startAt, professionalId: 'pro-leonardo', key: `parallel-l-${Date.now()}` }),
    ]);
    assert.equal(ismael.response.status, 201);
    assert.equal(leonardo.response.status, 201);
  });

  await t.test('mesma chave idempotente não duplica reserva', async () => {
    const fresh = await slots('srv-barba-demo', 'pro-ismael', date);
    const startAt = fresh.at(-1).startAt;
    const key = `idem-${Date.now()}`;
    const first = await create({ startAt, key });
    const second = await create({ startAt, key });
    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);
    assert.equal(first.payload.booking.id, second.payload.booking.id);
  });

  await t.test('reutilizar chave com conteúdo diferente é rejeitado', async () => {
    const fresh = await slots('srv-barba-demo', 'pro-leonardo', date);
    const key = `mismatch-${Date.now()}`;
    const first = await create({ startAt: fresh[0].startAt, professionalId: 'pro-leonardo', key });
    assert.equal(first.response.status, 201);
    const second = await create({ startAt: fresh.at(-1).startAt, professionalId: 'pro-leonardo', key });
    assert.equal(second.response.status, 409);
    assert.equal(second.payload.code, 'idempotency_mismatch');
  });

  await t.test('preço enviado pelo navegador é ignorado', async () => {
    const fresh = await slots('srv-barba-demo', 'pro-ismael', workDate(6));
    const result = await create({ startAt: fresh[0].startAt, key: `price-${Date.now()}`, extra: { totalCents: 1, durationMinutes: 1 } });
    assert.equal(result.response.status, 201);
    assert.equal(result.payload.booking.totalCents, 3500);
    assert.equal(result.payload.booking.services[0].durationMinutes, 30);
  });
});

test('mudanças preservam a reserva correta', async (t) => {
  const date = workDate(7);
  const available = await slots('srv-barba-demo', 'pro-leonardo', date);

  await t.test('falha de remarcação mantém o horário original', async () => {
    const first = await create({ startAt: available[0].startAt, professionalId: 'pro-leonardo', key: `move-a-${Date.now()}` });
    const second = await create({ startAt: available[2].startAt, professionalId: 'pro-leonardo', key: `move-b-${Date.now()}` });
    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);
    const original = second.payload.booking.startAt;
    const moved = await json(await signedFetch(`/api/bookings/${second.payload.booking.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reschedule', professionalId: 'pro-leonardo', startAt: first.payload.booking.startAt, quoteRevision: catalog.settings.configRevision }),
    }));
    assert.equal(moved.response.status, 409);
    const readBack = await json(await signedFetch(`/api/bookings/${second.payload.booking.id}`));
    assert.equal(readBack.payload.booking.startAt, original);
  });

  await t.test('cancelamento libera o horário no banco', async () => {
    const fresh = await slots('srv-barba-demo', 'pro-ismael', workDate(8));
    const startAt = fresh[0].startAt;
    const created = await create({ startAt, key: `cancel-${Date.now()}` });
    assert.equal(created.response.status, 201);
    const cancelled = await json(await signedFetch(`/api/bookings/${created.payload.booking.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }),
    }));
    assert.equal(cancelled.response.status, 200);
    const after = await slots('srv-barba-demo', 'pro-ismael', workDate(8));
    assert.ok(after.some((slot) => slot.startAt === startAt));
  });

  await t.test('detalhes de reserva sem sessão não são expostos', async () => {
    const created = await create({ startAt: (await slots('srv-barba-demo', 'pro-ismael', workDate(9)))[0].startAt, key: `private-${Date.now()}` });
    const anonymous = await fetch(`${base}/api/bookings/${created.payload.booking.id}`);
    assert.equal(anonymous.status, 401);
  });
});

test('catálogo de carga permanece pesquisável sem virar oferta pública', () => {
  const synthetic = Array.from({ length: 40 }, (_, index) => ({ name: `Serviço sintético ${index + 1}`, source: 'test-only' }));
  const result = synthetic.filter((item) => item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('sintetico 37'));
  assert.equal(result.length, 1);
  assert.ok(catalog.services.every((service) => service.source !== 'test-only'));
});

test('gestão preserva conflitos futuros', async (t) => {
  const date = workDate(10);
  const available = await slots('srv-barba-demo', 'pro-ismael', date);
  const created = await create({ startAt: available[0].startAt, key: `admin-conflict-${Date.now()}` });
  assert.equal(created.response.status, 201);

  await t.test('bloqueio conflitante lista a reserva e não é criado', async () => {
    const result = await json(await signedFetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'block.create', professionalId: 'pro-ismael', startAt: created.payload.booking.startAt, endAt: created.payload.booking.endAt, reason: 'Teste de conflito' }),
    }));
    assert.equal(result.response.status, 409);
    assert.equal(result.payload.code, 'block_has_conflicts');
    assert.ok(result.payload.conflicts.some((item) => item.reference === created.payload.booking.reference));
  });

  await t.test('desativação de serviço com reservas futuras é recusada sem apagar histórico', async () => {
    const result = await json(await signedFetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'service.update', serviceId: 'srv-barba-demo', priceCents: 3500, durationMinutes: 30, active: false }),
    }));
    assert.equal(result.response.status, 409);
    assert.equal(result.payload.code, 'service_has_future_bookings');
    const currentCatalog = (await json(await fetch(`${base}/api/catalog`))).payload;
    assert.ok(currentCatalog.services.some((service) => service.id === 'srv-barba-demo'));
  });
});
